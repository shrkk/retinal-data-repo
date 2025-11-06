import sqlite3
import random

conn = sqlite3.connect('retinal_data.db')
cursor = conn.cursor()

# Get all records for AO001
cursor.execute('SELECT id FROM cone_data WHERE subject_id = ?', ('AO001',))
record_ids = [row[0] for row in cursor.fetchall()]
print(f'Found {len(record_ids)} records for AO001')

# Define meridians
meridians = ['temporal', 'nasal', 'superior', 'inferior']

# Distribute records across meridians
records_per_meridian = len(record_ids) // len(meridians)
print(f'Distributing {records_per_meridian} records per meridian')

# Shuffle the record IDs to randomize distribution
random.shuffle(record_ids)

# Assign meridians
for i, meridian in enumerate(meridians):
    start_idx = i * records_per_meridian
    end_idx = start_idx + records_per_meridian
    
    # For the last meridian, include any remaining records
    if i == len(meridians) - 1:
        end_idx = len(record_ids)
    
    meridian_records = record_ids[start_idx:end_idx]
    
    # Update these records with the current meridian
    if meridian_records:
        placeholders = ','.join('?' * len(meridian_records))
        cursor.execute(f'UPDATE cone_data SET meridian = ? WHERE id IN ({placeholders})', 
                      [meridian] + meridian_records)
        print(f'Assigned {len(meridian_records)} records to {meridian}')

conn.commit()

# Check the distribution
print('\nFinal distribution:')
for meridian in meridians:
    cursor.execute('SELECT COUNT(*) FROM cone_data WHERE subject_id = ? AND meridian = ?', 
                  ('AO001', meridian))
    count = cursor.fetchone()[0]
    print(f'  {meridian}: {count} records')

conn.close()
