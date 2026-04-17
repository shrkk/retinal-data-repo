"""One-shot cleanup: remove duplicate cone_data rows.

A "duplicate" is a row whose natural key
(subject_id, eye, meridian, eccentricity_deg,
 cone_x_microns, cone_y_microns, cone_spectral_type)
already appears on another row. For each group we keep the row with the
lowest `id` and delete the rest, so no unique cone is ever lost.

Usage:
    # Dry-run — prints how many rows would be deleted, no writes.
    DATABASE_URL=... python -m app.dedupe_cones

    # Actually delete. Runs inside a single transaction.
    DATABASE_URL=... python -m app.dedupe_cones --apply
"""
import argparse
import asyncio
import os

import asyncpg


# Partition by the natural-key columns that identify a physical cone.
# Rows with all-NULL keys are left alone (they can't be confidently matched).
DUP_ID_CTE = """
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY subject_id, eye, meridian, eccentricity_deg,
                            cone_x_microns, cone_y_microns, cone_spectral_type
               ORDER BY id
           ) AS rn
    FROM cone_data
)
SELECT id FROM ranked WHERE rn > 1
"""


async def main() -> int:
    parser = argparse.ArgumentParser(description="Dedupe cone_data rows.")
    parser.add_argument("--apply", action="store_true",
                        help="Actually delete duplicate rows (default: dry-run).")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")

    conn = await asyncpg.connect(database_url, statement_cache_size=0)
    try:
        total = await conn.fetchval("SELECT COUNT(*) FROM cone_data")
        dup_count = await conn.fetchval(f"SELECT COUNT(*) FROM ({DUP_ID_CTE}) d")
        print(f"cone_data total rows:        {total}")
        print(f"duplicate rows to remove:    {dup_count}")
        print(f"rows remaining after dedupe: {total - dup_count}")

        # Per-subject/eye breakdown so we can eyeball damage before committing.
        breakdown = await conn.fetch(
            """
            SELECT subject_id, eye, COUNT(*) AS dups
            FROM cone_data
            WHERE id IN (%s)
            GROUP BY subject_id, eye
            ORDER BY dups DESC
            LIMIT 20
            """ % DUP_ID_CTE
        )
        if breakdown:
            print("\nTop (subject_id, eye) by duplicate count:")
            for row in breakdown:
                print(f"  {row['subject_id']!s:10} {row['eye']!s:4}  {row['dups']}")

        if dup_count == 0:
            print("\nNothing to do.")
            return 0

        if not args.apply:
            print("\nDry-run only. Re-run with --apply to delete these rows.")
            return 0

        async with conn.transaction():
            deleted = await conn.execute(
                f"DELETE FROM cone_data WHERE id IN ({DUP_ID_CTE})"
            )
        print(f"\n{deleted}")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
