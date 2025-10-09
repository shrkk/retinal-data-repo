# app/main.py
import os
import csv
import io
import asyncio
from typing import Optional, List

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import asyncpg
from .models import PlotData


load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
PORT = int(os.environ.get("PORT", 8000))
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "").split(",")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

app = FastAPI(title="Retinal Cones API")

from fastapi.staticfiles import StaticFiles

app.mount("/static", StaticFiles(directory="app/static"), name="static")


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"] + [o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# connection pool
pool: Optional[asyncpg.pool.Pool] = None


@app.on_event("startup")
async def startup():
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)


@app.on_event("shutdown")
async def shutdown():
    global pool
    if pool:
        await pool.close()


# Pydantic response model for /plot-data
class PlotData(BaseModel):
    x: List[float] = Field(..., example=[1.6, 2.3, 2.8])
    y: List[float] = Field(..., example=[41.1, 47.3, 53.5])
    cone_type: List[str] = Field(..., example=["M","L","S"])


# 1) List patients
@app.get("/patients")
async def get_patients():
    global pool
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT DISTINCT subject_id, age FROM cone_data WHERE subject_id IS NOT NULL ORDER BY subject_id LIMIT 1000"
        )
    data = [dict(r) for r in rows]
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
    limit: int = Query(100, gt=0, le=1000),
    offset: int = Query(0, ge=0),
):
    global pool
    where_clauses = []
    params = []

    if subject_id:
        params.append(subject_id); where_clauses.append(f"subject_id = ${len(params)}")
    if meridian:
        params.append(meridian); where_clauses.append(f"meridian = ${len(params)}")
    if cone_type:
        params.append(cone_type); where_clauses.append(f"cone_spectral_type = ${len(params)}")
    if age_min is not None:
        params.append(age_min); where_clauses.append(f"age >= ${len(params)}")
    if age_max is not None:
        params.append(age_max); where_clauses.append(f"age <= ${len(params)}")

    # append limit & offset
    params.append(limit)
    params.append(offset)
    limit_idx = len(params) - 1
    offset_idx = len(params)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    sql = f"""
        SELECT *
        FROM cone_data
        {where_sql}
        ORDER BY cone_x_microns NULLS LAST
        LIMIT ${limit_idx} OFFSET ${offset_idx};
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

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
    limit: int = Query(2000, gt=0, le=5000),
):
    global pool
    where_clauses = []
    params = []

    if subject_id:
        params.append(subject_id)
        where_clauses.append(f"subject_id = ${len(params)}")
    if meridian:
        params.append(meridian)
        where_clauses.append(f"meridian = ${len(params)}")
    if cone_type:
        # Use SQL IN clause for multiple types
        params.extend(cone_type)
        placeholders = ",".join(f"${i}" for i in range(len(params)-len(cone_type)+1, len(params)+1))
        where_clauses.append(f"cone_spectral_type IN ({placeholders})")
    if eccentricity_min is not None:
        params.append(eccentricity_min)
        where_clauses.append(f"eccentricity_deg >= ${len(params)}")
    if eccentricity_max is not None:
        params.append(eccentricity_max)
        where_clauses.append(f"eccentricity_deg <= ${len(params)}")

    params.append(limit)
    limit_idx = len(params)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    sql = f"""
        SELECT cone_x_microns AS x, cone_y_microns AS y, cone_spectral_type AS cone_type
        FROM cone_data
        {where_sql}
        ORDER BY cone_x_microns NULLS LAST
        LIMIT ${limit_idx};
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)

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
):
    global pool
    where_clauses = []
    params = []

    if subject_id:
        params.append(subject_id)
        where_clauses.append(f"subject_id = ${len(params)}")
    if meridian:
        params.append(meridian)
        where_clauses.append(f"meridian = ${len(params)}")

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    sql = f"""
        SELECT DISTINCT fov, lm_ratio, scones, lcone_density, mcone_density, scone_density, numcones
        FROM cone_data
        {where_sql}
        LIMIT 1;
    """

    async with pool.acquire() as conn:
        row = await conn.fetchrow(sql, *params)
    
    if not row:
        return JSONResponse(content={})
    
    metadata = dict(row)
    return JSONResponse(content=metadata)

# 5) Get eccentricity ranges for a subject/meridian
@app.get("/eccentricity-ranges")
async def get_eccentricity_ranges(
    subject_id: str = Query(...),
    meridian: str = Query(...),
):
    global pool
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT DISTINCT eccentricity_deg, COUNT(*) as count
            FROM cone_data 
            WHERE subject_id = $1 AND meridian = $2
            GROUP BY eccentricity_deg
            ORDER BY eccentricity_deg
        """, subject_id, meridian)
    
    if not rows:
        return JSONResponse(content={"ranges": []})
    
    # Group eccentricities into ranges
    eccentricities = [float(r["eccentricity_deg"]) for r in rows if r["eccentricity_deg"] is not None]
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

    global pool
    params = [subject_id, meridian]
    where_clauses = ["subject_id = $1", "meridian = $2"]

    if cone_type:
        # Use SQL IN clause for multiple types
        params.extend(cone_type)
        placeholders = ",".join(f"${i}" for i in range(len(params)-len(cone_type)+1, len(params)+1))
        where_clauses.append(f"cone_spectral_type IN ({placeholders})")
    
    if eccentricity_min is not None:
        params.append(eccentricity_min)
        where_clauses.append(f"eccentricity_deg >= ${len(params)}")
    
    if eccentricity_max is not None:
        params.append(eccentricity_max)
        where_clauses.append(f"eccentricity_deg <= ${len(params)}")

    params.append(limit)
    limit_idx = len(params)

    where_sql = " AND ".join(where_clauses)
    sql = f"""
        SELECT *
        FROM cone_data
        WHERE {where_sql}
        ORDER BY cone_x_microns
        LIMIT ${limit_idx};
    """

    async def stream_generator():
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)
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
