import React, { useState, useRef, useCallback } from "react";
import { adminLogin, adminUploadCSV } from "../api";

interface UploadResult {
  filename: string;
  row_count: number;
  error?: string;
}

export const AdminPanel: React.FC = () => {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const t = await adminLogin(password);
      setToken(t);
    } catch {
      setLoginError("Incorrect password. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const csvs = Array.from(incoming).filter((f) =>
      f.name.toLowerCase().endsWith(".csv")
    );
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...csvs.filter((f) => !existingNames.has(f.name))];
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleUpload = async () => {
    if (!token || files.length === 0) return;
    setUploading(true);
    setResults([]);
    const newResults: UploadResult[] = [];

    for (const file of files) {
      try {
        const result = await adminUploadCSV(token, file);
        newResults.push({ filename: file.name, row_count: result.row_count });
      } catch (err) {
        newResults.push({
          filename: file.name,
          row_count: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    setResults(newResults);
    setFiles([]);
    setUploading(false);
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1000px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Admin: Upload Data</h2>
        {token && (
          <span
            style={{
              fontSize: "0.75rem",
              padding: "0.15rem 0.5rem",
              borderRadius: "9999px",
              backgroundColor: "#dcfce7",
              color: "#166534",
              fontWeight: 500,
            }}
          >
            Authenticated
          </span>
        )}
      </div>

      {!token ? (
        <form onSubmit={handleLogin} style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: "1 1 200px" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 500 }}>Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius)",
                border: `1px solid ${loginError ? "#ef4444" : "var(--border)"}`,
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
            {loginError && (
              <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>{loginError}</span>
            )}
          </div>
          <button
            type="submit"
            disabled={loggingIn || !password}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "var(--radius)",
              border: "none",
              backgroundColor: "var(--foreground)",
              color: "var(--background)",
              cursor: loggingIn || !password ? "not-allowed" : "pointer",
              opacity: loggingIn || !password ? 0.6 : 1,
              fontSize: "0.875rem",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {loggingIn ? "Verifying..." : "Login"}
          </button>
        </form>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--foreground)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              cursor: "pointer",
              backgroundColor: dragOver ? "var(--accent)" : "transparent",
              transition: "border-color 0.15s, background-color 0.15s",
              color: "var(--muted-foreground)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📂</div>
            <div style={{ fontSize: "0.875rem" }}>
              Drop CSV files here or <span style={{ textDecoration: "underline" }}>click to browse</span>
            </div>
            <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", opacity: 0.7 }}>
              Files are parsed and inserted into the database automatically
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              style={{ display: "none" }}
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* Queued files */}
          {files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--muted-foreground)" }}>
                Queued ({files.length})
              </span>
              {files.map((f) => (
                <div
                  key={f.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.4rem 0.75rem",
                    backgroundColor: "var(--accent)",
                    borderRadius: "var(--radius)",
                    fontSize: "0.875rem",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name}
                  </span>
                  <button
                    onClick={() => removeFile(f.name)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--muted-foreground)",
                      fontSize: "1rem",
                      flexShrink: 0,
                      marginLeft: "0.5rem",
                      lineHeight: 1,
                    }}
                    aria-label={`Remove ${f.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "var(--radius)",
                  border: "none",
                  backgroundColor: "var(--foreground)",
                  color: "var(--background)",
                  cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.6 : 1,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  alignSelf: "flex-start",
                }}
              >
                {uploading ? "Uploading..." : `Upload ${files.length} file${files.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--muted-foreground)" }}>Results</span>
              {results.map((r) => (
                <div
                  key={r.filename}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "var(--radius)",
                    backgroundColor: r.error ? "#fee2e2" : "#dcfce7",
                    color: r.error ? "#991b1b" : "#166534",
                    fontSize: "0.875rem",
                  }}
                >
                  {r.error ? (
                    <><strong>{r.filename}</strong>: {r.error}</>
                  ) : (
                    <><strong>{r.filename}</strong>: {r.row_count.toLocaleString()} rows inserted</>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
