import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import type { PlotData, Metadata, EccentricityRange } from "../types/index";
import { getPlotData, getMetadata, getEccentricityRanges } from "../api";

interface EccentricitySubPlotsProps {
  subjectId: string;
  meridian: string;
  coneTypes: string[];
}

interface SubPlotData {
  range: EccentricityRange;
  data: PlotData | null;
  metadata: Metadata | null;
  loading: boolean;
  error: string | null;
}

const COLOR_MAP: Record<string, string> = {
  L: "red",
  M: "green",
  S: "blue",
};

export const EccentricitySubPlots: React.FC<EccentricitySubPlotsProps> = ({ 
  subjectId, 
  meridian, 
  coneTypes 
}) => {
  const [subPlots, setSubPlots] = useState<SubPlotData[]>([]);
  const [selectedRange, setSelectedRange] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectId || !meridian || coneTypes.length === 0) {
      setSubPlots([]);
      setLoading(false);
      return;
    }

    const fetchSubPlots = async () => {
      setLoading(true);
      try {
        // Get eccentricity ranges
        const rangesResponse = await getEccentricityRanges(subjectId, meridian);
        const ranges = rangesResponse.ranges;

        if (ranges.length === 0) {
          setSubPlots([]);
          setLoading(false);
          return;
        }

        // Initialize sub-plots
        const initialSubPlots: SubPlotData[] = ranges.map(range => ({
          range,
          data: null,
          metadata: null,
          loading: true,
          error: null
        }));

        setSubPlots(initialSubPlots);

        // Fetch data for each range
        const fetchPromises = ranges.map(async (range, index) => {
          try {
            const [data, metadata] = await Promise.all([
              getPlotData({
                subjectId,
                meridian,
                coneTypes,
                eccentricityMin: range.min,
                eccentricityMax: range.max
              }),
              getMetadata(
                subjectId,
                meridian,
                coneTypes,
                range.min,
                range.max
              )
            ]);

            return { index, data, metadata, error: null };
          } catch (error) {
            return { 
              index, 
              data: null, 
              metadata: null, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            };
          }
        });

        const results = await Promise.all(fetchPromises);

        // Update sub-plots with results
        setSubPlots(prev => prev.map((subPlot, index) => {
          const result = results.find(r => r.index === index);
          if (result) {
            return {
              ...subPlot,
              data: result.data,
              metadata: result.metadata,
              loading: false,
              error: result.error
            };
          }
          return subPlot;
        }));

      } catch (error) {
        console.error("Error fetching eccentricity ranges:", error);
        setSubPlots([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSubPlots();
  }, [subjectId, meridian, coneTypes]);

  const renderSinglePlot = (subPlot: SubPlotData) => {
    if (subPlot.loading) {
      return (
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          height: "400px",
          backgroundColor: "var(--card)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)"
        }}>
          <div>Loading {subPlot.range.label}...</div>
        </div>
      );
    }

    if (subPlot.error) {
      return (
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          height: "400px",
          backgroundColor: "var(--card)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          color: "var(--destructive)"
        }}>
          <div>Error loading {subPlot.range.label}: {subPlot.error}</div>
        </div>
      );
    }

    if (!subPlot.data || subPlot.data.x.length === 0) {
      return (
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          alignItems: "center", 
          height: "400px",
          backgroundColor: "var(--card)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)"
        }}>
          <div>No data for {subPlot.range.label}</div>
        </div>
      );
    }

    // Group by cone type for coloring
    const traces = Array.from(new Set(subPlot.data.cone_type)).map((type) => {
      const indices = subPlot.data!.cone_type
        .map((t, i) => (t === type ? i : -1))
        .filter((i) => i !== -1);
      return {
        x: indices.map((i) => subPlot.data!.x[i]),
        y: indices.map((i) => subPlot.data!.y[i]),
        mode: "markers" as const,
        type: "scatter" as const,
        name: type,
        marker: { 
          color: COLOR_MAP[type],
          size: 8,
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
        <div style={{ position: "relative", width: "100%" }}>
          <Plot
            data={traces}
            layout={{
              title: { text: `Cone Positions - ${subPlot.range.label}` },
              height: 500,
              width: Math.min(700, window.innerWidth - 200),
              margin: { l: 50, r: 20, t: 40, b: 50 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              showlegend: false,
              font: { 
                color: "var(--foreground)",
                family: '"Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              },
            xaxis: { 
              title: { text: "" },
              showticklabels: false,
              color: "var(--foreground)",
              gridcolor: "var(--border)",
              scaleanchor: "y",
              scaleratio: 1,
              range: [Math.min(...subPlot.data.x) - 2, Math.max(...subPlot.data.x) + 2]
            },
            yaxis: { 
              title: { text: "" },
              showticklabels: false,
              color: "var(--foreground)",
              gridcolor: "var(--border)",
              scaleanchor: "x",
              scaleratio: 1,
              range: [Math.min(...subPlot.data.y) - 2, Math.max(...subPlot.data.y) + 2]
            }
            }}
            config={{
              responsive: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
              displaylogo: false
            }}
          />
          
          {/* Scale Bar */}
          <div style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.5rem 0.75rem",
            backgroundColor: "rgba(247, 241, 241, 0.95)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            backdropFilter: "blur(4px)"
          }}>
            <div style={{
              width: "120px",
              height: "3px",
              backgroundColor: "var(--foreground)",
              borderRadius: "1px"
            }}></div>
            <div style={{
              fontSize: "0.75rem",
              color: "var(--foreground)",
              fontWeight: "600",
              textAlign: "center"
            }}>
              100 μm
            </div>
          </div>

          {/* Data Summary - Overlay within plot */}
          {subPlot.metadata && (
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
              {/* Range Info */}
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ 
                  margin: "0 0 0.5rem 0", 
                  fontSize: "0.9rem", 
                  fontWeight: "600",
                  color: "var(--foreground)"
                }}>
                  Eccentricity Range
                </h4>
                <div style={{
                  fontSize: "0.8rem",
                  color: "var(--muted-foreground)"
                }}>
                  {subPlot.range.min.toFixed(1)}° - {subPlot.range.max.toFixed(1)}°
                </div>
              </div>

              {/* Cone Types Section */}
              <div style={{ marginBottom: "1rem" }}>
                <h4 style={{ 
                  margin: "0 0 0.5rem 0", 
                  fontSize: "0.9rem", 
                  fontWeight: "600",
                  color: "var(--foreground)"
                }}>
                  Cone Types
                </h4>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                  fontSize: "0.8rem"
                }}>
                  {Array.from(new Set(subPlot.data.cone_type)).map((type) => {
                    const count = subPlot.data.cone_type.filter(t => t === type).length;
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
                    Total: {subPlot.data.cone_type.length}
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
                  Summary
                </h4>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                  fontSize: "0.8rem",
                  color: "var(--muted-foreground)"
                }}>
                  {subPlot.metadata.eye_description && (
                    <div><strong>Eye:</strong> {subPlot.metadata.eye_description}</div>
                  )}
                  {subPlot.metadata.fov && (
                    <div><strong>FOV:</strong> {subPlot.metadata.fov}</div>
                  )}
                  {subPlot.metadata.lm_ratio && (
                    <div><strong>L/M Ratio:</strong> {subPlot.metadata.lm_ratio}</div>
                  )}
                  {subPlot.metadata.scones && (
                    <div><strong>S Cones:</strong> {subPlot.metadata.scones}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "400px",
        backgroundColor: "var(--card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)"
      }}>
        <div>Loading eccentricity ranges...</div>
      </div>
    );
  }

  if (subPlots.length === 0) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "400px",
        backgroundColor: "var(--card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)"
      }}>
        <div>No eccentricity ranges found for the selected filters</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      {/* View Controls */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "1rem",
        padding: "0.75rem",
        backgroundColor: "var(--card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)"
      }}>
        <div style={{ fontSize: "0.9rem", color: "var(--muted-foreground)" }}>
          {subPlots.length} eccentricity range{subPlots.length !== 1 ? 's' : ''} found
        </div>
        
        <div style={{ fontSize: "0.9rem", color: "var(--muted-foreground)" }}>
          Viewing: {subPlots[selectedRange]?.range.label || 'Loading...'}
        </div>
      </div>

      {/* Range Navigation */}
      <div style={{ 
        display: "flex", 
        gap: "0.5rem", 
        marginBottom: "1rem",
        flexWrap: "wrap",
        justifyContent: "center"
      }}>
        {subPlots.map((_, index) => (
          <button
            key={index}
            onClick={() => setSelectedRange(index)}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: selectedRange === index ? "var(--primary)" : "var(--muted)",
              color: selectedRange === index ? "var(--primary-foreground)" : "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              fontSize: "0.8rem"
            }}
          >
            {subPlots[index].range.label}
          </button>
        ))}
      </div>

      {/* Plot */}
      <div>
        {renderSinglePlot(subPlots[selectedRange])}
      </div>
    </div>
  );
};
