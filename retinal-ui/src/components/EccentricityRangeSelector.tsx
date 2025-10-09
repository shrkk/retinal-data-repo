import React, { useEffect, useState } from "react";
import { getEccentricityRanges } from "../api";
import type { EccentricityRange } from "../types";

interface EccentricityRangeSelectorProps {
  subjectId?: string;
  meridian?: string;
  selectedRanges: EccentricityRange[];
  onRangesChange: (ranges: EccentricityRange[]) => void;
}

export const EccentricityRangeSelector: React.FC<EccentricityRangeSelectorProps> = ({
  subjectId,
  meridian,
  selectedRanges,
  onRangesChange,
}) => {
  const [availableRanges, setAvailableRanges] = useState<EccentricityRange[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (subjectId && meridian) {
      setLoading(true);
      getEccentricityRanges(subjectId, meridian)
        .then((data) => {
          setAvailableRanges(data.ranges);
        })
        .catch((error) => {
          console.error("Error fetching eccentricity ranges:", error);
          setAvailableRanges([]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setAvailableRanges([]);
    }
  }, [subjectId, meridian]);

  const toggleRange = (range: EccentricityRange) => {
    const isSelected = selectedRanges.some(
      (r) => r.min === range.min && r.max === range.max
    );
    
    if (isSelected) {
      onRangesChange(selectedRanges.filter(
        (r) => !(r.min === range.min && r.max === range.max)
      ));
    } else {
      onRangesChange([...selectedRanges, range]);
    }
  };

  const selectAll = () => {
    onRangesChange([...availableRanges]);
  };

  const clearAll = () => {
    onRangesChange([]);
  };

  const getDisplayText = () => {
    if (selectedRanges.length === 0) {
      return "Select eccentricity ranges";
    }
    if (selectedRanges.length === availableRanges.length) {
      return "All ranges selected";
    }
    if (selectedRanges.length === 1) {
      return selectedRanges[0].label;
    }
    return `${selectedRanges.length} ranges selected`;
  };

  return (
    <div style={{ position: "relative", minWidth: "200px" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading || availableRanges.length === 0}
        style={{
          width: "100%",
          padding: "0.5rem",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
          cursor: loading || availableRanges.length === 0 ? "not-allowed" : "pointer",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>{loading ? "Loading..." : getDisplayText()}</span>
        <span style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          ▼
        </span>
      </button>

      {isOpen && availableRanges.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "0.5rem",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              gap: "0.5rem",
            }}
          >
            <button
              onClick={selectAll}
              style={{
                padding: "0.25rem 0.5rem",
                fontSize: "0.8rem",
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
                border: "none",
                borderRadius: "var(--radius)",
                cursor: "pointer",
              }}
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              style={{
                padding: "0.25rem 0.5rem",
                fontSize: "0.8rem",
                backgroundColor: "var(--secondary)",
                color: "var(--secondary-foreground)",
                border: "none",
                borderRadius: "var(--radius)",
                cursor: "pointer",
              }}
            >
              Clear All
            </button>
          </div>
          
          {availableRanges.map((range) => {
            const isSelected = selectedRanges.some(
              (r) => r.min === range.min && r.max === range.max
            );
            
            return (
              <label
                key={`${range.min}-${range.max}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.5rem",
                  cursor: "pointer",
                  backgroundColor: isSelected ? "var(--accent)" : "transparent",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "var(--muted)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleRange(range)}
                  style={{ marginRight: "0.5rem" }}
                />
                <span>{range.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};
