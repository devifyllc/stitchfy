import type { Testimonial } from "../lib/types";

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  heading?: string;
}

export function TestimonialsSection({
  testimonials,
  heading = "What Our Clients Say",
}: TestimonialsSectionProps) {
  return (
    <section aria-labelledby="testimonials-heading" style={styles.section}>
      <div className="container" style={styles.inner}>
        <h2 id="testimonials-heading" style={styles.heading}>{heading}</h2>
        <ul style={styles.grid} role="list">
          {testimonials.map((t, i) => (
            <li key={i} style={styles.card}>
              <blockquote style={styles.quote}>
                <p style={styles.text}>&#8220;{t.quote}&#8221;</p>
                <footer style={styles.footer}>
                  <cite style={styles.author}>
                    {t.author}
                    {t.role && <span style={styles.role}>, {t.role}</span>}
                  </cite>
                </footer>
              </blockquote>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const styles = {
  section: { padding: "var(--section-padding)", backgroundColor: "var(--color-secondary)" },
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
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "1.5rem",
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  card: {
    backgroundColor: "var(--color-white)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "1.5rem",
  },
  quote: { margin: 0 },
  text: {
    fontSize: "0.95rem",
    lineHeight: 1.65,
    color: "var(--color-text)",
    marginBottom: "1rem",
    fontStyle: "italic",
  },
  footer: {},
  author: {
    fontWeight: 600,
    fontSize: "0.9rem",
    color: "var(--color-text)",
    fontStyle: "normal",
  },
  role: { fontWeight: 400, opacity: 0.7 },
};
