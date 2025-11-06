import React from "react";
import Plot from "react-plotly.js";
import type { PlotData, Metadata } from "../types/index";

interface ConePlotProps {
  data: PlotData | null;
  metadata?: Metadata;
}

const COLOR_MAP: Record<string, string> = {
  L: "red",
  M: "green",
  S: "blue",
};

export const ConePlot: React.FC<ConePlotProps> = ({ data, metadata }) => {
  if (!data || data.x.length === 0) return <p>No data to display</p>;

  // Group by cone type for coloring
  const traces = Array.from(new Set(data.cone_type)).map((type) => {
    const indices = data.cone_type
      .map((t, i) => (t === type ? i : -1))
      .filter((i) => i !== -1);
    return {
      x: indices.map((i) => data.x[i]),
      y: indices.map((i) => data.y[i]),
      mode: "markers" as const,
      type: "scatter" as const,
      name: type,
      marker: { 
        color: COLOR_MAP[type],
        size: 9,
        line: {
          width: 0.5,
          color: "rgba(0,0,0,0.1)"
        }
      },
    };
  });

  return (
    <div style={{ 
      width: "100%", 
      display: "flex", 
      flexDirection: "column",
      alignItems: "center",
      backgroundColor: "var(--card)",
      borderRadius: "var(--radius)",
      padding: "1rem",
      border: "1px solid var(--border)",
      boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
    }}>
      {/* Plot area with embedded data summary */}
      <div style={{ position: "relative", width: "100%" }}>
        <Plot
          data={traces}
          layout={{
            title: { text: "Cone Positions" },
            height: 600,
            width: Math.min(800, window.innerWidth - 200),
            margin: { l: 50, r: 20, t: 40, b: 50 },
            paper_bgcolor: "transparent",
            plot_bgcolor: "transparent",
            showlegend: false,
            font: { 
              color: "var(--foreground)",
              family: '"Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            },
            xaxis: { 
              title: { text: "X (microns)" },
              color: "var(--foreground)",
              gridcolor: "var(--border)",
              scaleanchor: "y",
              scaleratio: 1,
              range: [Math.min(...data.x) - 2, Math.max(...data.x) + 2]
            },
            yaxis: { 
              title: { text: "Y (microns)" },
              color: "var(--foreground)",
              gridcolor: "var(--border)",
              scaleanchor: "x",
              scaleratio: 1,
              range: [Math.min(...data.y) - 2, Math.max(...data.y) + 2]
            }
          }}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false
          }}
        />
        
        {/* Data Summary - Overlay within plot */}
        {metadata && (
          <div style={{
            position: "absolute",
            top: "60px",
            right: "20px",
            padding: "0.75rem",
            backgroundColor: "rgba(247, 241, 241, 0.95)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            minWidth: "200px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            backdropFilter: "blur(4px)"
          }}>
            {/* Cone Types Section */}
            <div style={{ marginBottom: "1rem" }}>
              <h4 style={{ 
                margin: "0 0 0.5rem 0", 
                fontSize: "0.9rem", 
                fontWeight: "600",
                color: "var(--foreground)"
              }}>
                Cone Types (Filtered)
              </h4>
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.8rem"
              }}>
                {Array.from(new Set(data.cone_type)).map((type) => {
                  const count = data.cone_type.filter(t => t === type).length;
                  return (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: COLOR_MAP[type],
                        borderRadius: "50%",
                        border: "1px solid rgba(0,0,0,0.1)"
                      }}></div>
                      <span style={{ color: "var(--muted-foreground)" }}>{type}: {count}</span>
                    </div>
                  );
                })}
                <div style={{ 
                  marginTop: "0.25rem", 
                  paddingTop: "0.25rem", 
                  borderTop: "1px solid var(--border)",
                  fontWeight: "600",
                  color: "var(--foreground)"
                }}>
                  Total: {data.cone_type.length}
                </div>
              </div>
            </div>

            {/* Data Summary Section */}
            <div>
              <h4 style={{ 
                margin: "0 0 0.5rem 0", 
                fontSize: "0.9rem", 
                fontWeight: "600",
                color: "var(--foreground)"
              }}>
                Data Summary
              </h4>
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                fontSize: "0.8rem",
                color: "var(--muted-foreground)"
              }}>
                {metadata.eye_description && (
                  <div><strong>Eye:</strong> {metadata.eye_description}</div>
                )}
                {metadata.fov && (
                  <div><strong>FOV:</strong> {metadata.fov}</div>
                )}
                {metadata.lm_ratio && (
                  <div><strong>L/M Ratio:</strong> {metadata.lm_ratio}</div>
                )}
                {metadata.scones && (
                  <div><strong>S Cones:</strong> {metadata.scones}</div>
                )}
                {metadata.lcone_density && (
                  <div><strong>L Cone Density:</strong> {metadata.lcone_density.toFixed(0)}</div>
                )}
                {metadata.mcone_density && (
                  <div><strong>M Cone Density:</strong> {metadata.mcone_density.toFixed(0)}</div>
                )}
                {metadata.scone_density && (
                  <div><strong>S Cone Density:</strong> {metadata.scone_density.toFixed(0)}</div>
                )}
                {metadata.numcones && (
                  <div><strong>Total Cones (All):</strong> {metadata.numcones}</div>
                )}
                {metadata.filtered_total_cones !== undefined && (
                  <div style={{ 
                    marginTop: "0.25rem", 
                    paddingTop: "0.25rem", 
                    borderTop: "1px solid var(--border)",
                    fontWeight: "600",
                    color: "var(--foreground)"
                  }}>
                    <strong>Filtered Total:</strong> {metadata.filtered_total_cones}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
