import type { HoursEntry } from "../lib/types";

interface HoursBlockProps {
  hours: HoursEntry[];
  heading?: string;
}

export function HoursBlock({ hours, heading = "Hours" }: HoursBlockProps) {
  return (
    <section aria-labelledby="hours-heading" style={styles.section}>
      <div className="container" style={styles.inner}>
        <h2 id="hours-heading" style={styles.heading}>{heading}</h2>
        <dl style={styles.list}>
          {hours.map((entry) => (
            <div key={entry.days} style={styles.row}>
              <dt style={styles.days}>{entry.days}</dt>
              <dd style={styles.time}>{entry.hours}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const styles = {
  section: {
    padding: "var(--section-padding)",
    backgroundColor: "var(--color-secondary)",
  },
  inner: {
    maxWidth: "560px",
    margin: "0 auto",
    padding: "0 1.5rem",
    textAlign: "center" as const,
  },
  heading: {
    fontSize: "clamp(1.5rem, 3vw, 2rem)",
    fontWeight: 700,
    marginBottom: "2rem",
    color: "var(--color-text)",
  },
  list: { display: "flex", flexDirection: "column" as const, gap: "0.75rem" },
  row: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid var(--color-border)",
    paddingBottom: "0.5rem",
  },
  days: { fontWeight: 500, color: "var(--color-text)" },
  time: { color: "var(--color-text)", opacity: 0.75 },
};
