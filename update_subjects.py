import sqlite3

conn = sqlite3.connect('retinal_data.db')
cursor = conn.cursor()

# Update all NULL subject_id records to AO001
cursor.execute('UPDATE cone_data SET subject_id = ? WHERE subject_id IS NULL', ('AO001',))
conn.commit()

print('Updated records with subject_id = AO001')

# Check the results
cursor.execute('SELECT COUNT(*) FROM cone_data WHERE subject_id = ?', ('AO001',))
total_records = cursor.fetchone()[0]
print(f'Total AO001 records: {total_records}')

# Check cone type distribution
cursor.execute('SELECT cone_spectral_type, COUNT(*) FROM cone_data WHERE subject_id = ? GROUP BY cone_spectral_type', ('AO001',))
print('Cone type distribution:')
for row in cursor.fetchall():
    print(f'  {row[0]}: {row[1]} records')

conn.close()
