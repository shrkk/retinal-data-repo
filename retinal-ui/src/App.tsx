import React, { useState } from "react";
import { FilterBar } from "./components/FilterBar";
import { EccentricitySubPlots } from "./components/EccentricitySubPlots";
import { ModeToggle } from "./components/mode-toggle";
import { ThemeProvider } from "./components/theme-provider";
import { downloadCSV } from "./api";

const App: React.FC = () => {
  const [filters, setFilters] = useState<any>(null);

  const handleFilterChange = async (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleDownload = async (displayId: string) => {
    if (filters && displayId) {
      // Use the displayId (with R/L suffix) for the filename
      await downloadCSV({ ...filters, displayId });
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "2rem 1rem",
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
      <div style={{ 
        width: "100%",
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "2rem",
        maxWidth: "1000px"
      }}>
        <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: "600" }}>SabLab: Retinal Cones Viewer</h1>
        <ModeToggle />
      </div>
      
      <div style={{ width: "100%", maxWidth: "1000px", marginBottom: "2rem" }}>
        <FilterBar onChange={handleFilterChange} onDownload={handleDownload} useSubPlots={true} />
      </div>
      
      <div style={{ 
        width: "100%", 
        maxWidth: "1200px",
        display: "flex",
        justifyContent: "center"
      }}>
        {filters ? (
          <EccentricitySubPlots 
            subjectId={filters.subjectId}
            meridian={filters.meridian}
            coneTypes={filters.coneTypes}
          />
        ) : (
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            height: "400px",
            backgroundColor: "var(--card)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)"
          }}>
            <div>Please select filters to view retinal cone data</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
