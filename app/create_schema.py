"""One-time schema creation script for Supabase PostgreSQL.

Usage: DATABASE_URL=... python -m app.create_schema
"""
import asyncio
import os
import asyncpg


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS cone_data (
    id                  BIGSERIAL PRIMARY KEY,
    cone_x_microns      FLOAT,
    cone_y_microns      FLOAT,
    cone_spectral_type  VARCHAR(4),
    subject_id          VARCHAR(32) NOT NULL,
    eye                 VARCHAR(4),
    meridian            VARCHAR(16),
    eccentricity_deg    FLOAT,
    eccentricity_mm     FLOAT,
    lm_ratio            FLOAT,
    scones              FLOAT,
    lcone_density       FLOAT,
    mcone_density       FLOAT,
    scone_density       FLOAT,
    numcones            INTEGER,
    nonclass_cones      INTEGER,
    age                 FLOAT,
    fov                 VARCHAR(64),
    ret_mag_factor      FLOAT,
    cone_origin         VARCHAR(32),
    zernike_pupil_diam  FLOAT,
    zernike_measure_wave FLOAT,
    zernike_optim_wave  FLOAT
);

CREATE INDEX IF NOT EXISTS idx_cone_data_subject_meridian
    ON cone_data (subject_id, meridian);

CREATE INDEX IF NOT EXISTS idx_cone_data_subject_ecc
    ON cone_data (subject_id, eccentricity_deg);

CREATE INDEX IF NOT EXISTS idx_cone_data_spectral_type
    ON cone_data (cone_spectral_type);

CREATE INDEX IF NOT EXISTS idx_cone_data_plot_query
    ON cone_data (subject_id, meridian, eccentricity_deg, cone_spectral_type);
"""


UPLOAD_LOG_SQL = """
CREATE TABLE IF NOT EXISTS upload_log (
    id             BIGSERIAL PRIMARY KEY,
    uploaded_at    TIMESTAMPTZ DEFAULT now(),
    subject_id     TEXT,
    eye            TEXT,
    event_type     TEXT NOT NULL,
    commit_message TEXT,
    rows_ingested  INTEGER,
    uploaded_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_upload_log_uploaded_at
    ON upload_log (uploaded_at DESC);
"""


async def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")

    conn = await asyncpg.connect(database_url, statement_cache_size=0)
    try:
        await conn.execute(SCHEMA_SQL)
        print("Schema created successfully")

        await conn.execute(UPLOAD_LOG_SQL)
        print("upload_log table created successfully")

        # Verify table exists and column types
        rows = await conn.fetch(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name = 'cone_data' ORDER BY ordinal_position"
        )
        print(f"\nTable cone_data has {len(rows)} columns:")
        for row in rows:
            print(f"  {row['column_name']}: {row['data_type']}")

        # Verify indexes
        idx_rows = await conn.fetch(
            "SELECT indexname FROM pg_indexes WHERE tablename = 'cone_data'"
        )
        print(f"\nIndexes ({len(idx_rows)}):")
        for row in idx_rows:
            print(f"  {row['indexname']}")

        # Verify upload_log table
        ul_rows = await conn.fetch(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'upload_log' ORDER BY ordinal_position"
        )
        print(f"\nTable upload_log has {len(ul_rows)} columns:")
        for row in ul_rows:
            print(f"  {row['column_name']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
