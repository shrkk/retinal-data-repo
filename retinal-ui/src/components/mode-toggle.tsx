import { useTheme } from "./theme-provider"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return "☀️"
      case "dark":
        return "🌙"
      case "system":
        return "💻"
      default:
        return "💻"
    }
  }

  const getThemeLabel = () => {
    switch (theme) {
      case "light":
        return "Light"
      case "dark":
        return "Dark"
      case "system":
        return "System"
      default:
        return "System"
    }
  }

  return (
    <button
      onClick={toggleTheme}
      style={{
        padding: "0.5rem",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--background)",
        color: "var(--foreground)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.875rem",
        transition: "all 0.2s ease",
      }}
      title={`Current theme: ${getThemeLabel()}. Click to cycle through themes.`}
    >
      <span style={{ fontSize: "1rem" }}>{getThemeIcon()}</span>
      <span>{getThemeLabel()}</span>
    </button>
  )
}

