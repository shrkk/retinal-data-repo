import React, { useState, useRef, useCallback } from "react";
import { adminLogin, adminValidateCSV, adminUploadCSV } from "../api";

type Stage = "login" | "upload" | "preview" | "done";

interface ValidationResult {
  filename: string;
  row_count: number;
  subjects: string[];
  meridians: string[];
  cone_types: string[];
}

interface UploadResult {
  queued: boolean;
  row_count: number;
  subjects: string[];
}

interface Props {
  onBack: () => void;
}

export const AdminPage: React.FC<Props> = ({ onBack }) => {
  const [stage, setStage] = useState<Stage>("login");

  // Login state
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Commit message state
  const [commitMessage, setCommitMessage] = useState("");

  // Confirm/upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // — Login —
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const t = await adminLogin(password);
      setToken(t);
      setStage("upload");
    } catch {
      setLoginError("Incorrect password. Please try again.");
    } finally {
      setLoggingIn(false);
    }
  };

  // — File selection —
  const pickFile = (incoming: FileList | null) => {
    const f = incoming && incoming[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setValidateError("Only .csv files are accepted.");
      return;
    }
    setFile(f);
    setValidateError("");
    setValidation(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files);
  }, []);

  // — Validate (dry-run) —
  const handleValidate = async () => {
    if (!file || !token) return;
    setValidating(true);
    setValidateError("");
    try {
      const result = await adminValidateCSV(token, file);
      setValidation(result);
      setStage("preview");
    } catch (err) {
      setValidateError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  // — Confirm upload —
  const handleUpload = async () => {
    if (!file || !token) return;
    setUploading(true);
    setUploadError("");
    try {
      const result = await adminUploadCSV(token, file, commitMessage || undefined);
      setUploadResult(result);
      setStage("done");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // — Reset for another upload —
  const handleReset = () => {
    setFile(null);
    setValidation(null);
    setUploadResult(null);
    setValidateError("");
    setUploadError("");
    setCommitMessage("");
    setStage("upload");
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "2rem 1rem",
      maxWidth: "1200px",
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{
        width: "100%",
        maxWidth: "600px",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        marginBottom: "2.5rem",
      }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>Admin Upload</h1>
      </div>

      <div style={{
        width: "100%",
        maxWidth: "600px",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}>

        {/* ── STAGE: login ── */}
        {stage === "login" && (
          <div style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "2rem",
          }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", fontWeight: 600 }}>Sign in</h2>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
              Enter the admin password to upload new data files.
            </p>
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  placeholder="Enter admin password"
                  style={{
                    padding: "0.6rem 0.75rem",
                    borderRadius: "var(--radius)",
                    border: `1px solid ${loginError ? "#ef4444" : "var(--border)"}`,
                    backgroundColor: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                />
                {loginError && (
                  <span style={{ fontSize: "0.8rem", color: "#ef4444" }}>{loginError}</span>
                )}
              </div>
              <button
                type="submit"
                disabled={loggingIn || !password}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "var(--radius)",
                  border: "none",
                  backgroundColor: "var(--foreground)",
                  color: "var(--background)",
                  cursor: loggingIn || !password ? "not-allowed" : "pointer",
                  opacity: loggingIn || !password ? 0.6 : 1,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  alignSelf: "flex-start",
                }}
              >
                {loggingIn ? "Verifying..." : "Sign in"}
              </button>
            </form>
          </div>
        )}

        {/* ── STAGE: upload ── */}
        {stage === "upload" && (
          <div style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}>
            <div>
              <h2 style={{ margin: "0 0 0.375rem", fontSize: "1.1rem", fontWeight: 600 }}>Upload CSV</h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                The file will be validated before anything is written to the database.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--foreground)" : file ? "#22c55e" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                padding: "3rem 1.5rem",
                textAlign: "center",
                cursor: "pointer",
                backgroundColor: dragOver ? "var(--accent)" : "transparent",
                transition: "border-color 0.15s, background-color 0.15s",
                color: "var(--muted-foreground)",
              }}
            >
              {file ? (
                <>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--foreground)" }}>{file.name}</div>
                  <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    {(file.size / 1024).toFixed(1)} KB — click to replace
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📂</div>
                  <div style={{ fontSize: "0.9rem" }}>
                    Drag & drop a CSV file here
                  </div>
                  <div style={{ fontSize: "0.8rem", marginTop: "0.25rem", opacity: 0.75 }}>
                    or click to browse
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => pickFile(e.target.files)}
              />
            </div>

            {/* Commit message input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                htmlFor="commit-message"
                style={{ fontSize: "14px", fontWeight: 400, color: "var(--foreground)" }}
              >
                Commit message
              </label>
              <input
                id="commit-message"
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Describe this upload&#x2026;"
                maxLength={500}
                style={{
                  padding: "0.6rem 0.75rem",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: "0.875rem",
                  outline: "none",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {validateError && (
              <div style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius)",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                fontSize: "0.875rem",
              }}>
                {validateError}
              </div>
            )}

            <button
              onClick={handleValidate}
              disabled={!file || validating}
              style={{
                padding: "0.6rem 1.25rem",
                borderRadius: "var(--radius)",
                border: "none",
                backgroundColor: "var(--foreground)",
                color: "var(--background)",
                cursor: !file || validating ? "not-allowed" : "pointer",
                opacity: !file || validating ? 0.6 : 1,
                fontSize: "0.875rem",
                fontWeight: 500,
                alignSelf: "flex-start",
              }}
            >
              {validating ? "Validating..." : "Validate file"}
            </button>
          </div>
        )}

        {/* ── STAGE: preview ── */}
        {stage === "preview" && validation && (
          <div style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}>
            <div>
              <h2 style={{ margin: "0 0 0.375rem", fontSize: "1.1rem", fontWeight: 600 }}>Validation passed</h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                Review the summary below, then confirm to insert into the database.
              </p>
            </div>

            {/* Summary card */}
            <div style={{
              backgroundColor: "var(--accent)",
              borderRadius: "var(--radius)",
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              fontSize: "0.875rem",
            }}>
              <Row label="File" value={validation.filename} />
              <Row label="Rows to insert" value={validation.row_count.toLocaleString()} />
              <Row label="Subjects" value={validation.subjects.join(", ") || "—"} />
              <Row label="Meridians" value={validation.meridians.join(", ") || "—"} />
              <Row label="Cone types" value={validation.cone_types.join(", ") || "—"} />
            </div>

            {uploadError && (
              <div style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--radius)",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                fontSize: "0.875rem",
              }}>
                {uploadError}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "var(--radius)",
                  border: "none",
                  backgroundColor: "var(--foreground)",
                  color: "var(--background)",
                  cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.6 : 1,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                {uploading ? "Uploading..." : "Confirm upload"}
              </button>
              <button
                onClick={handleReset}
                disabled={uploading}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Choose different file
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE: done ── */}
        {stage === "done" && uploadResult && (
          <div style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "2rem" }}>✅</span>
              <div>
                <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", fontWeight: 600 }}>Upload successful</h2>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                  Data is now available in the viewer.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: "#dcfce7",
              borderRadius: "var(--radius)",
              padding: "1rem 1.25rem",
              fontSize: "0.875rem",
              color: "#166534",
            }}>
              <strong>Subjects: {uploadResult.subjects.join(", ")}</strong>: {uploadResult.row_count.toLocaleString()} rows queued for ingestion
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleReset}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "var(--radius)",
                  border: "none",
                  backgroundColor: "var(--foreground)",
                  color: "var(--background)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Upload another file
              </button>
              <button
                onClick={onBack}
                style={{
                  padding: "0.6rem 1.25rem",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--foreground)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Back to viewer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: "flex", gap: "0.5rem" }}>
    <span style={{ fontWeight: 500, minWidth: "120px", flexShrink: 0 }}>{label}</span>
    <span style={{ color: "var(--muted-foreground)", wordBreak: "break-all" }}>{value}</span>
  </div>
);
