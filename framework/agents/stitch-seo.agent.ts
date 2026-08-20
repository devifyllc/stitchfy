/**
 * stitch-seo.agent — Reviews Stitch-generated HTML for SEO issues.
 *
 * Runs after postProcessPage (so our meta tags are already injected).
 * Catches what Stitch introduces that our post-processor doesn't cover:
 *   - JSON-LD @type, url field, and opening hours format
 *   - Links to routes that don't exist in the blueprint (Stitch invents these)
 *   - Missing og:image / twitter:image
 *   - Meta description that is still the blueprint's internal purpose text
 *   - Title length
 *
 * Returns patches (safe to auto-apply) and findings (require human action).
 */

import type { PageDefinition, WebsiteBlueprint } from "../schemas/blueprint.types.js";
import type { HtmlPatch, HtmlReviewResult, ReviewFinding } from "./stitch-html-review.types.js";

export function reviewSEO(
  html: string,
  page: PageDefinition,
  blueprint: WebsiteBlueprint
): HtmlReviewResult {
  const patches: HtmlPatch[] = [];
  const findings: ReviewFinding[] = [];

  // ── 1. JSON-LD: rewrite with correct @type, url, and hours ──────────────────
  if (html.includes('"@context": "https://schema.org"') && page.id === "home") {
    const correctJsonLd = buildCorrectJsonLd(blueprint);
    patches.push({
      description: `JSON-LD: fix @type (${schemaTypeForIndustry(blueprint.business.industry)}), url, and opening hours format`,
      find: /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      replace: `<script type="application/ld+json">\n${JSON.stringify(correctJsonLd, null, 2)}\n</script>`,
    });
  }

  // ── 2. Dead links: routes Stitch invented that don't exist in the blueprint ──
  const validRoutes = new Set(blueprint.pages.map((p) => p.path));
  // Common pages Stitch adds on its own
  const stitch_invented = ["/privacy", "/terms", "/accessibility", "/sitemap", "/blog", "/faq"];
  const deadLinks = stitch_invented.filter((r) => !validRoutes.has(r) && html.includes(`href="${r}"`));

  if (deadLinks.length > 0) {
    findings.push({
      severity: "warning",
      category: "seo",
      rule: "SEO: dead internal links",
      description: `Found ${deadLinks.length} link(s) to routes not in the blueprint: ${deadLinks.join(", ")}`,
      recommendation:
        "Either add these pages to the blueprint and re-run the pipeline, or remove the links before deploying.",
    });
  }

  // ── 3. og:image / twitter:image missing ─────────────────────────────────────
  if (!html.includes('property="og:image"') && !html.includes("property='og:image'")) {
    findings.push({
      severity: "error",
      category: "seo",
      rule: "SEO: og:image missing",
      description: "No og:image meta tag found. Social sharing previews will have no image.",
      recommendation:
        'Add <meta property="og:image" content="https://yourdomain.com/og-image.jpg"> in the blueprint\'s openGraph config.',
    });
  }

  // ── 4. Meta description looks like blueprint purpose text ───────────────────
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  if (descMatch) {
    const desc = descMatch[1];
    const purposePhrases = [
      "convert visitors",
      "showcase brand",
      "drive bookings",
      "highlight services",
      "establish credibility",
    ];
    const looksLikePurpose = purposePhrases.some((p) =>
      desc.toLowerCase().includes(p.toLowerCase())
    );
    if (looksLikePurpose) {
      findings.push({
        severity: "error",
        category: "seo",
        rule: "SEO: meta description is internal blueprint text",
        description: `Meta description appears to be the page's internal purpose field: "${desc.slice(0, 80)}..."`,
        recommendation:
          "Replace with a consumer-facing description (50–160 chars) before deploying. Update seo.pageMeta in the blueprint.",
      });
    } else if (desc.length < 50) {
      findings.push({
        severity: "warning",
        category: "seo",
        rule: "SEO: meta description too short",
        description: `Meta description is ${desc.length} chars (minimum 50 recommended).`,
        recommendation: "Expand the description in the blueprint's seo.pageMeta for this page.",
      });
    } else if (desc.length > 160) {
      findings.push({
        severity: "warning",
        category: "seo",
        rule: "SEO: meta description too long",
        description: `Meta description is ${desc.length} chars (maximum 160 before Google truncates).`,
        recommendation: "Shorten the description in the blueprint's seo.pageMeta for this page.",
      });
    }
  }

  // ── 5. Title length ──────────────────────────────────────────────────────────
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    // HTML entities count as their decoded character for display length
    const title = titleMatch[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    if (title.length > 60) {
      findings.push({
        severity: "warning",
        category: "seo",
        rule: "SEO: title too long",
        description: `Page title is ${title.length} chars. Google truncates at ~60 in SERPs.`,
        recommendation: "Shorten the title in the blueprint's seo.pageMeta for this page.",
      });
    }
  }

  // ── 6. Canonical / og:url relative ──────────────────────────────────────────
  if (html.includes('href="/"') && html.includes('rel="canonical"')) {
    findings.push({
      severity: "warning",
      category: "seo",
      rule: "SEO: canonical URL is relative",
      description: 'Canonical link is set to "/" (relative). Search engines expect an absolute URL.',
      recommendation:
        "Set openGraph.url in the blueprint (e.g. https://glowandgobar.com) before deploying.",
    });
  }

  return { patches, findings };
}

