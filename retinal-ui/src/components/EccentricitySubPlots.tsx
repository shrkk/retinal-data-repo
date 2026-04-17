import React, { useState, useEffect, useMemo } from "react";
import Plot from "react-plotly.js";
import type { PlotData, Metadata, EccentricityRange } from "../types/index";
import { getPlotData, getMetadata, getEccentricityRanges } from "../api";

interface EccentricitySubPlotsProps {
  subjectId: string;
  meridian: string;
  coneTypes: string[];
  eye?: string;
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

// Pick a human-friendly scale bar length given the visible axis span (in microns).
// Returns a value that is ~20-30% of the span, rounded to a 1/2/5 * 10^n form.
function pickScaleBarMicrons(spanMicrons: number): number {
  if (!isFinite(spanMicrons) || spanMicrons <= 0) return 100;
  const target = spanMicrons * 0.25;
  const pow10 = Math.pow(10, Math.floor(Math.log10(target)));
  const mantissa = target / pow10;
  let nice: number;
  if (mantissa < 1.5) nice = 1;
  else if (mantissa < 3.5) nice = 2;
  else if (mantissa < 7.5) nice = 5;
  else nice = 10;
  return nice * pow10;
}

function formatScaleLabel(micronValue: number): string {
  if (micronValue >= 1000) return `${(micronValue / 1000).toFixed(micronValue % 1000 === 0 ? 0 : 1)} mm`;
  if (micronValue >= 1) return `${micronValue % 1 === 0 ? micronValue.toFixed(0) : micronValue.toFixed(1)} μm`;
  return `${micronValue.toFixed(2)} μm`;
}

interface PlotRangeState {
  xRange: [number, number];
  yRange: [number, number];
  plotWidthPx: number;
}

const SinglePlot: React.FC<{ subPlot: SubPlotData }> = ({ subPlot }) => {
  // Compute data bounds & default zoom that shows all cones with padding.
  const bounds = useMemo(() => {
    if (!subPlot.data || subPlot.data.x.length === 0) return null;
    const xs = subPlot.data.x;
    const ys = subPlot.data.y;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    // 10% padding on each side so all cones are comfortably visible.
    const padX = spanX * 0.1;
    const padY = spanY * 0.1;
    return {
      xRange: [minX - padX, maxX + padX] as [number, number],
      yRange: [minY - padY, maxY + padY] as [number, number],
      spanX: spanX + 2 * padX,
      spanY: spanY + 2 * padY,
    };
  }, [subPlot.data]);

  const plotWidth = Math.min(700, typeof window !== "undefined" ? window.innerWidth - 200 : 700);
  const plotHeight = 500;

  const [viewRange, setViewRange] = useState<PlotRangeState | null>(null);

  // Reset the view range when data changes.
  useEffect(() => {
    if (bounds) {
      setViewRange({ xRange: bounds.xRange, yRange: bounds.yRange, plotWidthPx: plotWidth });
    }
  }, [bounds, plotWidth]);

  if (subPlot.loading) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        height: "400px", backgroundColor: "var(--card)", borderRadius: "var(--radius)",
        border: "1px solid var(--border)"
      }}>
        <div>Loading {subPlot.range.label}...</div>
      </div>
    );
  }

  if (subPlot.error) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        height: "400px", backgroundColor: "var(--card)", borderRadius: "var(--radius)",
        border: "1px solid var(--border)", color: "var(--destructive)"
      }}>
        <div>Error loading {subPlot.range.label}: {subPlot.error}</div>
      </div>
    );
  }

  if (!subPlot.data || subPlot.data.x.length === 0 || !bounds) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        height: "400px", backgroundColor: "var(--card)", borderRadius: "var(--radius)",
        border: "1px solid var(--border)"
      }}>
        <div>No data for {subPlot.range.label}</div>
      </div>
    );
  }

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
        size: 6,
        line: { width: 0.5, color: "rgba(0,0,0,0.1)" },
      },
    };
  });

  // Compute dynamic scale bar based on current view range.
  const activeXRange = viewRange?.xRange ?? bounds.xRange;
  const activeYRange = viewRange?.yRange ?? bounds.yRange;
  const xSpan = Math.abs(activeXRange[1] - activeXRange[0]);
  const ySpan = Math.abs(activeYRange[1] - activeYRange[0]);

  // With scaleanchor + constrain:'domain', the true visible plot area
  // preserves 1:1 aspect. Effective pixel-per-micron is limited by
  // whichever axis fits the plot box more tightly.
  const pxPerMicronByX = plotWidth / xSpan;
  const pxPerMicronByY = plotHeight / ySpan;
  const pxPerMicron = Math.min(pxPerMicronByX, pxPerMicronByY);
  const scaleMicrons = pickScaleBarMicrons(xSpan);
  const scaleBarPx = Math.max(20, Math.min(plotWidth * 0.4, scaleMicrons * pxPerMicron));

  const handleRelayout = (evt: any) => {
    // Plotly emits keys like 'xaxis.range[0]' / 'xaxis.range[1]' on zoom/pan
    // and 'xaxis.autorange' on reset.
    const nextX: [number, number] = [...(viewRange?.xRange ?? bounds.xRange)] as [number, number];
    const nextY: [number, number] = [...(viewRange?.yRange ?? bounds.yRange)] as [number, number];
    let changed = false;

    if (evt["xaxis.range[0]"] !== undefined) { nextX[0] = Number(evt["xaxis.range[0]"]); changed = true; }
    if (evt["xaxis.range[1]"] !== undefined) { nextX[1] = Number(evt["xaxis.range[1]"]); changed = true; }
    if (evt["yaxis.range[0]"] !== undefined) { nextY[0] = Number(evt["yaxis.range[0]"]); changed = true; }
    if (evt["yaxis.range[1]"] !== undefined) { nextY[1] = Number(evt["yaxis.range[1]"]); changed = true; }
    if (Array.isArray(evt["xaxis.range"])) {
      nextX[0] = Number(evt["xaxis.range"][0]);
      nextX[1] = Number(evt["xaxis.range"][1]);
      changed = true;
    }
    if (Array.isArray(evt["yaxis.range"])) {
      nextY[0] = Number(evt["yaxis.range"][0]);
      nextY[1] = Number(evt["yaxis.range"][1]);
      changed = true;
    }
    if (evt["xaxis.autorange"] || evt["yaxis.autorange"]) {
      setViewRange({ xRange: bounds.xRange, yRange: bounds.yRange, plotWidthPx: plotWidth });
      return;
    }
    if (changed) {
      setViewRange({ xRange: nextX, yRange: nextY, plotWidthPx: plotWidth });
    }
  };

  return (
    <div style={{
      width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
      backgroundColor: "var(--card)", borderRadius: "var(--radius)", padding: "1rem",
      border: "1px solid var(--border)",
      boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
    }}>
      <div style={{ position: "relative", width: "100%" }}>
        <Plot
          data={traces}
          onRelayout={handleRelayout}
          layout={{
            title: { text: `Cone Positions - ${subPlot.range.label}` },
            height: plotHeight,
            width: plotWidth,
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
              range: bounds.xRange,
              constrain: "domain",
              autorange: false,
            },
            yaxis: {
              title: { text: "" },
              showticklabels: false,
              color: "var(--foreground)",
              gridcolor: "var(--border)",
              range: bounds.yRange,
              scaleanchor: "x",
              scaleratio: 1,
              constrain: "domain",
              autorange: false,
            },
          }}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
            displaylogo: false
          }}
        />

        {/* Dynamic scale bar */}
        <div style={{
          position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem",
          padding: "0.5rem 0.75rem", backgroundColor: "rgba(247, 241, 241, 0.95)",
          borderRadius: "var(--radius)", border: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)", backdropFilter: "blur(4px)"
        }}>
          <div style={{
            width: `${scaleBarPx}px`, height: "3px",
            backgroundColor: "var(--foreground)", borderRadius: "1px"
          }} />
          <div style={{ fontSize: "0.75rem", color: "var(--foreground)", fontWeight: 600, textAlign: "center" }}>
            {formatScaleLabel(scaleMicrons)}
          </div>
        </div>

        {/* Data Summary - Overlay within plot */}
        {subPlot.metadata && (
          <div style={{
            position: "absolute", top: "60px", right: "20px", padding: "0.75rem",
            backgroundColor: "rgba(247, 241, 241, 0.95)", borderRadius: "var(--radius)",
            border: "1px solid var(--border)", minWidth: "200px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)", backdropFilter: "blur(4px)"
          }}>
            <div style={{ marginBottom: "1rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)" }}>
                Eccentricity Range
              </h4>
              <div style={{ fontSize: "0.8rem", color: "var(--muted-foreground)" }}>
                {subPlot.range.min.toFixed(1)}° - {subPlot.range.max.toFixed(1)}°
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)" }}>
                Cone Types
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem" }}>
                {Array.from(new Set(subPlot.data?.cone_type ?? [])).map((type) => {
                  const count = (subPlot.data?.cone_type ?? []).filter(t => t === type).length;
                  return (
                    <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{
                        width: "12px", height: "12px", backgroundColor: COLOR_MAP[type],
                        borderRadius: "50%", border: "1px solid rgba(0,0,0,0.1)"
                      }} />
                      <span style={{ color: "var(--muted-foreground)" }}>{type}: {count}</span>
                    </div>
                  );
                })}
                <div style={{
                  marginTop: "0.25rem", paddingTop: "0.25rem",
                  borderTop: "1px solid var(--border)", fontWeight: 600, color: "var(--foreground)"
                }}>
                  Total: {subPlot.data.cone_type.length}
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 600, color: "var(--foreground)" }}>
                Summary
              </h4>
              <div style={{
                display: "flex", flexDirection: "column", gap: "0.25rem",
                fontSize: "0.8rem", color: "var(--muted-foreground)"
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

export const EccentricitySubPlots: React.FC<EccentricitySubPlotsProps> = ({
  subjectId,
  meridian,
  coneTypes,
  eye,
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
        const rangesResponse = await getEccentricityRanges(subjectId, meridian, eye);
        const ranges = rangesResponse.ranges;

        if (ranges.length === 0) {
          setSubPlots([]);
          setLoading(false);
          return;
        }

        const initialSubPlots: SubPlotData[] = ranges.map(range => ({
          range,
          data: null,
          metadata: null,
          loading: true,
          error: null
        }));

        setSubPlots(initialSubPlots);
        // Default to the lowest eccentricity range so all foveal cones are visible.
        setSelectedRange(0);

        const fetchPromises = ranges.map(async (range, index) => {
          try {
            const [data, metadata] = await Promise.all([
              getPlotData({
                subjectId,
                meridian,
                coneTypes,
                eccentricityMin: range.min,
                eccentricityMax: range.max,
                eye,
              }),
              getMetadata(
                subjectId,
                meridian,
                coneTypes,
                range.min,
                range.max,
                eye,
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
  }, [subjectId, meridian, coneTypes, eye]);

  if (loading) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        height: "400px", backgroundColor: "var(--card)",
        borderRadius: "var(--radius)", border: "1px solid var(--border)"
      }}>
        <div>Loading eccentricity ranges...</div>
      </div>
    );
  }

  if (subPlots.length === 0) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        height: "400px", backgroundColor: "var(--card)",
        borderRadius: "var(--radius)", border: "1px solid var(--border)"
      }}>
        <div>No eccentricity ranges found for the selected filters</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "1rem", padding: "0.75rem", backgroundColor: "var(--card)",
        borderRadius: "var(--radius)", border: "1px solid var(--border)"
      }}>
        <div style={{ fontSize: "0.9rem", color: "var(--muted-foreground)" }}>
          {subPlots.length} eccentricity range{subPlots.length !== 1 ? 's' : ''} found
        </div>
        <div style={{ fontSize: "0.9rem", color: "var(--muted-foreground)" }}>
          Viewing: {subPlots[selectedRange]?.range.label || 'Loading...'}
        </div>
      </div>

      <div style={{
        display: "flex", gap: "0.5rem", marginBottom: "1rem",
        flexWrap: "wrap", justifyContent: "center"
      }}>
        {subPlots.map((_, index) => (
          <button
            key={index}
            onClick={() => setSelectedRange(index)}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: selectedRange === index ? "var(--primary)" : "var(--muted)",
              color: selectedRange === index ? "var(--primary-foreground)" : "var(--foreground)",
              border: "1px solid var(--border)", borderRadius: "var(--radius)",
              cursor: "pointer", fontSize: "0.8rem"
            }}
          >
            {subPlots[index].range.label}
          </button>
        ))}
      </div>

      <div>
        <SinglePlot key={selectedRange} subPlot={subPlots[selectedRange]} />
      </div>
    </div>
  );
};
