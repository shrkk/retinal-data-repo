import asyncio
import aiosqlite
import json

async def test_database():
    db_path = "retinal_data.db"
    
    try:
        async with aiosqlite.connect(db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT DISTINCT subject_id, age FROM cone_data WHERE subject_id IS NOT NULL ORDER BY subject_id LIMIT 1000"
            )
            rows = await cursor.fetchall()
            data = [dict(row) for row in rows]
            
            print(f"Found {len(data)} patients:")
            for patient in data[:5]:  # Show first 5
                print(f"  Subject ID: {patient['subject_id']}, Age: {patient['age']}")
            
            return data
    except Exception as e:
        print(f"Database error: {e}")
        return []

if __name__ == "__main__":
    asyncio.run(test_database())
