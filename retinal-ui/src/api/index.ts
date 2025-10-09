// App.tsx or ConePlot.tsx
import type { PlotData, Patient } from '../types';


const API_BASE = "http://127.0.0.1:8000";

export async function getPatients(): Promise<Patient[]> {
  const res = await fetch(`${API_BASE}/patients`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export async function getMetadata(subjectId: string, meridian: string): Promise<Record<string, any>> {
  const params = new URLSearchParams();
  params.append("subject_id", subjectId);
  params.append("meridian", meridian);
  
  const res = await fetch(`${API_BASE}/metadata?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export async function getPlotData(filters: {
  subjectId: string;
  meridian: string;
  coneTypes: string[];
  eccentricityMin?: number;
  eccentricityMax?: number;
}): Promise<PlotData> {
  const params = new URLSearchParams();
  params.append("subject_id", filters.subjectId);
  params.append("meridian", filters.meridian);
  filters.coneTypes.forEach((type) => params.append("cone_spectral_type", type));
  if (filters.eccentricityMin !== undefined) params.append("eccentricity_min", filters.eccentricityMin.toString());
  if (filters.eccentricityMax !== undefined) params.append("eccentricity_max", filters.eccentricityMax.toString());

  const res = await fetch(`${API_BASE}/plot-data?${params.toString()}&limit=2000`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export async function getEccentricityRanges(subjectId: string, meridian: string): Promise<{ ranges: Array<{ min: number; max: number; label: string }> }> {
  const params = new URLSearchParams();
  params.append("subject_id", subjectId);
  params.append("meridian", meridian);
  
  const res = await fetch(`${API_BASE}/eccentricity-ranges?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export function downloadCSV(filters: {
  subjectId: string;
  meridian: string;
  coneTypes: string[];
  eccentricityMin?: number;
  eccentricityMax?: number;
}) {
  try {
    const params = new URLSearchParams();
    params.append("subject_id", filters.subjectId);
    params.append("meridian", filters.meridian);
    filters.coneTypes.forEach((type) => params.append("cone_spectral_type", type));
    if (filters.eccentricityMin !== undefined) params.append("eccentricity_min", filters.eccentricityMin.toString());
    if (filters.eccentricityMax !== undefined) params.append("eccentricity_max", filters.eccentricityMax.toString());

    const url = `${API_BASE}/cones/export?${params.toString()}`;
    
    const link = document.createElement("a");
    link.href = url;
    link.download = ""; // Let the server set the filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Error downloading CSV:", error);
    alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
