"use client";

import { useState } from "react";
import type { GalleryImage } from "../lib/types";

interface GallerySectionProps {
  images: GalleryImage[];
  heading?: string;
  categories?: string[];
  filterable?: boolean;
}

export function GallerySection({
  images,
  heading = "Gallery",
  categories = [],
  filterable = false,
}: GallerySectionProps) {
  const [activeFilter, setActiveFilter] = useState("All");

  const allCategories =
    filterable && categories.length > 0
      ? ["All", ...categories.filter((c) => c !== "All")]
      : [];

  const visibleImages =
    filterable && activeFilter !== "All"
      ? images.filter((img) => img.category === activeFilter)
      : images;

  return (
    <section aria-labelledby="gallery-heading" style={styles.section}>
      <div className="container" style={styles.inner}>
        <h2 id="gallery-heading" style={styles.heading}>{heading}</h2>

        {filterable && allCategories.length > 1 && (
          <div
            style={styles.filters}
            role="group"
            aria-label="Filter gallery by category"
          >
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveFilter(cat)}
                aria-pressed={activeFilter === cat}
                style={{
                  ...styles.filterBtn,
                  ...(activeFilter === cat ? styles.filterBtnActive : {}),
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <ul style={styles.grid} role="list">
          {visibleImages.map((image, i) => (
            <li key={`${image.src}-${i}`} style={styles.item}>
              <figure style={styles.figure}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.src}
                  alt={image.alt}
                  style={styles.img}
                  loading="lazy"
                  width={400}
                  height={300}
                />
                {image.category && (
                  <figcaption style={styles.caption}>{image.category}</figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>

        {filterable && visibleImages.length === 0 && (
          <p style={styles.empty} role="status">
            No images in this category yet.
          </p>
        )}
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
    marginBottom: "2rem",
    color: "var(--color-text)",
  },
  filters: {
    display: "flex",
    justifyContent: "center",
    gap: "0.75rem",
    marginBottom: "2.5rem",
    flexWrap: "wrap" as const,
  },
  filterBtn: {
    padding: "0.5rem 1.25rem",
    borderRadius: "var(--radius-lg)",
    border: "2px solid var(--color-border)",
    backgroundColor: "transparent",
    color: "var(--color-text)",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 500,
    minHeight: "44px",
    minWidth: "44px",
    transition: "all 0.15s ease",
  },
  filterBtnActive: {
    backgroundColor: "var(--color-primary)",
    color: "#fff",
    borderColor: "var(--color-primary)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "1.25rem",
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  item: {
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
  },
  figure: {
    margin: 0,
    position: "relative" as const,
  },
  img: {
    width: "100%",
    height: "240px",
    objectFit: "cover" as const,
    display: "block",
  },
  caption: {
    position: "absolute" as const,
    bottom: "0.5rem",
    left: "0.5rem",
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
    fontSize: "0.75rem",
    padding: "0.2rem 0.6rem",
    borderRadius: "var(--radius-sm)",
  },
  empty: {
    textAlign: "center" as const,
    color: "var(--color-text)",
    opacity: 0.6,
    marginTop: "2rem",
    fontSize: "1rem",
  },
};
