# app/main.py
import os
import csv
import io
import asyncio
from typing import Optional, List

from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import sqlite3
import aiosqlite
# PlotData model defined below


load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "retinal_data.db")
PORT = int(os.environ.get("PORT", 8001))
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "").split(",")

app = FastAPI(title="Retinal Cones API")

# Static files removed for now


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"] + [o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# database connection
import os
db_path = DATABASE_URL

# Convert to absolute path to avoid working directory issues
if not os.path.isabs(db_path):
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up one level to get the project root
    project_root = os.path.dirname(script_dir)
    db_path = os.path.join(project_root, db_path)


async def get_db():
    async with aiosqlite.connect(db_path) as db:
        yield db


# Pydantic response model for /plot-data
class PlotData(BaseModel):
    x: List[float] = Field(..., example=[1.6, 2.3, 2.8])
    y: List[float] = Field(..., example=[41.1, 47.3, 53.5])
    cone_type: List[str] = Field(..., example=["M","L","S"])


# 1) List patients
@app.get("/patients")
async def get_patients():
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT DISTINCT subject_id, age, eye, CASE WHEN eye = 'OD' THEN 'Right Eye' WHEN eye = 'OS' THEN 'Left Eye' ELSE eye END as eye_description FROM cone_data WHERE subject_id IS NOT NULL ORDER BY subject_id LIMIT 1000"
        )
        rows = await cursor.fetchall()
        data = [dict(row) for row in rows]
    return JSONResponse(content=data)


# 2) Get cones with flexible filters
from datetime import datetime

@app.get("/cones")
async def get_cones(
    subject_id: Optional[str] = Query(None),
    meridian: Optional[str] = Query(None),
    cone_type: Optional[str] = Query(None, alias="cone_spectral_type"),
    age_min: Optional[int] = Query(None),
    age_max: Optional[int] = Query(None),
    limit: int = Query(50000, gt=0, le=100000),
    offset: int = Query(0, ge=0),
):
    where_clauses = []
    params = []

    if subject_id:
        params.append(subject_id); where_clauses.append("subject_id = ?")
    if meridian:
        params.append(meridian); where_clauses.append("meridian = ?")
    if cone_type:
        params.append(cone_type); where_clauses.append("cone_spectral_type = ?")
    if age_min is not None:
        params.append(age_min); where_clauses.append("age >= ?")
    if age_max is not None:
        params.append(age_max); where_clauses.append("age <= ?")

    # append limit & offset
    params.append(limit)
    params.append(offset)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    sql = f"""
        SELECT *
        FROM cone_data
        {where_sql}
        ORDER BY cone_x_microns NULLS LAST
        LIMIT ? OFFSET ?;
    """

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(sql, params)
        rows = await cursor.fetchall()

    # Convert datetime objects to ISO strings
    result = []
    for r in rows:
        row_dict = dict(r)
        for k, v in row_dict.items():
            if isinstance(v, datetime):
                row_dict[k] = v.isoformat()
        result.append(row_dict)

    return JSONResponse(content=result)


# 3) Plot-friendly JSON

@app.get("/plot-data", response_model=PlotData)
async def plot_data(
    subject_id: Optional[str] = Query(None),
    meridian: Optional[str] = Query(None),
    cone_type: Optional[List[str]] = Query(None, alias="cone_spectral_type"),
    eccentricity_min: Optional[float] = Query(None),
    eccentricity_max: Optional[float] = Query(None),
    limit: int = Query(50000, gt=0, le=100000),
):
    where_clauses = []
    params = []

    if subject_id:
        params.append(subject_id)
        where_clauses.append("subject_id = ?")
    if meridian:
        params.append(meridian)
        where_clauses.append("meridian = ?")
    if cone_type:
        # Use SQL IN clause for multiple types
        placeholders = ",".join("?" for _ in cone_type)
        params.extend(cone_type)
        where_clauses.append(f"cone_spectral_type IN ({placeholders})")
    if eccentricity_min is not None:
        params.append(eccentricity_min)
        where_clauses.append("eccentricity_deg >= ?")
    if eccentricity_max is not None:
        params.append(eccentricity_max)
        where_clauses.append("eccentricity_deg <= ?")

    params.append(limit)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    sql = f"""
        SELECT cone_x_microns AS x, cone_y_microns AS y, cone_spectral_type AS cone_type
        FROM cone_data
        {where_sql}
        ORDER BY cone_x_microns NULLS LAST
        LIMIT ?;
    """

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(sql, params)
        rows = await cursor.fetchall()

    x, y, ctype = [], [], []
    for r in rows:
        x.append(r["x"])
        y.append(r["y"])
        ctype.append(r["cone_type"])

    return {"x": x, "y": y, "cone_type": ctype}

