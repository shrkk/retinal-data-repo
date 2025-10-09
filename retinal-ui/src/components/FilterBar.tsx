import React, { useEffect, useState } from "react";
import type { Patient } from "../types";
import { getPatients } from "../api";

interface FilterBarProps {
  onChange: (filters: { subjectId: string; meridian: string; coneTypes: string[]; eccentricityMin?: number; eccentricityMax?: number }) => void;
  onDownload: () => void;
}

const MERIDIANS = ["Temporal", "Nasal", "Superior", "inferior"];
const CONE_TYPES = ["L", "M", "S"];

export const FilterBar: React.FC<FilterBarProps> = ({ onChange, onDownload }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [meridian, setMeridian] = useState(MERIDIANS[0]);
  const [coneTypes, setConeTypes] = useState<string[]>(["L"]);
  const [eccMin, setEccMin] = useState<number>();
  const [eccMax, setEccMax] = useState<number>();

  useEffect(() => {
    getPatients()
      .then(setPatients)
      .catch((error) => {
        console.error("Error fetching patients:", error);
      });
  }, []);

  useEffect(() => {
    if (subjectId && meridian && coneTypes.length > 0) {
      onChange({ subjectId, meridian, coneTypes, eccentricityMin: eccMin, eccentricityMax: eccMax });
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
          {patients.map((p) => (
            <option key={p.subject_id} value={p.subject_id}>{p.subject_id}</option>
          ))}
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

        <button onClick={onDownload} disabled={!subjectId || coneTypes.length === 0}>
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
          <strong>Download will include:</strong> {subjectId} | {meridian} | {coneTypes.join(", ")} cones
          {eccMin !== undefined && ` | Eccentricity: ${eccMin}°`}
          {eccMax !== undefined && ` - ${eccMax}°`}
        </div>
      )}
    </div>
  );
};
