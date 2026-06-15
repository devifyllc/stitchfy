import type { NavItem } from "../lib/types";

interface HeaderProps {
  businessName: string;
  navigation: NavItem[];
  showPhone?: boolean;
  phone?: string;
  showCTA?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}

export function Header({
  businessName,
  navigation,
  showPhone,
  phone,
  showCTA,
  ctaLabel = "Book Now",
  ctaHref = "/book",
}: HeaderProps) {
  const telHref = phone ? `tel:${phone.replace(/\D/g, "")}` : undefined;

  return (
    <header className="site-header" role="banner" style={styles.header}>
      <div className="container" style={styles.inner}>
        <a href="/" style={styles.logo} aria-label={`${businessName} — home`}>
          {businessName}
        </a>
        <nav aria-label="Main navigation">
          <ul style={styles.navList} role="list">
            {navigation.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  style={styles.navLink}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {(showPhone || showCTA) && (
          <div style={styles.actions}>
            {showPhone && phone && (
              <a href={telHref} style={styles.phoneLink} aria-label={`Call us at ${phone}`}>
                {phone}
              </a>
            )}
            {showCTA && (
              <a href={ctaHref} style={styles.ctaBtn}>
                {ctaLabel}
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

const styles = {
  header: {
    backgroundColor: "var(--color-white)",
    borderBottom: "1px solid var(--color-border)",
    position: "sticky" as const,
    top: 0,
    zIndex: 50,
  },
  inner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 1.5rem",
    maxWidth: "var(--max-width)",
    margin: "0 auto",
    gap: "1.5rem",
  },
  logo: {
    fontSize: "1.25rem",
    fontWeight: 700,
    fontFamily: "var(--font-heading)",
    color: "var(--color-text)",
    textDecoration: "none",
    flexShrink: 0,
  },
  navList: {
    display: "flex",
    gap: "1.75rem",
    listStyle: "none",
    margin: 0,
    padding: 0,
    flexWrap: "wrap" as const,
  },
  navLink: {
    color: "var(--color-text)",
    fontWeight: 500,
    textDecoration: "none",
    fontSize: "0.95rem",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    flexShrink: 0,
  },
  phoneLink: {
    color: "var(--color-text)",
    fontWeight: 500,
    fontSize: "0.9rem",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
  },
  ctaBtn: {
    display: "inline-flex",
    alignItems: "center",
    backgroundColor: "var(--color-primary)",
    color: "#fff",
    padding: "0.625rem 1.25rem",
    borderRadius: "var(--radius-md)",
    fontWeight: 600,
    fontSize: "0.9rem",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
    minHeight: "44px",
  },
};