# 4) Get metadata for legend
@app.get("/metadata")
async def get_metadata(
    subject_id: Optional[str] = Query(None),
    meridian: Optional[str] = Query(None),
    cone_type: Optional[List[str]] = Query(None, alias="cone_spectral_type"),
    eccentricity_min: Optional[float] = Query(None),
    eccentricity_max: Optional[float] = Query(None),
):
    where_clauses = []
    params = []

    if subject_id:
        params.append(subject_id)
        where_clauses.append("subject_id = ?")
    if meridian:
        params.append(meridian)
        where_clauses.append("meridian = ?")
    if cone_type:
        # Use SQL IN clause for multiple types
        placeholders = ",".join("?" for _ in cone_type)
        params.extend(cone_type)
        where_clauses.append(f"cone_spectral_type IN ({placeholders})")
    if eccentricity_min is not None:
        params.append(eccentricity_min)
        where_clauses.append("eccentricity_deg >= ?")
    if eccentricity_max is not None:
        params.append(eccentricity_max)
        where_clauses.append("eccentricity_deg <= ?")

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    
    # Get metadata from first row (consistent across filtered data)
    metadata_sql = f"""
        SELECT DISTINCT fov, lm_ratio, scones, lcone_density, mcone_density, scone_density, numcones, eye,
               CASE 
                   WHEN eye = 'OD' THEN 'Right Eye'
                   WHEN eye = 'OS' THEN 'Left Eye'
                   ELSE eye
               END as eye_description
        FROM cone_data
        {where_sql}
        LIMIT 1;
    """
    
    # Get actual counts for filtered data
    counts_sql = f"""
        SELECT 
            COUNT(*) as total_filtered_cones,
            COUNT(CASE WHEN cone_spectral_type = 'L' THEN 1 END) as l_cones_count,
            COUNT(CASE WHEN cone_spectral_type = 'M' THEN 1 END) as m_cones_count,
            COUNT(CASE WHEN cone_spectral_type = 'S' THEN 1 END) as s_cones_count
        FROM cone_data
        {where_sql};
    """

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        
        # Get metadata
        cursor = await db.execute(metadata_sql, params)
        metadata_row = await cursor.fetchone()
        
        # Get counts
        cursor = await db.execute(counts_sql, params)
        counts_row = await cursor.fetchone()
    
    if not metadata_row:
        return JSONResponse(content={})
    
    metadata = dict(metadata_row)
    counts = dict(counts_row)
    
    # Add filtered counts to metadata
    metadata.update({
        "filtered_total_cones": counts["total_filtered_cones"],
        "filtered_l_cones": counts["l_cones_count"],
        "filtered_m_cones": counts["m_cones_count"],
        "filtered_s_cones": counts["s_cones_count"]
    })
    
    return JSONResponse(content=metadata)

