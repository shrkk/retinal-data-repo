import React, { useEffect, useState } from "react";
import { getUploadLog, UploadLogEntry } from "../api";

function formatTimestamp(isoString: string): { relative: string; absolute: string; timeOnly: string } {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative: string;
  if (diffMins < 1) relative = "just now";
  else if (diffMins < 60) relative = `${diffMins} min ago`;
  else if (diffHours < 24) relative = `${diffHours} hours ago`;
  else relative = `${diffDays} days ago`;

  const absolute = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  const timeOnly = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return { relative, absolute, timeOnly };
}

function formatEye(eye: string | null): string {
  if (!eye) return "";
  const lower = eye.toLowerCase();
  if (lower === "od" || lower === "right") return "Right Eye";
  if (lower === "os" || lower === "left") return "Left Eye";
  return eye;
}

const EventBadge: React.FC<{ eventType: string }> = ({ eventType }) => {
  const isNew = eventType === "new_patient";
  return (
    <span
      style={{
        borderRadius: "999px",
        padding: "4px 8px",
        fontSize: "12px",
        fontWeight: 500,
        backgroundColor: isNew ? "#16a34a" : "#d97706",
        color: "#ffffff",
        whiteSpace: "nowrap",
      }}
    >
      {isNew ? "New Patient" : "Update"}
    </span>
  );
};

export const UpdatesPage: React.FC = () => {
  const [entries, setEntries] = useState<UploadLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getUploadLog()
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "48px 24px",
      }}
    >
      <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 4px" }}>Upload History</h1>
      <p style={{ fontSize: "14px", fontWeight: 400, color: "var(--muted-foreground)", margin: "0 0 32px" }}>
        All data uploads, newest first.
      </p>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: "120px",
                backgroundColor: "var(--secondary)",
                borderRadius: "var(--radius)",
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <p style={{ color: "var(--muted-foreground)", fontSize: "14px" }}>
          Could not load upload history. Check your connection and refresh the page.
        </p>
      )}

      {!loading && !error && entries.length === 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            padding: "48px 24px",
            color: "var(--muted-foreground)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          </svg>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontWeight: 500, fontSize: "14px" }}>No uploads yet</p>
            <p style={{ margin: 0, fontSize: "14px" }}>
              Data will appear here after the first admin upload.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "32px" }}>
          {entries.map((entry) => {
            const ts = formatTimestamp(entry.uploaded_at);
            const eyeLabel = formatEye(entry.eye);
            return (
              <li key={entry.id} style={{ display: "flex", gap: "0px" }}>
                {/* Left column with time pill and dashed line */}
                <div
                  style={{
                    width: "96px",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    position: "relative",
                    paddingRight: "24px",
                    borderRight: "2px dashed var(--border)",
                  }}
                >
                  {/* Time pill */}
                  <span
                    style={{
                      backgroundColor: "var(--secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: "999px",
                      padding: "4px 8px",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--foreground)",
                      whiteSpace: "nowrap",
                      marginTop: "16px",
                    }}
                  >
                    {ts.timeOnly}
                  </span>
                  {/* Node dot */}
                  <div
                    style={{
                      position: "absolute",
                      right: "-7px",
                      top: "24px",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      backgroundColor: "var(--border)",
                    }}
                  />
                </div>

                {/* Card */}
                <div
                  style={{
                    marginLeft: "24px",
                    flex: 1,
                    backgroundColor: "var(--card)",
                    borderRadius: "var(--radius)",
                    boxShadow: "0 1px 3px oklch(0 0 0 / 0.08)",
                    padding: "16px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 600 }}>
                      {entry.subject_id ? `Subject ${entry.subject_id}` : "Unknown Subject"}
                      {eyeLabel ? ` — ${eyeLabel}` : ""}
                    </span>
                    <EventBadge eventType={entry.event_type} />
                  </div>
                  {/* Timestamp */}
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 400, color: "var(--muted-foreground)" }}>
                    {ts.relative} — {ts.absolute}
                  </p>
                  {/* Rows ingested */}
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 400, color: "var(--muted-foreground)" }}>
                    {entry.rows_ingested.toLocaleString()} rows ingested
                  </p>
                  {/* Commit message */}
                  {entry.commit_message && (
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 400, color: "var(--foreground)" }}>
                      {"->"} {entry.commit_message}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
