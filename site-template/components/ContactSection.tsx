import type { ContactInfo } from "../lib/types";

interface ContactSectionProps {
  contact: ContactInfo;
  heading?: string;
}

export function ContactSection({ contact, heading = "Contact Us" }: ContactSectionProps) {
  return (
    <section aria-labelledby="contact-heading" style={styles.section}>
      <div className="container" style={styles.inner}>
        <h2 id="contact-heading" style={styles.heading}>{heading}</h2>
        <div style={styles.details}>
          {contact.phone && (
            <p>
              <strong>Phone:</strong>{" "}
              <a href={`tel:${contact.phone.replace(/\D/g, "")}`} style={styles.link}>
                {contact.phone}
              </a>
            </p>
          )}
          {contact.email && (
            <p>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${contact.email}`} style={styles.link}>
                {contact.email}
              </a>
            </p>
          )}
          {contact.address && (
            <p>
              <strong>Address:</strong>{" "}
              <address style={styles.address}>{contact.address}</address>
            </p>
          )}
        </div>

        {/* General inquiry note — not for medical questions or appointments */}
        <p style={styles.note}>
          This form is for general inquiries only. For appointments, please use our booking link.
        </p>
      </div>
    </section>
  );
}

const styles = {
  section: { padding: "var(--section-padding)", backgroundColor: "var(--color-white)" },
  inner: {
    maxWidth: "640px",
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
  details: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
    marginBottom: "2rem",
    fontSize: "1rem",
    color: "var(--color-text)",
  },
  link: { color: "var(--color-primary)" },
  address: { fontStyle: "normal", display: "inline" },
  note: { fontSize: "0.85rem", color: "var(--color-text)", opacity: 0.6 },
};