# 5) Get eccentricity ranges for a subject/meridian
@app.get("/eccentricity-ranges")
async def get_eccentricity_ranges(
    subject_id: str = Query(...),
    meridian: str = Query(...),
):
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT DISTINCT eccentricity_deg, COUNT(*) as count
            FROM cone_data 
            WHERE subject_id = ? AND meridian = ?
            GROUP BY eccentricity_deg
            ORDER BY eccentricity_deg
        """, (subject_id, meridian))
        rows = await cursor.fetchall()
    
    if not rows:
        return JSONResponse(content={"ranges": []})
    
    # Group eccentricities into ranges
    eccentricities = []
    for r in rows:
        if r["eccentricity_deg"] is not None:
            try:
                eccentricities.append(float(r["eccentricity_deg"]))
            except (ValueError, TypeError):
                # Skip malformed eccentricity values
                continue
    eccentricities.sort()
    
    ranges = []
    for i, ecc in enumerate(eccentricities):
        # Create a small range around each eccentricity value
        range_size = 0.1  # 0.1 degree range
        min_ecc = max(0, ecc - range_size/2)
        max_ecc = ecc + range_size/2
        
        ranges.append({
            "min": min_ecc,
            "max": max_ecc,
            "label": f"{ecc:.1f}°"
        })
    
    return JSONResponse(content={"ranges": ranges})

# 6) CSV export (streaming)
from datetime import datetime
@app.get("/cones/export")
async def export_cones(
    subject_id: str = Query(...),
    meridian: str = Query(...),
    cone_type: Optional[List[str]] = Query(None, alias="cone_spectral_type"),
    eccentricity_min: Optional[float] = Query(None),
    eccentricity_max: Optional[float] = Query(None),
    limit: int = Query(10000, gt=0, le=100000),
):
    if not subject_id or not meridian:
        raise HTTPException(status_code=400, detail="subject_id and meridian are required")

    params = [subject_id, meridian]
    where_clauses = ["subject_id = ?", "meridian = ?"]

    if cone_type:
        # Use SQL IN clause for multiple types
        placeholders = ",".join("?" for _ in cone_type)
        params.extend(cone_type)
        where_clauses.append(f"cone_spectral_type IN ({placeholders})")
    
    if eccentricity_min is not None:
        params.append(eccentricity_min)
        where_clauses.append("eccentricity_deg >= ?")
    
    if eccentricity_max is not None:
        params.append(eccentricity_max)
        where_clauses.append("eccentricity_deg <= ?")

    params.append(limit)

    where_sql = " AND ".join(where_clauses)
    sql = f"""
        SELECT *
        FROM cone_data
        WHERE {where_sql}
        ORDER BY cone_x_microns
        LIMIT ?;
    """

    async def stream_generator():
        async with aiosqlite.connect(db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(sql, params)
            rows = await cursor.fetchall()
            
            if not rows:
                yield b"id,cone_x_microns,cone_y_microns,cone_spectral_type\n"
                return

            # Identify metadata fields (present in first row)
            meta_fields = ["subject_id","age","eye","meridian","eccentricity_deg",
                           "eccentricity_mm","ret_mag_factor","fov","lm_ratio",
                           "scones","lcone_density","mcone_density","scone_density",
                           "numcones","nonclass_cones","cone_origin","zernike_pupil_diam",
                           "zernike_measure_wave","zernike_optim_wave"]
            cone_fields = [k for k in rows[0].keys() if k not in meta_fields]

            header = cone_fields + meta_fields
            buff = io.StringIO()
            writer = csv.writer(buff)
            writer.writerow(header)
            yield buff.getvalue().encode()

            # Use first row metadata for all rows
            metadata = {k: rows[0][k] for k in meta_fields}

            count = 0
            for r in rows:
                if count >= limit:
                    break
                row_values = [r[f] for f in cone_fields]
                # attach metadata from first row
                row_values += [metadata[f] for f in meta_fields]
                # convert datetime to ISO
                row_values = [v.isoformat() if isinstance(v, datetime) else v for v in row_values]
                buff = io.StringIO()
                writer = csv.writer(buff)
                writer.writerow(row_values)
                yield buff.getvalue().encode()
                count += 1
                await asyncio.sleep(0)

    # Create descriptive filename
    cone_types_str = "_".join(cone_type) if cone_type else "all"
    ecc_str = ""
    if eccentricity_min is not None or eccentricity_max is not None:
        min_str = f"{eccentricity_min:.1f}" if eccentricity_min is not None else "0"
        max_str = f"{eccentricity_max:.1f}" if eccentricity_max is not None else "inf"
        ecc_str = f"_ecc{min_str}-{max_str}"
    
    filename = f"{subject_id}_{meridian}_{cone_types_str}{ecc_str}_cones.csv"
    return StreamingResponse(
        stream_generator(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=PORT)
