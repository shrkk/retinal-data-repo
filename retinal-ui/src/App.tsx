import React, { useState } from "react";
import { FilterBar } from "./components/FilterBar";
import { ConePlot } from "./components/ConePlot";
import { ModeToggle } from "./components/mode-toggle";
import { ThemeProvider } from "./components/theme-provider";
import { getPlotData, downloadCSV, getMetadata } from "./api";
import type { PlotData, Metadata } from "./types";

const App: React.FC = () => {
  const [plotData, setPlotData] = useState<PlotData | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [filters, setFilters] = useState<any>(null);

  const handleFilterChange = async (newFilters: any) => {
    setFilters(newFilters);
    try {
      const [data, meta] = await Promise.all([
        getPlotData(newFilters),
        getMetadata(newFilters.subjectId, newFilters.meridian)
      ]);
      setPlotData(data);
      setMetadata(meta);
    } catch (error) {
      console.error("Error fetching data:", error);
      setPlotData(null);
      setMetadata(null);
    }
  };

  const handleDownload = () => {
    if (filters) {
      downloadCSV(filters);
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
        <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: "600" }}>Retinal Cones Viewer</h1>
        <ModeToggle />
      </div>
      
      <div style={{ width: "100%", maxWidth: "1000px", marginBottom: "2rem" }}>
        <FilterBar onChange={handleFilterChange} onDownload={handleDownload} />
      </div>
      
      <div style={{ 
        width: "100%", 
        maxWidth: "1000px",
        display: "flex",
        justifyContent: "center"
      }}>
        <ConePlot data={plotData} metadata={metadata} />
      </div>
    </div>
  );
};

export default App;
