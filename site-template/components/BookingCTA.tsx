interface BookingCTAProps {
  headline: string;
  subheadline?: string;
  cta: { label: string; href: string };
}

export function BookingCTA({ headline, subheadline, cta }: BookingCTAProps) {
  return (
    <section
      aria-labelledby="booking-cta-heading"
      style={styles.section}
    >
      <div className="container" style={styles.inner}>
        <h2 id="booking-cta-heading" style={styles.headline}>{headline}</h2>
        {subheadline && <p style={styles.sub}>{subheadline}</p>}
        <a href={cta.href} style={styles.btn}>
          {cta.label}
        </a>
      </div>
    </section>
  );
}

const styles = {
  section: {
    padding: "5rem 1.5rem",
    backgroundColor: "var(--color-accent)",
    textAlign: "center" as const,
  },
  inner: {
    maxWidth: "var(--max-width)",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "1.25rem",
  },
  headline: {
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
    fontWeight: 800,
    color: "#fff",
  },
  sub: {
    fontSize: "1.1rem",
    color: "#fff",
    opacity: 0.9,
    maxWidth: "480px",
  },
  btn: {
    display: "inline-block",
    backgroundColor: "#fff",
    color: "var(--color-text)",
    padding: "0.875rem 2.5rem",
    borderRadius: "var(--radius-md)",
    fontWeight: 700,
    fontSize: "1rem",
    textDecoration: "none",
  },
};
