import asyncio
import asyncpg

DATABASE_URL = "postgresql://postgres.ytglrmyvdzhidwcutrtn:uwophthalmology2025@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
async def test_connection():
    try:
        conn = await asyncpg.connect(DATABASE_URL, ssl="require")
        row = await conn.fetchrow("SELECT 1;")
        print("Connection successful ✅:", row)
        await conn.close()
    except Exception as e:
        print("Connection failed ❌:", e)

asyncio.run(test_connection())
