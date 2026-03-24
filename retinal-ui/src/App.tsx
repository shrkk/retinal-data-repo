import React, { useState } from "react";
import { FilterBar } from "./components/FilterBar";
import { EccentricitySubPlots } from "./components/EccentricitySubPlots";
import { AdminPage } from "./components/AdminPage";
import { Navbar } from "./components/Navbar";
import { UpdatesPage } from "./components/UpdatesPage";
import { downloadCSV } from "./api";

const App: React.FC = () => {
  const [filters, setFilters] = useState<any>(null);
  const [view, setView] = useState<"main" | "admin" | "updates">("main");

  const handleFilterChange = async (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleDownload = async (displayId: string) => {
    if (filters && displayId) {
      await downloadCSV({ ...filters, displayId });
    }
  };

  return (
    <>
      <Navbar view={view} onNavigate={setView} />
      <div style={{ paddingTop: "56px" }}>
        {view === "admin" && <AdminPage onBack={() => setView("main")} />}
        {view === "updates" && <UpdatesPage />}
        {view === "main" && (
          <div style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "2rem 1rem",
            maxWidth: "1200px",
            margin: "0 auto",
          }}>
            <div style={{ width: "100%", maxWidth: "1000px", marginBottom: "2rem" }}>
              <FilterBar
                onChange={handleFilterChange}
                onDownload={handleDownload}
                useSubPlots={true}
              />
            </div>

            <div style={{
              width: "100%",
              maxWidth: "1200px",
              display: "flex",
              justifyContent: "center",
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
                  border: "1px solid var(--border)",
                }}>
                  <div>Please select filters to view retinal cone data</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default App;
