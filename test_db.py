import os
import asyncio
import asyncpg

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

async def test_connection():
    try:
        conn = await asyncpg.connect(DATABASE_URL, ssl="require")
        row = await conn.fetchrow("SELECT 1;")
        print("Connection successful ✅:", row)
        await conn.close()
    except Exception as e:
        print("Connection failed ❌:", e)

asyncio.run(test_connection())
