/**
 * stitch-post-processor — Injects Stitchfy's structured SEO and accessibility
 * data into the raw HTML that Stitch's build_site tool returns.
 *
 * Stitch generates visual design; it knows nothing about the blueprint's
 * seo.pageMeta, seo.openGraph, or accessibility.landmarkRequirements.
 * This module bridges that gap before the HTML is written to disk.
 *
 * Operations (in order):
 *   1. Strip any <title>/<meta charset>/<meta viewport>/<meta description>
 *      that Stitch may have emitted, so we can replace them cleanly.
 *   2. Inject our SEO meta block + JSON-LD into </head>.
 *   3. Add <html lang="en"> if absent.
 *   4. Inject skip-to-main-content link immediately after <body>.
 *   5. Add id="main-content" to <main> if it exists and lacks an id.
 */

import type { PageDefinition, WebsiteBlueprint } from "../schemas/blueprint.types.js";

export function postProcessPage(
  html: string,
  page: PageDefinition,
  blueprint: WebsiteBlueprint
): string {
  const { seo, business } = blueprint;
  const pageMeta = seo.pageMeta.find((m) => m.pageId === page.id);

  const title = pageMeta?.title ?? `${page.title} | ${esc(business.name)}`;
  const description = pageMeta?.description ?? seo.defaultMetaDescription;
  const og = seo.openGraph;
  const siteUrl = og["url"]?.replace(/\/$/, "") ?? "";

  // ── Step 1: Remove Stitch-generated head tags we will replace ─────────────
  let result = html
    .replace(/<title>[^<]*<\/title>/gi, "")
    .replace(/<meta\s+charset[^>]*>/gi, "")
    .replace(/<meta\s+name=["']viewport["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, "");

  // ── Step 2: Inject SEO meta block ─────────────────────────────────────────
  const metaBlock = buildMetaBlock(title, description, og, siteUrl, page.path);
  const jsonLd = page.id === "home" ? buildJsonLd(business, seo) : "";

  const headInjection = [metaBlock, jsonLd].filter(Boolean).join("\n");

  if (result.includes("</head>")) {
    result = result.replace("</head>", `${headInjection}\n</head>`);
  } else {
    // Stitch returned a fragment without a proper <head> — wrap it
    result = `<!DOCTYPE html>\n<html lang="en">\n<head>\n${headInjection}\n</head>\n<body>\n${result}\n</body>\n</html>`;
  }

  // ── Step 3: Ensure lang="en" on <html> ────────────────────────────────────
  if (!/<html[^>]+lang=/i.test(result)) {
    result = result.replace(/<html([^>]*)>/i, '<html$1 lang="en">');
  }

  // ── Step 4: Inject skip link immediately inside <body> ────────────────────
  const skipLink = [
    `<a`,
    ` href="#main-content"`,
    ` style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;z-index:9999"`,
    ` onfocus="this.style.cssText='position:fixed;top:0;left:0;width:auto;height:auto;padding:0.5rem 1rem;background:#fff;color:#000;z-index:9999'"`,
    ` onblur="this.style.cssText='position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;z-index:9999'"`,
    `>Skip to main content</a>`,
  ].join("");

  result = result.replace(/<body([^>]*)>/i, `<body$1>\n${skipLink}`);

  // ── Step 5: Add id="main-content" to <main> if missing ───────────────────
  if (/<main(?![^>]*\bid=)[^>]*>/i.test(result)) {
    result = result.replace(/<main([^>]*)>/i, '<main$1 id="main-content">');
  }

  return result;
}

// ─── Builders ────────────────────────────────────────────────────────────────

function buildMetaBlock(
  title: string,
  description: string,
  og: Record<string, string>,
  siteUrl: string,
  pagePath: string
): string {
  const canonical = `${siteUrl}${pagePath}`;
  const rows: string[] = [
    `  <meta charset="UTF-8">`,
    `  <meta name="viewport" content="width=device-width, initial-scale=1">`,
    `  <title>${esc(title)}</title>`,
    `  <meta name="description" content="${esc(description)}">`,
    `  <link rel="canonical" href="${esc(canonical)}">`,
    // Open Graph
    `  <meta property="og:type" content="${esc(og["type"] ?? "website")}">`,
    `  <meta property="og:title" content="${esc(title)}">`,
    `  <meta property="og:description" content="${esc(description)}">`,
    `  <meta property="og:url" content="${esc(canonical)}">`,
  ];

  if (og["image"]) {
    rows.push(`  <meta property="og:image" content="${esc(og["image"])}">`);
  }
  if (og["site_name"]) {
    rows.push(`  <meta property="og:site_name" content="${esc(og["site_name"])}">`);
  }

  // Twitter Card
  rows.push(
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${esc(title)}">`,
    `  <meta name="twitter:description" content="${esc(description)}">`
  );
  if (og["image"]) {
    rows.push(`  <meta name="twitter:image" content="${esc(og["image"])}">`);
  }

  return rows.join("\n");
}

function buildJsonLd(
  business: WebsiteBlueprint["business"],
  seo: WebsiteBlueprint["seo"]
): string {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    description: business.description,
    url: seo.openGraph["url"] ?? "",
    telephone: business.phone,
    email: business.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address,
    },
  };

  const hours = Object.entries(business.operatingHours);
  if (hours.length > 0) {
    ld["openingHoursSpecification"] = hours.map(([day, range]) => {
      const [opens, closes] = range.split(/[–\-]/).map((s) => s.trim());
      return { "@type": "OpeningHoursSpecification", dayOfWeek: day, opens, closes };
    });
  }

  const socials = Object.values(business.socialLinks).filter(Boolean);
  if (socials.length > 0) {
    ld["sameAs"] = socials;
  }

  return `  <script type="application/ld+json">\n  ${JSON.stringify(ld, null, 2).replace(/\n/g, "\n  ")}\n  </script>`;
}

// Minimal HTML attribute escaping
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
