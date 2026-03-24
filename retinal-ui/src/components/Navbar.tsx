import React from "react";
import { ModeToggle } from "./mode-toggle";

type View = "main" | "admin" | "updates";

interface NavbarProps {
  view: View;
  onNavigate: (v: View) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ view, onNavigate }) => {
  const navItems: { label: string; value: View; icon?: React.ReactNode }[] = [
    { label: "Viewer", value: "main" },
    { label: "Updates", value: "updates" },
    {
      label: "Admin",
      value: "admin",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }}
          aria-hidden="true"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "56px",
        backgroundColor: "var(--secondary)",
        borderBottom: "1px solid var(--border)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          width: "100%",
          margin: "0 auto",
          padding: "0 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
        }}
      >
        {navItems.map((item) => {
          const isActive = view === item.value;
          return (
            <button
              key={item.value}
              onClick={() => onNavigate(item.value)}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                minHeight: "44px",
                padding: "8px 16px",
                border: "none",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                backgroundColor: isActive ? "var(--primary)" : "transparent",
                color: isActive ? "var(--primary-foreground)" : "var(--foreground)",
                transition: "background-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                }
              }}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto" }}>
          <ModeToggle />
        </div>
      </div>
    </nav>
  );
};
