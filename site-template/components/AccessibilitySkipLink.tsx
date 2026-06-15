"use client";

export function AccessibilitySkipLink() {
  return (
    <a
      href="#main-content"
      style={{
        position: "absolute",
        top: "-44px",
        left: 0,
        background: "var(--color-primary)",
        color: "#fff",
        padding: "10px 16px",
        zIndex: 100,
        borderRadius: "0 0 4px 4px",
        fontWeight: 600,
        fontSize: "0.9rem",
        transition: "top 0.1s ease",
        textDecoration: "none",
        minHeight: "44px",
        display: "inline-flex",
        alignItems: "center",
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.top = "0";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.top = "-44px";
      }}
    >
      Skip to main content
    </a>
  );
}
