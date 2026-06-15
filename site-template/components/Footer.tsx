import type { NavItem, ContactInfo, HoursEntry } from "../lib/types";
import { SocialIcon } from "./SocialIcons";

interface FooterProps {
  businessName: string;
  navigation: NavItem[];
  contact: ContactInfo;
  social?: Record<string, string>;
  hours?: HoursEntry[];
  legalNote?: string;
}

export function Footer({ businessName, navigation, contact, social, hours, legalNote }: FooterProps) {
  const year = new Date().getFullYear();
  const socialEntries = social ? Object.entries(social) : [];

  return (
    <footer role="contentinfo" style={styles.footer}>
      <div className="container" style={styles.inner}>
        {/* Column 1: Brand + contact info */}
        <div style={styles.col}>
          <p style={styles.brandName}>{businessName}</p>
          {contact.phone && (
            <a
              href={`tel:${contact.phone.replace(/\D/g, "")}`}
              style={styles.link}
              aria-label={`Call us at ${contact.phone}`}
            >
              {contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} style={styles.link}>
              {contact.email}
            </a>
          )}
          {contact.address && (
            <address style={styles.address}>{contact.address}</address>
          )}
          {socialEntries.length > 0 && (
            <div style={styles.social}>
              {socialEntries.map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  style={styles.socialLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${businessName} on ${platform}`}
                >
                  <SocialIcon platform={platform} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Navigation */}
        <nav aria-label="Footer navigation">
          <p style={styles.colHeading}>Navigation</p>
          <ul style={styles.navList} role="list">
            {navigation.map((item) => (
              <li key={item.href}>
                <a href={item.href} style={styles.link}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Column 3: Hours */}
        {hours && hours.length > 0 && (
          <div style={styles.col}>
            <p style={styles.colHeading}>Hours</p>
            <dl style={styles.hoursList}>
              {hours.map((entry) => (
                <div key={entry.days} style={styles.hoursRow}>
                  <dt style={styles.hoursDt}>{entry.days}</dt>
                  <dd style={styles.hoursDd}>{entry.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div style={styles.bottom}>
        <p>{legalNote ?? `© ${year} ${businessName}. All rights reserved.`}</p>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    backgroundColor: "var(--color-text)",
    color: "var(--color-secondary)",
    paddingTop: "3rem",
  },
  inner: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "3rem",
    justifyContent: "space-between",
    maxWidth: "var(--max-width)",
    margin: "0 auto",
    padding: "0 1.5rem 3rem",
  },
  col: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    minWidth: "160px",
  },
  colHeading: {
    fontWeight: 700,
    fontSize: "0.75rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "0.5rem",
    opacity: 0.5,
  },
  brandName: {
    fontWeight: 700,
    fontSize: "1.1rem",
    fontFamily: "var(--font-heading)",
    marginBottom: "0.25rem",
  },
  address: {
    fontStyle: "normal",
    fontSize: "0.875rem",
    opacity: 0.7,
    lineHeight: 1.5,
  },
  link: {
    color: "var(--color-secondary)",
    opacity: 0.8,
    fontSize: "0.875rem",
    textDecoration: "none",
    display: "block",
  },
  navList: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    padding: 0,
    margin: 0,
  },
  social: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap" as const,
    marginTop: "0.75rem",
  },
  socialLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "var(--color-secondary)",
    textDecoration: "none",
    transition: "background-color 0.15s ease",
  },
  hoursList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.4rem",
  },
  hoursRow: {
    display: "flex",
    gap: "0.75rem",
    fontSize: "0.85rem",
    flexWrap: "wrap" as const,
  },
  hoursDt: {
    fontWeight: 500,
    minWidth: "110px",
    opacity: 0.85,
  },
  hoursDd: {
    opacity: 0.65,
  },
  bottom: {
    borderTop: "1px solid rgba(255,255,255,0.1)",
    padding: "1.25rem 1.5rem",
    textAlign: "center" as const,
    fontSize: "0.8rem",
    opacity: 0.5,
  },
};
