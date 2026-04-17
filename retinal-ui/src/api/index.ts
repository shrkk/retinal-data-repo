// App.tsx or ConePlot.tsx
import type { PlotData, Patient } from '../types/index';


const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001";

export async function getPatients(): Promise<Patient[]> {
  try {
    const res = await fetch(`${API_BASE}/patients`);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  } catch (error) {
    console.error('Failed to fetch patients:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Failed to connect to API at ${API_BASE}. Make sure the backend server is running.`);
    }
    throw error;
  }
}

export async function getMetadata(
  subjectId: string,
  meridian: string,
  coneTypes?: string[],
  eccentricityMin?: number,
  eccentricityMax?: number,
  eye?: string
): Promise<Record<string, any>> {
  const params = new URLSearchParams();
  params.append("subject_id", subjectId);
  params.append("meridian", meridian);
  if (eye) params.append("eye", eye);

  if (coneTypes && coneTypes.length > 0) {
    coneTypes.forEach(type => params.append("cone_spectral_type", type));
  }
  if (eccentricityMin !== undefined) params.append("eccentricity_min", eccentricityMin.toString());
  if (eccentricityMax !== undefined) params.append("eccentricity_max", eccentricityMax.toString());

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
  eye?: string;
}): Promise<PlotData> {
  const params = new URLSearchParams();
  params.append("subject_id", filters.subjectId);
  params.append("meridian", filters.meridian);
  if (filters.eye) params.append("eye", filters.eye);
  filters.coneTypes.forEach((type) => params.append("cone_spectral_type", type));
  if (filters.eccentricityMin !== undefined) params.append("eccentricity_min", filters.eccentricityMin.toString());
  if (filters.eccentricityMax !== undefined) params.append("eccentricity_max", filters.eccentricityMax.toString());

  const res = await fetch(`${API_BASE}/plot-data?${params.toString()}&limit=50000`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export async function getSubjectsData(): Promise<Array<Record<string, any>>> {
  const res = await fetch(`${API_BASE}/subjects/data`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export interface UploadLogEntry {
  id: number;
  uploaded_at: string;
  subject_id: string | null;
  eye: string | null;
  event_type: string;
  commit_message: string | null;
  rows_ingested: number;
  uploaded_by: string | null;
}

export async function getUploadLog(): Promise<UploadLogEntry[]> {
  const res = await fetch(`${API_BASE}/upload-log`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export async function getEccentricityRanges(subjectId: string, meridian: string, eye?: string): Promise<{ ranges: Array<{ min: number; max: number; label: string }> }> {
  const params = new URLSearchParams();
  params.append("subject_id", subjectId);
  params.append("meridian", meridian);
  if (eye) params.append("eye", eye);

  const res = await fetch(`${API_BASE}/eccentricity-ranges?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export async function adminLogin(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    throw new Error("Invalid password");
  }
  const data = await res.json();
  return data.token as string;
}

export async function adminValidateCSV(
  token: string,
  file: File
): Promise<{ valid: boolean; row_count: number; subjects: string[]; meridians: string[]; cone_types: string[]; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/admin/validate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Validation failed" }));
    throw new Error(err.detail || "Validation failed");
  }
  return res.json();
}

export async function adminUploadCSV(
  token: string,
  file: File,
  commitMessage?: string,
  onProgress?: (msg: string) => void,
): Promise<{ queued: boolean; row_count: number; subjects: string[] }> {
  onProgress?.(`Uploading ${file.name}...`);
  const formData = new FormData();
  formData.append("file", file);
  if (commitMessage) formData.append("commit_message", commitMessage);

  const res = await fetch(`${API_BASE}/admin/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function downloadCSV(filters: {
  subjectId: string;
  meridian: string;
  coneTypes: string[];
  eccentricityMin?: number;
  eccentricityMax?: number;
  displayId?: string; // Optional display ID with R/L suffix
}) {
  try {
    // Check if Supabase is configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
    }

    // Lazy import Supabase only when needed
    const { getSupabaseClient } = await import('../lib/supabase');

    // Download CSV from Supabase storage bucket "raw-csvs"
    // File name uses displayId (with R/L suffix) if provided, otherwise falls back to subjectId
    const fileName = filters.displayId ? `${filters.displayId}.csv` : `${filters.subjectId}.csv`;
    const bucketName = 'raw-csvs';

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(fileName);

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data received from storage');
    }

    // Create a blob URL and trigger download
    // data is already a Blob from Supabase storage
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading CSV:", error);
    alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
