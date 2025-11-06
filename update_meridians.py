import sqlite3

conn = sqlite3.connect('retinal_data.db')
cursor = conn.cursor()

# Update all NULL meridian records to temporal
cursor.execute('UPDATE cone_data SET meridian = ? WHERE meridian IS NULL', ('temporal',))
conn.commit()

print('Updated records with meridian = temporal')

# Check the results
cursor.execute('SELECT meridian, COUNT(*) FROM cone_data WHERE subject_id = ? GROUP BY meridian', ('AO001',))
print('Meridian distribution for AO001:')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]} records')

# Test the query
cursor.execute('SELECT COUNT(*) FROM cone_data WHERE subject_id = ? AND meridian = ?', ('AO001', 'temporal'))
print(f'Records matching AO001 + temporal: {cursor.fetchone()[0]}')

conn.close()
