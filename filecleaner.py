# Save this as reformat_AO.py and run with: python reformat_AO.py
import pandas as pd, numpy as np, math, re

ao_path = "AO001R_v1.csv"            # <- change to your path if needed
sample_path = "sampleAO001fix.csv"   # <- path to sample fix for column ordering
out_path = "AO001R_v1_fix_full.csv"

ao = pd.read_csv(ao_path)
sample_fix = pd.read_csv(sample_path)

cols = ao.columns.tolist()

# identify parameter and values columns
param_cols = [c for c in cols if c.startswith("Parameter_Name")]
values_cols = [c for c in cols if c.startswith("Values")]

# find Values.* columns that actually contain metadata (non-empty)
nonempty_values = [v for v in values_cols if ao[v].dropna().shape[0] > 0]

# map each Parameter_Name.* column to the nearest non-empty Values.* column
col_index = {c: i for i, c in enumerate(cols)}
param_to_values = {}
for p in param_cols:
    pidx = col_index[p]
    best = min(nonempty_values, key=lambda v: abs(col_index[v] - pidx))
    param_to_values[p] = best

# helper to parse tuple strings like "(0.4,0)"
def parse_tuple(s):
    if pd.isna(s):
        return (np.nan, np.nan)
    s = str(s).strip()
    m = re.search(r"\(?\s*([-+]?[0-9]*\.?[0-9]+)\s*,\s*([-+]?[0-9]*\.?[0-9]+)\s*\)?", s)
    if m:
        return float(m.group(1)), float(m.group(2))
    parts = re.split(r"[ ,;xX]+", s.replace("(", "").replace(")", ""))
    try:
        a = float(parts[0])
        b = float(parts[1]) if len(parts) > 1 else 0.0
        return a, b
    except:
        return (np.nan, np.nan)

all_dfs = []
i = 0
while True:
    suffix = "" if i == 0 else f".{i}"
    cone_x_col = f"Cone x location (microns){suffix}"
    cone_y_col = f"Cone y location (microns){suffix}"
    cone_type_col = f"Cone spectral type{suffix}"
    if cone_x_col not in ao.columns or cone_y_col not in ao.columns or cone_type_col not in ao.columns:
        break

    block_cones = ao[[cone_x_col, cone_y_col, cone_type_col]].copy()
    block_cones.columns = ["cone_x_microns", "cone_y_microns", "cone_spectral_type"]
    block_cones = block_cones.dropna(how="all", subset=["cone_x_microns","cone_y_microns","cone_spectral_type"])
    if block_cones.shape[0] == 0:
        i += 1
        continue

    param_col = "Parameter_Name" if i == 0 else f"Parameter_Name.{i}"
    values_col = param_to_values.get(param_col, None)
    metadata = {}
    if values_col is not None:
        for idx, pname in ao[param_col].fillna("").items():
            if str(pname).strip() == "":
                continue
            pval = ao[values_col].iloc[idx] if values_col in ao.columns else np.nan
            pname_str = str(pname).strip()
            val_str = pval if pd.notna(pval) else ""
            if pname_str.lower().startswith("subject id"):
                metadata["subject_id"] = str(val_str)
            elif "age (years)" in pname_str.lower():
                try:
                    metadata["age"] = float(val_str)
                except:
                    metadata["age"] = val_str
            elif pname_str.lower().startswith("eye"):
                metadata["eye"] = str(val_str)
            elif "axial length" in pname_str.lower():
                try:
                    metadata["axial_length"] = float(val_str)
                except:
                    metadata["axial_length"] = val_str
            elif "meridian" in pname_str.lower():
                metadata["meridian"] = str(val_str)
            elif "eccentricity (x,y) (deg)" in pname_str.lower():
                x_deg, y_deg = parse_tuple(val_str)
                if not (np.isnan(x_deg) or np.isnan(y_deg)):
                    metadata["eccentricity_deg"] = math.hypot(x_deg, y_deg)
                    metadata["eccentricity_x_deg"] = x_deg
                    metadata["eccentricity_y_deg"] = y_deg
                else:
                    metadata["eccentricity_deg"] = val_str
            elif "eccentricity (x,y) (mm)" in pname_str.lower():
                x_mm, y_mm = parse_tuple(val_str)
                if not (np.isnan(x_mm) or np.isnan(y_mm)):
                    metadata["eccentricity_mm"] = math.hypot(x_mm, y_mm)
                    metadata["eccentricity_x_mm"] = x_mm
                    metadata["eccentricity_y_mm"] = y_mm
                else:
                    metadata["eccentricity_mm"] = val_str
            elif "retinal maginification factor" in pname_str.lower() or "retinal magnification" in pname_str.lower():
                try:
                    metadata["ret_mag_factor"] = float(val_str)
                except:
                    metadata["ret_mag_factor"] = val_str
            elif pname_str.lower().startswith("fov"):
                metadata["fov"] = str(val_str)
            elif "l/m ratio" in pname_str.lower() or "l/m" in pname_str.lower():
                try:
                    metadata["lm_ratio"] = float(val_str)
                except:
                    metadata["lm_ratio"] = val_str
            elif "% s-cones" in pname_str.lower() or "s-cones" in pname_str.lower():
                try:
                    metadata["scones"] = float(val_str)
                except:
                    metadata["scones"] = val_str
            elif "l-cone density" in pname_str.lower():
                try:
                    metadata["lcone_density"] = float(val_str)
                except:
                    metadata["lcone_density"] = val_str
            elif "m-cone density" in pname_str.lower():
                try:
                    metadata["mcone_density"] = float(val_str)
                except:
                    metadata["mcone_density"] = val_str
            elif "s-cone density" in pname_str.lower():
                try:
                    metadata["scone_density"] = float(val_str)
                except:
                    metadata["scone_density"] = val_str
            elif "number of selected cones" in pname_str.lower():
                try:
                    metadata["numcones"] = int(float(val_str))
                except:
                    metadata["numcones"] = val_str
            elif "number of not classified cones" in pname_str.lower() or "number of not classified" in pname_str.lower():
                try:
                    metadata["nonclass_cones"] = int(float(val_str))
                except:
                    metadata["nonclass_cones"] = val_str
            elif pname_str.strip().lower().startswith("cone location origin"):
                metadata["cone_origin"] = str(val_str)
            elif "zernike coeffs pupil diameter" in pname_str.lower():
                try:
                    metadata["zernike_pupil_diam"] = float(val_str)
                except:
                    metadata["zernike_pupil_diam"] = val_str
            elif "zernike coeffs measured wavelength" in pname_str.lower():
                try:
                    metadata["zernike_measure_wave"] = float(val_str)
                except:
                    metadata["zernike_measure_wave"] = val_str
            elif "zernike coeffs optimized wavelength" in pname_str.lower():
                try:
                    metadata["zernike_optim_wave"] = float(val_str)
                except:
                    metadata["zernike_optim_wave"] = val_str
            else:
                metadata[pname_str] = val_str

    for k, v in metadata.items():
        block_cones[k] = v

    all_dfs.append(block_cones.reset_index(drop=True))
    i += 1

if len(all_dfs) == 0:
    raise ValueError("No cone blocks found! Check column names in AO file.")

combined = pd.concat(all_dfs, ignore_index=True, sort=False)

# ensure columns match sample order
target_cols = list(sample_fix.columns)
for c in target_cols:
    if c not in combined.columns:
        combined[c] = np.nan

combined = combined[target_cols + [c for c in combined.columns if c not in target_cols]]

combined.to_csv(out_path, index=False)
print("Saved:", out_path)