// ─── JSON-LD builder ──────────────────────────────────────────────────────────

function buildCorrectJsonLd(blueprint: WebsiteBlueprint): Record<string, unknown> {
  const { business, seo } = blueprint;
  const siteUrl = seo.openGraph["url"] ?? "";

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaTypeForIndustry(business.industry),
    name: business.name,
    description: business.description,
    url: siteUrl || undefined,
    telephone: business.phone,
    email: business.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address,
    },
  };

  const hours = buildOpeningHoursSpec(business.operatingHours);
  if (hours.length > 0) ld["openingHoursSpecification"] = hours;

  const socials = Object.values(business.socialLinks).filter(Boolean);
  if (socials.length > 0) ld["sameAs"] = socials;

  return ld;
}

function schemaTypeForIndustry(industry: string): string {
  const s = industry.toLowerCase();
  if (/beauty|salon|hair|nail|lash|blowout/i.test(s)) return "BeautySalon";
  if (/wellness|massage|yoga|spa/i.test(s)) return "HealthAndBeautyBusiness";
  if (/medical|clinic|dental|doctor/i.test(s)) return "MedicalClinic";
  if (/restaurant|cafe|bistro|dining/i.test(s)) return "Restaurant";
  return "LocalBusiness";
}

// ─── Opening hours converter ──────────────────────────────────────────────────

const DAY_EXPANSIONS: Record<string, string[]> = {
  "Monday–Wednesday": ["Monday", "Tuesday", "Wednesday"],
  "Monday-Wednesday": ["Monday", "Tuesday", "Wednesday"],
  "Monday–Thursday": ["Monday", "Tuesday", "Wednesday", "Thursday"],
  "Monday-Thursday": ["Monday", "Tuesday", "Wednesday", "Thursday"],
  "Monday–Friday": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "Monday-Friday": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "Thursday–Friday": ["Thursday", "Friday"],
  "Thursday-Friday": ["Thursday", "Friday"],
  "Saturday–Sunday": ["Saturday", "Sunday"],
  "Saturday-Sunday": ["Saturday", "Sunday"],
  Weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  Weekends: ["Saturday", "Sunday"],
};

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function expandDays(key: string): string[] {
  return DAY_EXPANSIONS[key] ?? (ALL_DAYS.includes(key) ? [key] : [key]);
}

function to24h(time: string): string {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return time;
  let h = parseInt(m[1]);
  const min = m[2];
  const period = m[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function buildOpeningHoursSpec(
  operatingHours: Record<string, string>
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  for (const [dayKey, rangeStr] of Object.entries(operatingHours)) {
    if (/closed/i.test(rangeStr)) continue;
    const parts = rangeStr.split(/[–\-]/).map((s) => s.trim());
    const opens = parts[0] ? to24h(parts[0]) : "";
    const closes = parts[1] ? to24h(parts[1]) : "";
    for (const day of expandDays(dayKey)) {
      result.push({ "@type": "OpeningHoursSpecification", dayOfWeek: day, opens, closes });
    }
  }
  return result;
}
