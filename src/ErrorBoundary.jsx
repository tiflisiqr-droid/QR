import { Component } from "react";

/**
 * Catches render errors so the whole SPA does not go blank (mobile / production).
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary:", error, info?.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#050a0a",
            color: "#eef6f4",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          <h1 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "12px" }}>Something went wrong</h1>
          <p style={{ fontSize: "0.8rem", color: "#6d8f89", maxWidth: "360px", lineHeight: 1.5, marginBottom: "20px" }}>
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 20px",
              borderRadius: "999px",
              border: "1px solid #3dbfb0",
              background: "rgba(61,191,176,0.12)",
              color: "#d4f7f2",
              fontSize: "0.75rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
