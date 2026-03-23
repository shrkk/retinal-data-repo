"""CSV parsing logic for admin uploads — adapted from load_data.py."""
import io
import math
import re

import numpy as np
import pandas as pd


def parse_tuple(s):
    if pd.isna(s):
        return np.nan, np.nan
    s = str(s).strip()
    m = re.search(r"\(?\s*([-+]?[0-9]*\.?[0-9]+)\s*,\s*([-+]?[0-9]*\.?[0-9]+)\s*\)?", s)
    if m:
        return float(m.group(1)), float(m.group(2))
    parts = re.split(r"[ ,;xX]+", s.replace("(", "").replace(")", ""))
    try:
        return float(parts[0]), float(parts[1]) if len(parts) > 1 else 0.0
    except Exception:
        return np.nan, np.nan


def safe_float(v):
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except Exception:
        return None


def safe_int(v):
    try:
        return int(float(v))
    except Exception:
        return None


def parse_csv_bytes(content: bytes) -> pd.DataFrame:
    ao = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
    cols = ao.columns.tolist()

    param_cols = [c for c in cols if c.startswith("Parameter_Name")]
    values_cols = [c for c in cols if c.startswith("Values")]
    nonempty_values = [v for v in values_cols if ao[v].dropna().shape[0] > 0]
    col_index = {c: i for i, c in enumerate(cols)}

    param_to_values = {}
    for p in param_cols:
        if not nonempty_values:
            continue
        pidx = col_index[p]
        best = min(nonempty_values, key=lambda v: abs(col_index[v] - pidx))
        param_to_values[p] = best

    all_dfs = []
    i = 0
    while True:
        suffix = "" if i == 0 else f".{i}"
        x_col = f"Cone x location (microns){suffix}"
        y_col = f"Cone y location (microns){suffix}"
        t_col = f"Cone spectral type{suffix}"
        if x_col not in ao.columns:
            break

        block = ao[[x_col, y_col, t_col]].copy()
        block.columns = ["cone_x_microns", "cone_y_microns", "cone_spectral_type"]
        block = block.dropna(how="all", subset=["cone_x_microns", "cone_y_microns", "cone_spectral_type"])
        if block.empty:
            i += 1
            continue

        param_col = "Parameter_Name" if i == 0 else f"Parameter_Name.{i}"
        values_col = param_to_values.get(param_col)
        metadata = {}

        if values_col:
            for idx, pname in ao[param_col].fillna("").items():
                pname = str(pname).strip()
                if not pname:
                    continue
                pval = ao[values_col].iloc[idx] if values_col in ao.columns else np.nan
                v = pval if pd.notna(pval) else ""
                pl = pname.lower()

                if pl.startswith("subject id"):
                    metadata["subject_id"] = str(v)
                elif "age (years)" in pl:
                    metadata["age"] = safe_float(v)
                elif pl.startswith("eye"):
                    metadata["eye"] = str(v)
                elif "meridian" in pl:
                    metadata["meridian"] = str(v)
                elif "eccentricity (x,y) (deg)" in pl:
                    x, y = parse_tuple(v)
                    metadata["eccentricity_deg"] = safe_float(math.hypot(x, y)) if not (math.isnan(x) or math.isnan(y)) else None
                elif "eccentricity (x,y) (mm)" in pl:
                    x, y = parse_tuple(v)
                    metadata["eccentricity_mm"] = safe_float(math.hypot(x, y)) if not (math.isnan(x) or math.isnan(y)) else None
                elif "retinal ma" in pl:
                    metadata["ret_mag_factor"] = safe_float(v)
                elif pl.startswith("fov"):
                    metadata["fov"] = str(v)
                elif "l/m" in pl:
                    metadata["lm_ratio"] = safe_float(v)
                elif "% s-cones" in pl or pl.startswith("s-cones"):
                    metadata["scones"] = safe_float(v)
                elif "l-cone density" in pl:
                    metadata["lcone_density"] = safe_float(v)
                elif "m-cone density" in pl:
                    metadata["mcone_density"] = safe_float(v)
                elif "s-cone density" in pl:
                    metadata["scone_density"] = safe_float(v)
                elif "number of selected cones" in pl:
                    metadata["numcones"] = safe_int(v)
                elif "number of not classified" in pl:
                    metadata["nonclass_cones"] = safe_int(v)
                elif "cone location origin" in pl:
                    metadata["cone_origin"] = str(v)
                elif "zernike coeffs pupil diameter" in pl:
                    metadata["zernike_pupil_diam"] = safe_float(v)
                elif "zernike coeffs measured wavelength" in pl:
                    metadata["zernike_measure_wave"] = safe_float(v)
                elif "zernike coeffs optimized wavelength" in pl:
                    metadata["zernike_optim_wave"] = safe_float(v)

        for k, val in metadata.items():
            block[k] = val

        all_dfs.append(block.reset_index(drop=True))
        i += 1

    if not all_dfs:
        return pd.DataFrame()

    return pd.concat(all_dfs, ignore_index=True)


def to_row(r) -> tuple:
    def f(col):
        v = r.get(col)
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return None
        return v

    return (
        safe_float(f("cone_x_microns")),
        safe_float(f("cone_y_microns")),
        str(f("cone_spectral_type")) if f("cone_spectral_type") is not None else None,
        str(f("subject_id")) if f("subject_id") is not None else "UNKNOWN",
        str(f("eye")) if f("eye") is not None else None,
        str(f("meridian")) if f("meridian") is not None else None,
        safe_float(f("eccentricity_deg")),
        safe_float(f("eccentricity_mm")),
        safe_float(f("lm_ratio")),
        safe_float(f("scones")),
        safe_float(f("lcone_density")),
        safe_float(f("mcone_density")),
        safe_float(f("scone_density")),
        safe_int(f("numcones")),
        safe_int(f("nonclass_cones")),
        safe_float(f("age")),
        str(f("fov")) if f("fov") is not None else None,
        safe_float(f("ret_mag_factor")),
        str(f("cone_origin")) if f("cone_origin") is not None else None,
        safe_float(f("zernike_pupil_diam")),
        safe_float(f("zernike_measure_wave")),
        safe_float(f("zernike_optim_wave")),
    )
