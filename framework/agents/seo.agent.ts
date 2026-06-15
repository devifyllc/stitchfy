/**
 * SEO Tech-Market Agent — Senior SEO Strategist
 *
 * Owns: blueprint.seo
 *
 * Local mode: generates SEO metadata from business + page data.
 * Applies local SEO best practices for SMB websites.
 *
 * OPENAI INTEGRATION POINT:
 *   const response = await openai.chat.completions.create({
 *     model: process.env.OPENAI_MODEL ?? "gpt-4o",
 *     messages: [
 *       { role: "system", content: readPrompt("seo.prompt.md") },
 *       { role: "user", content: JSON.stringify({ business, pages, ux }) },
 *     ],
 *     response_format: { type: "json_object" },
 *   });
 */

import type { AgentConfig } from "../orchestrator/agent-runner.js";
import type { WorkflowState } from "../orchestrator/workflow-state.js";
import type { WebsiteBlueprint, SEOData, PageMeta } from "../schemas/blueprint.types.js";

// ─── Structured data type by industry ────────────────────────────────────────

function inferJsonLdType(industry: string): string {
  const lower = industry.toLowerCase();
  if (/salon|beauty|nail|hair|lash/.test(lower)) return "BeautySalon";
  if (/spa|massage/.test(lower)) return "DaySpa";
  if (/medical|physician|clinic|urgent care/.test(lower)) return "MedicalClinic";
  if (/dental|dentist/.test(lower)) return "Dentist";
  if (/restaurant|cafe|diner|bistro/.test(lower)) return "Restaurant";
  if (/yoga|fitness|gym/.test(lower)) return "SportsActivityLocation";
  return "LocalBusiness";
}

// ─── Meta description generator ───────────────────────────────────────────────

function buildMetaDescription(name: string, industry: string, services: string[], location: string): string {
  const topServices = services.slice(0, 3).join(", ");
  const loc = location || "your area";
  const cta = /medical|clinic|dental/.test(industry.toLowerCase())
    ? "Accepting new patients."
    : "Book online today.";

  if (topServices) {
    return `${industry} in ${loc}. ${name} offers ${topServices} and more. ${cta}`.slice(0, 160);
  }
  return `${name} — ${industry} in ${loc}. ${cta}`.slice(0, 160);
}

// ─── Page meta generator ──────────────────────────────────────────────────────

function buildPageMeta(
  pages: WebsiteBlueprint["pages"],
  businessName: string,
  industry: string,
  location: string
): PageMeta[] {
  return pages.map((page) => {
    let title: string;
    let description: string;

    switch (page.id) {
      case "home":
        title = `${businessName} | ${industry} in ${location || "your area"}`;
        description = `Welcome to ${businessName}. ${page.purpose}`;
        break;
      case "services":
      case "our-services":
        title = `Services | ${businessName}`;
        description = `Explore all services offered by ${businessName}. ${page.purpose}`;
        break;
      case "gallery":
      case "photos":
        title = `Gallery | ${businessName}`;
        description = `Browse our work at ${businessName}. See before-and-after photos and finished results.`;
        break;
      case "about":
      case "about-us":
        title = `About Us | ${businessName}`;
        description = `Learn about the team and philosophy at ${businessName} in ${location || "your area"}.`;
        break;
      case "contact":
      case "contact-us":
        title = `Contact | ${businessName}`;
        description = `Get in touch with ${businessName}. Find our address, phone, and hours.`;
        break;
      case "book":
      case "book-online":
        title = `Book Online | ${businessName}`;
        description = `Book your appointment online at ${businessName}. Easy, fast scheduling.`;
        break;
      case "new-patients":
        title = `New Patients | ${businessName}`;
        description = `Information for new patients at ${businessName}. ${location ? `Serving ${location}.` : ""}`;
        break;
      case "providers":
      case "our-providers":
        title = `Our Providers | ${businessName}`;
        description = `Meet the healthcare providers at ${businessName}.`;
        break;
      case "gift-cards":
        title = `Gift Cards | ${businessName}`;
        description = `Give the gift of relaxation. Purchase a ${businessName} gift card online.`;
        break;
      default:
        title = `${page.title} | ${businessName}`;
        description = page.purpose;
    }

    return { pageId: page.id, title: title.slice(0, 70), description: description.slice(0, 160) };
  });
}

