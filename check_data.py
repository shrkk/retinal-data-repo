import sqlite3

conn = sqlite3.connect('retinal_data.db')
cursor = conn.cursor()

# Get column names
cursor.execute("PRAGMA table_info(cone_data)")
columns = [row[1] for row in cursor.fetchall()]
print("Columns:", columns)

# Get a sample record
cursor.execute("SELECT * FROM cone_data LIMIT 1")
row = cursor.fetchone()
print("\nSample record:")
for i, col in enumerate(columns):
    print(f"{col}: {row[i]}")

# Check for non-null X coordinates
cursor.execute("SELECT COUNT(*) FROM cone_data WHERE cone_x_microns IS NOT NULL")
print(f"\nRecords with valid X coordinates: {cursor.fetchone()[0]}")

# Check what data we do have
cursor.execute("SELECT DISTINCT cone_spectral_type FROM cone_data WHERE cone_spectral_type IS NOT NULL")
print(f"Cone types: {[row[0] for row in cursor.fetchall()]}")

cursor.execute("SELECT DISTINCT subject_id FROM cone_data WHERE subject_id IS NOT NULL")
print(f"Subject IDs: {[row[0] for row in cursor.fetchall()]}")

cursor.execute("SELECT DISTINCT meridian FROM cone_data WHERE meridian IS NOT NULL")
print(f"Meridians: {[row[0] for row in cursor.fetchall()]}")

conn.close()
