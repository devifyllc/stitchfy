/**
 * Frontend Agent — Senior React/Next.js/TypeScript Engineer
 *
 * Owns: blueprint.frontend + blueprint.qa
 *
 * Local mode: derives component map, routes, assets, and QA configuration
 * from the pages and UX blueprint produced by earlier agents.
 *
 * The generated website is a static Next.js export (output: 'export').
 * No server-side runtime, no API routes, no database.
 *
 * OPENAI INTEGRATION POINT:
 *   const response = await openai.chat.completions.create({
 *     model: process.env.OPENAI_MODEL ?? "gpt-4o",
 *     messages: [
 *       { role: "system", content: readPrompt("frontend.prompt.md") },
 *       { role: "user", content: JSON.stringify({ business, pages, ux, seo, accessibility }) },
 *     ],
 *     response_format: { type: "json_object" },
 *   });
 */

import type { AgentConfig } from "../orchestrator/agent-runner.js";
import type { WorkflowState } from "../orchestrator/workflow-state.js";
import type { WebsiteBlueprint, FrontendData, QAData, ComponentMapEntry, Route } from "../schemas/blueprint.types.js";

// ─── Component catalogue ──────────────────────────────────────────────────────

const COMPONENT_CATALOGUE: Record<string, { props: string[]; description: string }> = {
  AccessibilitySkipLink: { props: [], description: "Skip to main content — first element on every page" },
  Header: { props: ["businessName", "navigation", "showPhone", "phone", "showCTA", "ctaLabel", "ctaHref"], description: "Sticky site header with logo and navigation" },
  Footer: { props: ["businessName", "navigation", "contact", "social", "hours", "legalNote"], description: "Site footer with NAP, links, and social" },
  Hero: { props: ["headline", "subheadline", "primaryCta", "secondaryCta", "backgroundImage"], description: "Full-width hero section" },
  ServicesGrid: { props: ["heading", "items", "showPrice"], description: "Card grid of services" },
  TestimonialsSection: { props: ["heading", "testimonials"], description: "Client testimonials grid" },
  GallerySection: { props: ["heading", "images", "categories", "filterable"], description: "Filterable image gallery" },
  BookingCTA: { props: ["headline", "subheadline", "cta"], description: "Standalone booking call-to-action section" },
  HoursBlock: { props: ["heading", "hours"], description: "Operating hours table" },
  ContactSection: { props: ["heading", "contact", "showDisclaimer"], description: "Contact info block with NAP and inquiry note" },
  CTASection: { props: ["headline", "subheadline", "cta", "variant"], description: "General CTA section with dark or light variant" },
  FAQSection: { props: ["heading", "items"], description: "Accordion or definition-list FAQ section" },
};

// ─── Compute component map ────────────────────────────────────────────────────

function buildComponentMap(pages: WebsiteBlueprint["pages"]): ComponentMapEntry[] {
  const usage: Record<string, Set<string>> = {};

  // Header and Footer appear on all pages
  usage["Header"] = new Set(["all"]);
  usage["Footer"] = new Set(["all"]);
  usage["AccessibilitySkipLink"] = new Set(["all"]);

  for (const page of pages) {
    for (const section of page.sections) {
      if (!usage[section]) usage[section] = new Set();
      usage[section].add(page.id);
    }
  }

  return Object.entries(usage).map(([component, pageSet]) => ({
    component,
    usedIn: [...pageSet],
    props: COMPONENT_CATALOGUE[component]?.props ?? [],
  }));
}

// ─── Compute routes ───────────────────────────────────────────────────────────

function buildRoutes(pages: WebsiteBlueprint["pages"]): Route[] {
  return pages.map((page) => {
    const relativePath = page.path === "/" ? "app/page.tsx" : `app${page.path}/page.tsx`;
    return { path: page.path, pageId: page.id, file: relativePath };
  });
}

// ─── External integrations ────────────────────────────────────────────────────

function detectExternalIntegrations(business: WebsiteBlueprint["business"]): string[] {
  const integrations: string[] = [];

  const booking = business.booking.toLowerCase();
  if (/vagaro/.test(booking)) integrations.push("Vagaro booking (external link — no SDK or embed)");
  if (/mindbody/.test(booking)) integrations.push("Mindbody booking (external link — no SDK)");
  if (/styleseat/.test(booking)) integrations.push("StyleSeat booking (external link — no SDK)");
  if (/square|acuity|calendly/.test(booking)) integrations.push("Third-party booking platform (external link)");
  if (!integrations.length && booking) integrations.push("Booking via phone or external platform (external link)");

  if (Object.keys(business.socialLinks).length > 0) {
    integrations.push("Social media links (external <a> tags — no SDK or embed)");
  }

  integrations.push("Google Maps embed (static iframe — no API key required)");

  return integrations;
}

// ─── QA configuration ────────────────────────────────────────────────────────

