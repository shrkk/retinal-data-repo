import csv

with open('sampleAO001fix.csv', 'r') as f:
    reader = csv.DictReader(f)
    row = next(reader)
    print('First row keys and values:')
    for k, v in row.items():
        print(f'{k}: "{v}"')
    
    print(f'\ncone_x_microns value: "{row["cone_x_microns"]}"')
    print(f'cone_x_microns type: {type(row["cone_x_microns"])}')
    print(f'cone_x_microns is empty: {row["cone_x_microns"] == ""}')
    print(f'cone_x_microns is None: {row["cone_x_microns"] is None}')
