import os
import csv
import io
import asyncio
from typing import Optional, List
import sqlite3
import aiosqlite

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Retinal Cones API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database path
db_path = "retinal_data.db"

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
            "SELECT DISTINCT subject_id, COALESCE(age, 0) as age, eye, CASE WHEN eye = 'OD' THEN 'Right Eye' WHEN eye = 'OS' THEN 'Left Eye' ELSE eye END as eye_description FROM cone_data WHERE subject_id IS NOT NULL GROUP BY subject_id ORDER BY subject_id LIMIT 1000"
        )
        rows = await cursor.fetchall()
        data = [dict(row) for row in rows]
    return JSONResponse(content=data)

# 2) Get cones with flexible filters
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

    result = []
    for r in rows:
        row_dict = dict(r)
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
        placeholders = ",".join("?" * len(cone_type))
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
):
    where_clauses = []
    params = []

    if subject_id:
        params.append(subject_id)
        where_clauses.append("subject_id = ?")
    if meridian:
        params.append(meridian)
        where_clauses.append("meridian = ?")

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    sql = f"""
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

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(sql, params)
        row = await cursor.fetchone()
    
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