function buildQA(pages: WebsiteBlueprint["pages"], business: WebsiteBlueprint["business"]): QAData {
  const hasGallery = pages.some((p) => p.sections.includes("GallerySection"));
  const hasContact = pages.some((p) => p.sections.includes("ContactSection"));
  const hasMedical = business.complianceFlags.includes("medical-context");

  const knownLimitations = [
    "Gallery filtering requires JavaScript — with JS disabled, all images are shown (graceful degradation)",
    "Booking links navigate to an external platform — no on-site confirmation or calendar",
    "Contact form is a static mailto link — no server-side processing or spam protection",
    "No real-time availability information",
    "No account creation, login, or session management",
    "No payment processing — pricing is informational only",
    ...(hasMedical ? ["No patient portal, EHR integration, or HIPAA-grade forms"] : []),
    "OpenGraph og:image requires a real image at /public/og-image.jpg (1200×630px) — placeholder used in dev",
  ];

  return {
    expectedReports: [
      "output/reports/accessibility-report.md",
      "output/reports/seo-report.md",
      "output/reports/final-report.md",
    ],
    lighthouseTargets: {
      performance: 90,
      accessibility: 95,
      "best-practices": 90,
      seo: 95,
    },
    accessibilityChecks: [
      "Run axe-core against all pages in output/static-site/",
      "Manual keyboard tab-order test: Home, Services, Contact",
      "Screen reader test with VoiceOver (macOS) or NVDA (Windows)",
      "Color contrast check: primary button, body text, footer text",
      "Skip link visible and functional on first Tab keypress",
      ...(hasGallery ? ["Gallery: keyboard navigation through filter buttons and images"] : []),
      ...(hasContact ? ["Contact: form labels linked, required fields marked, error states announced"] : []),
    ],
    seoChecks: [
      "Confirm each page has a unique <title> and <meta name='description'>",
      "Confirm canonical <link> tag present on every page",
      "Validate JSON-LD with Google Rich Results Test",
      "Check sitemap.xml is generated and all pages are listed",
      "Verify robots.txt does not block any page",
      "Open Graph tags: validate with LinkedIn / Facebook debugger",
      "Image alt text: run alt text audit across all pages",
    ],
    knownLimitations,
  };
}

// ─── Main run ─────────────────────────────────────────────────────────────────

async function run(state: WorkflowState): Promise<Partial<WebsiteBlueprint>> {
  const business = state.blueprint.business!;
  const pages = state.blueprint.pages ?? [];
  const ux = state.blueprint.ux!;

  const componentMap = buildComponentMap(pages);
  const routes = buildRoutes(pages);
  const externalIntegrations = detectExternalIntegrations(business);

  const frontend: FrontendData = {
    framework: "Next.js 14 (App Router)",
    renderingMode: "Static Export — output: 'export' in next.config.ts. Produces pure HTML/CSS/JS. No server runtime required.",

    componentMap,
    routes,

    assets: {
      "og-image": "public/og-image.jpg — 1200×630px, < 300KB",
      "favicon": "public/favicon.ico — 32×32px and 16×16px",
      "logo-svg": "public/logo.svg — vector logo for header and footer",
      "placeholder-service": "public/images/service-placeholder.jpg — 800×600px fallback for missing service images",
    },

    forms: {
      contact: "General inquiry only — static mailto link or third-party form service (Formspree, etc.). No server-side processing. Includes disclaimer: 'Not for medical advice or emergencies.'",
    },

    externalIntegrations,

    unsupportedFeatures: [
      "Real-time booking engine or availability calendar",
      "Payment processing or e-commerce checkout",
      "User accounts, registration, or authentication",
      "Database persistence or backend API routes",
      "CRM integration (Salesforce, HubSpot, etc.)",
      "HIPAA-grade forms or electronic health records",
      "Server-side rendered (SSR) or incremental static regeneration (ISR) pages",
      "Image optimization via next/image with a remote server (unoptimized: true in static export)",
    ],

    implementationNotes: [
      `Color palette is defined as CSS custom properties in site-template/app/globals.css — primary: ${ux.colorPalette.primary}`,
      "All pages use Next.js App Router (app/) with generateStaticParams for static generation",
      "No dynamic routes — all paths are pre-rendered at build time",
      "Images use <img> with explicit width/height or next/image with unoptimized: true",
      "Site is deployable to AWS S3, CloudFront, Netlify, Vercel static, or any static host",
      "Run 'next build' inside output/generated-site/ to export to output/static-site/",
      `Typography: headings use ${ux.typography.headingFont}, body uses ${ux.typography.bodyFont}`,
    ],
  };

  const qa = buildQA(pages, business);

  console.log(`  ✓  Frontend blueprint — ${componentMap.length} components, ${routes.length} routes, static export`);

  return { frontend, qa };
}

export const frontendAgent: AgentConfig = {
  name: "FrontendAgent",
  stage: "frontend",
  run,
};
