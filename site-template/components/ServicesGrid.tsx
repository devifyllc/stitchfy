import type { ServiceItem } from "../lib/types";

interface ServicesGridProps {
  services: ServiceItem[];
  heading?: string;
}

export function ServicesGrid({ services, heading = "Our Services" }: ServicesGridProps) {
  return (
    <section aria-labelledby="services-heading" style={styles.section}>
      <div className="container" style={styles.inner}>
        <h2 id="services-heading" style={styles.heading}>{heading}</h2>
        <ul style={styles.grid} role="list">
          {services.map((service) => (
            <li key={service.name} style={styles.card}>
              <h3 style={styles.cardTitle}>{service.name}</h3>
              {service.description && (
                <p style={styles.cardDesc}>{service.description}</p>
              )}
              {service.price && (
                <p style={styles.cardPrice}>{service.price}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const styles = {
  section: { padding: "var(--section-padding)", backgroundColor: "var(--color-white)" },
  inner: { maxWidth: "var(--max-width)", margin: "0 auto", padding: "0 1.5rem" },
  heading: {
    fontSize: "clamp(1.5rem, 3vw, 2rem)",
    fontWeight: 700,
    textAlign: "center" as const,
    marginBottom: "2.5rem",
    color: "var(--color-text)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "1.5rem",
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  card: {
    backgroundColor: "var(--color-secondary)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  cardTitle: { fontWeight: 600, fontSize: "1.05rem", color: "var(--color-text)" },
  cardDesc: { fontSize: "0.9rem", color: "var(--color-text)", opacity: 0.75 },
  cardPrice: { fontWeight: 700, color: "var(--color-primary)", fontSize: "0.95rem" },
};
