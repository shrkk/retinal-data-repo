import React, { useEffect, useState } from "react";
import type { Patient } from "../types/index";
import { getPatients } from "../api";

interface FilterBarProps {
  onChange: (filters: { subjectId: string; meridian: string; coneTypes: string[]; eccentricityMin?: number; eccentricityMax?: number }) => void;
  onDownload: (displayId: string) => void;
  useSubPlots?: boolean;
}

const MERIDIANS = ["temporal", "nasal", "superior", "inferior"];
const CONE_TYPES = ["L", "M", "S"];

export const FilterBar: React.FC<FilterBarProps> = ({ onChange, onDownload, useSubPlots = false }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [meridian, setMeridian] = useState(MERIDIANS[0]);
  const [coneTypes, setConeTypes] = useState<string[]>(["L"]);
  const [eccMin, setEccMin] = useState<number>();
  const [eccMax, setEccMax] = useState<number>();
  
  // Helper function to get display ID with eye suffix
  const getDisplayId = (patient: Patient): string => {
    const eyeSuffix = patient.eye === 'OD' ? 'R' : patient.eye === 'OS' ? 'L' : '';
    return `${patient.subject_id}${eyeSuffix}`;
  };

  // Helper function to parse display ID back to base subject_id
  const parseSubjectId = (displayId: string): string => {
    // Remove trailing R or L if present
    return displayId.replace(/[RL]$/, '');
  };

  // Get the selected patient's eye information
  const selectedPatient = patients.find(p => {
    const baseId = parseSubjectId(subjectId);
    return p.subject_id === baseId;
  });

  useEffect(() => {
    getPatients()
      .then((data) => {
        console.log("Patients fetched:", data);
        if (Array.isArray(data) && data.length > 0) {
          setPatients(data);
        } else {
          console.warn("No patients returned from API");
        }
      })
      .catch((error) => {
        console.error("Error fetching patients:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error("Full error details:", error);
        alert(`Failed to load patients: ${errorMessage}\n\nCheck browser console for details.`);
      });
  }, []);

  useEffect(() => {
    if (subjectId && meridian && coneTypes.length > 0) {
      // Convert display ID (with R/L suffix) back to base subject_id for API calls
      const baseSubjectId = parseSubjectId(subjectId);
      onChange({ subjectId: baseSubjectId, meridian, coneTypes, eccentricityMin: eccMin, eccentricityMax: eccMax });
    }
  }, [subjectId, meridian, coneTypes, eccMin, eccMax]);

  const toggleConeType = (type: string) => {
    setConeTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ 
        display: "flex", 
        gap: "1rem", 
        marginBottom: "1rem", 
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center"
      }}>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select Subject</option>
          {patients.map((p) => {
            const displayId = getDisplayId(p);
            return (
              <option key={`${p.subject_id}-${p.eye}`} value={displayId}>{displayId}</option>
            );
          })}
        </select>

        <select value={meridian} onChange={(e) => setMeridian(e.target.value)}>
          {MERIDIANS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {CONE_TYPES.map((type) => (
            <label key={type} style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "0.25rem",
              cursor: "pointer"
            }}>
              <input 
                type="checkbox" 
                checked={coneTypes.includes(type)} 
                onChange={() => toggleConeType(type)}
                style={{ margin: 0 }}
              />
              {type}
            </label>
          ))}
        </div>

        {!useSubPlots && (
          <>
            <input 
              type="number" 
              placeholder="Ecc min" 
              value={eccMin ?? ""} 
              onChange={(e) => setEccMin(e.target.valueAsNumber)}
              style={{ width: "100px" }}
            />
            <input 
              type="number" 
              placeholder="Ecc max" 
              value={eccMax ?? ""} 
              onChange={(e) => setEccMax(e.target.valueAsNumber)}
              style={{ width: "100px" }}
            />
          </>
        )}

        <button onClick={() => onDownload(subjectId)} disabled={!subjectId || coneTypes.length === 0}>
          Download CSV
        </button>
      </div>
      
      {subjectId && (
        <div style={{ 
          fontSize: "0.9rem", 
          color: "var(--muted-foreground)", 
          marginBottom: "1rem",
          padding: "0.75rem",
          backgroundColor: "var(--muted)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)"
        }}>
          <strong>Download will include:</strong> {subjectId} {selectedPatient?.eye_description && `(${selectedPatient.eye_description})`} | {meridian} | {coneTypes.join(", ")} cones
          {!useSubPlots && eccMin !== undefined && ` | Eccentricity: ${eccMin}°`}
          {!useSubPlots && eccMax !== undefined && ` - ${eccMax}°`}
          {useSubPlots && " | All eccentricity ranges"}
          <br />
        </div>
      )}
    </div>
  );
};
