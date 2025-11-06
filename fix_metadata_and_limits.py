import sqlite3

conn = sqlite3.connect('retinal_data.db')
cursor = conn.cursor()

# Get the metadata from a record that has it
cursor.execute('SELECT fov, lm_ratio, scones, lcone_density, mcone_density, scone_density, numcones FROM cone_data WHERE subject_id = ? AND fov IS NOT NULL LIMIT 1', ('AO001',))
metadata = cursor.fetchone()

if metadata:
    fov, lm_ratio, scones, lcone_density, mcone_density, scone_density, numcones = metadata
    
    print(f'Found metadata: fov={fov}, lm_ratio={lm_ratio}, scones={scones}')
    print(f'lcone_density={lcone_density}, mcone_density={mcone_density}, scone_density={scone_density}, numcones={numcones}')
    
    # Update all records for AO001 with this metadata
    cursor.execute('''
        UPDATE cone_data SET 
            fov = ?, lm_ratio = ?, scones = ?, 
            lcone_density = ?, mcone_density = ?, scone_density = ?, numcones = ?
        WHERE subject_id = ?
    ''', (fov, lm_ratio, scones, lcone_density, mcone_density, scone_density, numcones, 'AO001'))
    
    conn.commit()
    print('Updated all AO001 records with metadata')
    
    # Verify the update
    cursor.execute('SELECT COUNT(*) FROM cone_data WHERE subject_id = ? AND fov IS NOT NULL', ('AO001',))
    count = cursor.fetchone()[0]
    print(f'Records with metadata: {count}')
    
    # Test metadata for each meridian
    meridians = ['temporal', 'nasal', 'superior', 'inferior']
    for meridian in meridians:
        cursor.execute('SELECT fov, lm_ratio, numcones FROM cone_data WHERE subject_id = ? AND meridian = ? LIMIT 1', ('AO001', meridian))
        row = cursor.fetchone()
        print(f'{meridian}: fov={row[0]}, lm_ratio={row[1]}, numcones={row[2]}')
else:
    print('No metadata found')

conn.close()
