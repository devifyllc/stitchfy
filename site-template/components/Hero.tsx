import type { HeroContent } from "../lib/types";

interface HeroProps {
  content: HeroContent;
  backgroundStyle?: React.CSSProperties;
}

export function Hero({ content, backgroundStyle }: HeroProps) {
  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        ...styles.section,
        ...backgroundStyle,
        backgroundImage: content.backgroundImage
          ? `url(${content.backgroundImage})`
          : backgroundStyle?.backgroundImage,
      }}
    >
      <div className="container" style={styles.inner}>
        <h1 id="hero-heading" style={{ ...styles.headline, color: backgroundStyle?.color ?? styles.headline.color }}>
          {content.headline}
        </h1>
        <p style={{ ...styles.subheadline, color: backgroundStyle?.color ?? styles.subheadline.color }}>{content.subheadline}</p>
        <div style={styles.actions}>
          <a href={content.primaryCta.href} style={styles.primaryBtn}>
            {content.primaryCta.label}
          </a>
          {content.secondaryCta && (
            <a href={content.secondaryCta.href} style={styles.secondaryBtn}>
              {content.secondaryCta.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

const styles = {
  section: {
    padding: "6rem 1.5rem",
    backgroundColor: "var(--color-secondary)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    textAlign: "center" as const,
  },
  inner: {
    maxWidth: "680px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "1.5rem",
  },
  headline: {
    fontSize: "clamp(2rem, 5vw, 3.25rem)",
    fontWeight: 800,
    color: "var(--color-text)",
    lineHeight: 1.1,
  },
  subheadline: {
    fontSize: "clamp(1rem, 2.5vw, 1.25rem)",
    color: "var(--color-text)",
    opacity: 0.75,
    maxWidth: "560px",
  },
  actions: { display: "flex", gap: "1rem", flexWrap: "wrap" as const, justifyContent: "center" },
  primaryBtn: {
    display: "inline-block",
    backgroundColor: "var(--color-primary)",
    color: "#fff",
    padding: "0.875rem 2rem",
    borderRadius: "var(--radius-md)",
    fontWeight: 600,
    fontSize: "1rem",
    textDecoration: "none",
  },
  secondaryBtn: {
    display: "inline-block",
    border: "2px solid var(--color-primary)",
    color: "var(--color-primary)",
    padding: "0.875rem 2rem",
    borderRadius: "var(--radius-md)",
    fontWeight: 600,
    fontSize: "1rem",
    textDecoration: "none",
  },
};
