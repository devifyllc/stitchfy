import type { FAQItem } from "../lib/types";

interface FAQSectionProps {
  items: FAQItem[];
  heading?: string;
}

export function FAQSection({ items, heading = "Frequently Asked Questions" }: FAQSectionProps) {
  return (
    <section aria-labelledby="faq-heading" style={styles.section}>
      <div className="container" style={styles.inner}>
        <h2 id="faq-heading" style={styles.heading}>{heading}</h2>
        <dl style={styles.list}>
          {items.map((item, i) => (
            <div key={i} style={styles.item}>
              <dt style={styles.question}>{item.question}</dt>
              <dd style={styles.answer}>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const styles = {
  section: { padding: "var(--section-padding)", backgroundColor: "var(--color-white)" },
  inner: { maxWidth: "760px", margin: "0 auto", padding: "0 1.5rem" },
  heading: {
    fontSize: "clamp(1.5rem, 3vw, 2rem)",
    fontWeight: 700,
    textAlign: "center" as const,
    marginBottom: "2.5rem",
    color: "var(--color-text)",
  },
  list: { display: "flex", flexDirection: "column" as const, gap: "1.5rem" },
  item: {
    borderBottom: "1px solid var(--color-border)",
    paddingBottom: "1.25rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  question: {
    fontWeight: 600,
    fontSize: "1rem",
    color: "var(--color-text)",
  },
  answer: {
    color: "var(--color-text)",
    opacity: 0.78,
    fontSize: "0.95rem",
    lineHeight: 1.65,
  },
};
