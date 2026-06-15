interface CTASectionProps {
  headline: string;
  subheadline?: string;
  cta: { label: string; href: string };
  variant?: "light" | "dark";
}

export function CTASection({ headline, subheadline, cta, variant = "light" }: CTASectionProps) {
  const isDark = variant === "dark";

  return (
    <section
      aria-labelledby="cta-heading"
      style={{
        ...styles.section,
        backgroundColor: isDark ? "var(--color-text)" : "var(--color-primary)",
        color: "#fff",
      }}
    >
      <div className="container" style={styles.inner}>
        <h2 id="cta-heading" style={styles.heading}>{headline}</h2>
        {subheadline && <p style={styles.sub}>{subheadline}</p>}
        <a href={cta.href} style={styles.btn}>{cta.label}</a>
      </div>
    </section>
  );
}

const styles = {
  section: { padding: "var(--section-padding)" },
  inner: {
    maxWidth: "var(--max-width)",
    margin: "0 auto",
    padding: "0 1.5rem",
    textAlign: "center" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "1.25rem",
  },
  heading: { fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 800 },
  sub: { fontSize: "1.1rem", opacity: 0.85, maxWidth: "520px" },
  btn: {
    display: "inline-block",
    backgroundColor: "#fff",
    color: "var(--color-primary)",
    padding: "0.875rem 2.5rem",
    borderRadius: "var(--radius-md)",
    fontWeight: 700,
    fontSize: "1rem",
    textDecoration: "none",
  },
};
