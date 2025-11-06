import sqlite3
import csv
import os

def setup_database():
    # Create SQLite database
    db_path = "retinal_data.db"
    
    # Remove existing database if it exists
    if os.path.exists(db_path):
        os.remove(db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create the cone_data table
    cursor.execute('''
        CREATE TABLE cone_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cone_x_microns REAL,
            cone_y_microns REAL,
            cone_spectral_type TEXT,
            subject_id TEXT,
            age INTEGER,
            eye TEXT,
            meridian TEXT,
            eccentricity_deg REAL,
            eccentricity_mm TEXT,
            ret_mag_factor REAL,
            fov TEXT,
            lm_ratio REAL,
            scones REAL,
            lcone_density REAL,
            mcone_density REAL,
            scone_density REAL,
            numcones INTEGER,
            nonclass_cones INTEGER,
            cone_origin TEXT,
            zernike_pupil_diam REAL,
            zernike_measure_wave REAL,
            zernike_optim_wave REAL
        )
    ''')
    
    # Read and insert sample data
    with open('sampleAO001fix.csv', 'r', encoding='utf-8-sig') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            # Clean up the data
            cleaned_row = {}
            for key, value in row.items():
                if value == '':
                    cleaned_row[key] = None
                elif key in ['age', 'numcones', 'nonclass_cones']:
                    try:
                        cleaned_row[key] = int(value) if value else None
                    except ValueError:
                        cleaned_row[key] = None
                elif key in ['cone_x_microns', 'cone_y_microns', 'eccentricity_deg', 'ret_mag_factor', 
                           'lm_ratio', 'scones', 'lcone_density', 'mcone_density', 'scone_density',
                           'zernike_pupil_diam', 'zernike_measure_wave', 'zernike_optim_wave']:
                    try:
                        cleaned_row[key] = float(value) if value and value.strip() else None
                    except (ValueError, AttributeError):
                        cleaned_row[key] = None
                else:
                    cleaned_row[key] = value
            
            # Insert the row
            cursor.execute('''
                INSERT INTO cone_data (
                    cone_x_microns, cone_y_microns, cone_spectral_type, subject_id, age,
                    eye, meridian, eccentricity_deg, eccentricity_mm, ret_mag_factor,
                    fov, lm_ratio, scones, lcone_density, mcone_density, scone_density,
                    numcones, nonclass_cones, cone_origin, zernike_pupil_diam,
                    zernike_measure_wave, zernike_optim_wave
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                cleaned_row.get('cone_x_microns'),
                cleaned_row.get('cone_y_microns'),
                cleaned_row.get('cone_spectral_type'),
                cleaned_row.get('subject_id'),
                cleaned_row.get('age'),
                cleaned_row.get('eye'),
                cleaned_row.get('meridian'),
                cleaned_row.get('eccentricity_deg'),
                cleaned_row.get('eccentricity_mm'),
                cleaned_row.get('ret_mag_factor'),
                cleaned_row.get('fov'),
                cleaned_row.get('lm_ratio'),
                cleaned_row.get('scones'),
                cleaned_row.get('lcone_density'),
                cleaned_row.get('mcone_density'),
                cleaned_row.get('scone_density'),
                cleaned_row.get('numcones'),
                cleaned_row.get('nonclass_cones'),
                cleaned_row.get('cone_origin'),
                cleaned_row.get('zernike_pupil_diam'),
                cleaned_row.get('zernike_measure_wave'),
                cleaned_row.get('zernike_optim_wave')
            ))
    
    conn.commit()
    conn.close()
    print(f"Database created successfully at {db_path}")
    print("Sample data imported from sampleAO001fix.csv")

if __name__ == "__main__":
    setup_database()