// ─── Main run ─────────────────────────────────────────────────────────────────

async function run(state: WorkflowState): Promise<Partial<WebsiteBlueprint>> {
  const business = state.blueprint.business!;
  const pages = state.blueprint.pages ?? [];

  const { name, industry, services, location, address } = business;
  const jsonLdType = inferJsonLdType(industry);
  const defaultMetaDescription = buildMetaDescription(name, industry, services, location);
  const pageMeta = buildPageMeta(pages, name, industry, location);

  const siteTitle = `${name} | ${industry}${location ? ` in ${location}` : ""}`.slice(0, 70);

  const seo: SEOData = {
    siteTitle,
    defaultMetaDescription,
    pageMeta,

    h1Rules: [
      "One H1 per page — never more",
      `H1 format for homepage: "${name} — [Primary Service] in ${location || "City, ST"}"`,
      "H1 for inner pages: describe the page content specifically",
      "H1 must contain the primary keyword naturally — no keyword stuffing",
    ],

    h2Rules: [
      "H2s introduce major sections (Services, About, FAQ, etc.)",
      "Use geo-modified keywords in H2s where natural: 'Haircuts in Austin' not just 'Haircuts'",
      "H2s should be scannable — describe the section without needing to read the body",
    ],

    localSeo: [
      `Claim and optimize Google Business Profile for "${name}"`,
      `NAP consistency: "${name}" / "${address}" / "${business.phone}" must be identical everywhere`,
      `Create local citations on Yelp, YellowPages, and ${industry}-specific directories`,
      "Use schema.org LocalBusiness (or sub-type) JSON-LD on every page",
      `Target geo-modified keywords: "${industry} in ${location}", "best ${industry.toLowerCase()} near me"`,
      "Embed Google Maps on Contact page (static iframe, no API key needed)",
      "Encourage Google reviews — display schema-compliant review markup",
    ],

    structuredDataRecommendations: [
      `Use @type: "${jsonLdType}" (extends LocalBusiness)`,
      `Include: name, description, address (PostalAddress), telephone, openingHoursSpecification`,
      `Include: url, image, sameAs (social profile URLs)`,
      "Add @type: WebSite with SearchAction for sitelinks search box potential",
      "Add @type: BreadcrumbList on inner pages",
      services.length > 0 ? `Add @type: Service for each of: ${services.slice(0, 3).join(", ")}` : "Add @type: Service for each service listed",
    ],

    openGraph: {
      "og:type": "website",
      "og:site_name": name,
      "og:title": siteTitle,
      "og:description": defaultMetaDescription,
      "og:image": "/og-image.jpg",
      "og:image:width": "1200",
      "og:image:height": "630",
      "twitter:card": "summary_large_image",
      "twitter:title": siteTitle,
      "twitter:description": defaultMetaDescription,
    },

    imageAltTextRequirements: [
      "All images must have descriptive alt text — never empty or generic ('image1.jpg')",
      "For service/gallery images: describe the result + service type (e.g., 'Balayage color treatment — blonde highlights on brunette hair')",
      "For team photos: include name and role (e.g., 'Sarah M., Senior Stylist at Luxe Beauty Studio')",
      "For hero/banner images: describe the scene and mood, not just 'hero background'",
      "Decorative-only images: use alt='' and role='presentation'",
    ],

    internalLinking: [
      "Every page must link to at least one other page",
      "Service mentions in body copy should link to the /services page",
      "All CTAs ('Book Now', 'Contact Us') must link to the correct destination page",
      "Footer navigation duplicates primary navigation for crawlability",
      "Add 'You might also like' or related services on inner pages",
    ],

    indexabilityRules: [
      "robots.txt: allow all — no pages should be blocked for this SMB site",
      "Generate sitemap.xml at /sitemap.xml listing all pages with <lastmod>",
      "canonical tags on every page to prevent duplicate content",
      "No noindex tags unless specifically needed (e.g., /thank-you pages)",
      "All pages must return HTTP 200 status in the static export",
    ],
  };

  console.log(`  ✓  SEO metadata — ${jsonLdType} structured data, ${pageMeta.length} page meta entries`);

  return { seo };
}

export const seoAgent: AgentConfig = {
  name: "SEOAgent",
  stage: "seo",
  run,
};
