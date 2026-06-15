/**
 * UX Agent — Senior UX/Product Designer
 *
 * Owns: blueprint.ux + blueprint.pages
 *
 * Local mode: derives the UX blueprint from intake data + Markdown color/tone sections.
 * Industry type is inferred from business.industry to select the right page strategy.
 *
 * OPENAI INTEGRATION POINT:
 *   const response = await openai.chat.completions.create({
 *     model: process.env.OPENAI_MODEL ?? "gpt-4o",
 *     messages: [
 *       { role: "system", content: readPrompt("ux.prompt.md") },
 *       { role: "user", content: JSON.stringify({ business, desiredPages, brandTone, colorPreferences }) },
 *     ],
 *     response_format: { type: "json_object" },
 *   });
 */

import type { AgentConfig } from "../orchestrator/agent-runner.js";
import type { WorkflowState } from "../orchestrator/workflow-state.js";
import type { WebsiteBlueprint, UXData, PageDefinition, ColorPalette, HeroStyle } from "../schemas/blueprint.types.js";
import { getSection, extractHex } from "../core/markdown-parser.js";

// ─── Industry detection ───────────────────────────────────────────────────────

type IndustryType = "beauty" | "wellness" | "medical" | "restaurant" | "default";

function detectIndustry(industry: string): IndustryType {
  const lower = industry.toLowerCase();
  if (/salon|beauty|nail|hair|lash|brow|wax/.test(lower)) return "beauty";
  if (/spa|massage|wellness|yoga|meditation|holistic/.test(lower)) return "wellness";
  if (/medical|clinic|dental|doctor|physician|health center|urgent care/.test(lower)) return "medical";
  if (/restaurant|cafe|diner|bistro|food|bakery|coffee/.test(lower)) return "restaurant";
  return "default";
}

// ─── Page templates by industry ──────────────────────────────────────────────

interface PageTemplate {
  purpose: string;
  sections: string[];
  primaryCTA: { label: string; href: string } | null;
  secondaryCTA: { label: string; href: string } | null;
  requiredContent: string[];
  componentHints: string[];
}

const PAGE_TEMPLATES: Record<IndustryType, Record<string, PageTemplate>> = {
  beauty: {
    home: {
      purpose: "Convert visitors to bookings; showcase brand and top services",
      sections: ["Hero", "ServicesGrid", "TestimonialsSection", "GallerySection", "BookingCTA", "HoursBlock"],
      primaryCTA: { label: "Book Now", href: "/book" },
      secondaryCTA: { label: "View Services", href: "/services" },
      requiredContent: ["Hero headline and tagline", "Featured services (3–6)", "Client testimonials (3–5)", "Gallery preview (6 images)"],
      componentHints: ["Full-width hero with brand color overlay", "Services in 3-column grid", "Testimonials in horizontal scroll on mobile"],
    },
    services: {
      purpose: "Detail all services with descriptions and pricing",
      sections: ["ServicesGrid"],
      primaryCTA: { label: "Book This Service", href: "/book" },
      secondaryCTA: null,
      requiredContent: ["Service name", "Description (1–2 sentences)", "Starting price (if available)"],
      componentHints: ["Full-width service cards with pricing", "Group by category if > 8 services"],
    },
    gallery: {
      purpose: "Showcase before/after and finished work to build confidence",
      sections: ["GallerySection"],
      primaryCTA: { label: "Book Now", href: "/book" },
      secondaryCTA: null,
      requiredContent: ["Filterable images by service category", "Alt text for each image"],
      componentHints: ["Masonry or grid layout", "Filter buttons: All / Hair / Nails / Skincare"],
    },
    about: {
      purpose: "Build trust through team bios and brand story",
      sections: ["Hero", "TestimonialsSection"],
      primaryCTA: { label: "Meet Our Team", href: "#team" },
      secondaryCTA: { label: "Book Now", href: "/book" },
      requiredContent: ["Brand story (2–3 paragraphs)", "Team member bios with photos", "Values or mission statement"],
      componentHints: ["Compact hero with team photo", "Team cards in 3-column grid"],
    },
    contact: {
      purpose: "Provide all contact information and operating hours",
      sections: ["ContactSection", "HoursBlock"],
      primaryCTA: { label: "Book Appointment", href: "/book" },
      secondaryCTA: null,
      requiredContent: ["Phone number (click-to-call)", "Email address", "Physical address", "Operating hours"],
      componentHints: ["Address uses <address> semantic element", "Phone as <a href='tel:'>"],
    },
  },
  wellness: {
    home: {
      purpose: "Create a calming first impression; drive booking and gift card sales",
      sections: ["Hero", "ServicesGrid", "TestimonialsSection", "BookingCTA", "HoursBlock"],
      primaryCTA: { label: "Book a Session", href: "/book" },
      secondaryCTA: { label: "Gift Cards", href: "/gift-cards" },
      requiredContent: ["Calming hero headline", "Featured services (4–6)", "Client testimonials (3–5)", "Gift card callout"],
      componentHints: ["Soft, nature-inspired hero image", "Services with duration and starting price"],
    },
    services: {
      purpose: "Present service menu with duration, benefits, and pricing",
      sections: ["ServicesGrid", "FAQSection"],
      primaryCTA: { label: "Book Now", href: "/book" },
      secondaryCTA: null,
      requiredContent: ["Service name", "Duration", "Benefits (2–3 bullet points)", "Starting price"],
      componentHints: ["Service cards with expandable detail", "FAQ at bottom: What to expect, What to wear"],
    },
    about: {
      purpose: "Communicate philosophy, credentials, and brand story",
      sections: ["Hero", "TestimonialsSection"],
      primaryCTA: { label: "Book Now", href: "/book" },
      secondaryCTA: null,
      requiredContent: ["Philosophy statement", "Practitioner bios and credentials", "Studio environment description"],
      componentHints: ["Warm, editorial-style hero", "Testimonials emphasizing transformation"],
    },
    contact: {
      purpose: "Directions, hours, and easy booking access",
      sections: ["ContactSection", "HoursBlock", "FAQSection"],
      primaryCTA: { label: "Book a Session", href: "/book" },
      secondaryCTA: null,
      requiredContent: ["Address with parking info", "Phone and email", "Hours", "First-visit FAQ"],
      componentHints: ["Parking info note below address"],
    },
  },
  medical: {
    home: {
      purpose: "Establish credibility; direct patients to the right service or provider",
      sections: ["Hero", "ServicesGrid", "HoursBlock", "CTASection", "ContactSection"],
      primaryCTA: { label: "Request Appointment", href: "/contact" },
      secondaryCTA: { label: "Our Services", href: "/services" },
      requiredContent: ["Clear hero: who you are + who you serve", "Key services (4–6)", "Accepting new patients notice", "Hours"],
      componentHints: ["Professional hero — no stock photo clichés", "Services as accessible cards", "Prominent 'Accepting New Patients' badge"],
    },
    services: {
      purpose: "List services clearly for patients researching care options",
      sections: ["ServicesGrid"],
      primaryCTA: { label: "Contact Us", href: "/contact" },
      secondaryCTA: null,
      requiredContent: ["Service name", "Brief plain-language description", "No pricing (refer to office)"],
      componentHints: ["Group by category: Preventive / Acute / Specialty", "Avoid medical jargon"],
    },
    contact: {
      purpose: "Enable patients to reach the practice and find the location",
      sections: ["ContactSection", "HoursBlock"],
      primaryCTA: { label: "Call Us", href: "tel:" },
      secondaryCTA: { label: "Request Appointment", href: "/new-patients" },
      requiredContent: ["Phone (click-to-call)", "Fax", "Address with transit info", "Hours", "General inquiry disclaimer"],
      componentHints: ["Prominent disclaimer: not for medical advice or emergencies", "Click-to-call button visible on mobile"],
    },
  },
  restaurant: {
    home: {
      purpose: "Drive reservations and highlight menu/atmosphere",
      sections: ["Hero", "GallerySection", "ServicesGrid", "HoursBlock", "ContactSection"],
      primaryCTA: { label: "Reserve a Table", href: "/contact" },
      secondaryCTA: { label: "View Menu", href: "/services" },
      requiredContent: ["Appetizing hero image", "Menu highlights", "Hours and location"],
      componentHints: ["Food photography hero", "Menu as service grid", "Hours prominent on homepage"],
    },
    services: {
      purpose: "Present the menu or service offerings",
      sections: ["ServicesGrid"],
      primaryCTA: { label: "Reserve Now", href: "/contact" },
      secondaryCTA: null,
      requiredContent: ["Menu categories", "Dish names and descriptions"],
      componentHints: ["Group by meal category: Starters / Mains / Desserts"],
    },
    contact: {
      purpose: "Reservations, directions, and hours",
      sections: ["ContactSection", "HoursBlock"],
      primaryCTA: { label: "Call to Reserve", href: "tel:" },
      secondaryCTA: null,
      requiredContent: ["Phone", "Address", "Hours"],
      componentHints: [],
    },
  },
  default: {
    home: {
      purpose: "Introduce the business and drive the primary contact/booking action",
      sections: ["Hero", "ServicesGrid", "TestimonialsSection", "CTASection", "ContactSection"],
      primaryCTA: { label: "Contact Us", href: "/contact" },
      secondaryCTA: { label: "Our Services", href: "/services" },
      requiredContent: ["Clear value proposition", "Key services", "Contact information"],
      componentHints: ["Clean, professional hero", "Services in card grid"],
    },
    services: {
      purpose: "Describe services in detail",
      sections: ["ServicesGrid"],
      primaryCTA: { label: "Get in Touch", href: "/contact" },
      secondaryCTA: null,
      requiredContent: ["Service name", "Description"],
      componentHints: [],
    },
    contact: {
      purpose: "Provide all contact information",
      sections: ["ContactSection", "HoursBlock"],
      primaryCTA: { label: "Call Us", href: "tel:" },
      secondaryCTA: null,
      requiredContent: ["Phone", "Email", "Address"],
      componentHints: [],
    },
  },
};

function getPageTemplate(industryType: IndustryType, pageId: string): PageTemplate {
  const industryTemplates = PAGE_TEMPLATES[industryType] ?? PAGE_TEMPLATES.default;
  return industryTemplates[pageId] ?? PAGE_TEMPLATES.default[pageId] ?? PAGE_TEMPLATES.default.home;
}

// ─── Page ID + path derivation ────────────────────────────────────────────────

function toPageId(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
}

function toPath(pageId: string, idx: number): string {
  if (idx === 0) return "/";
  const pathMap: Record<string, string> = {
    "book-online": "/book",
    "book": "/book",
    "booking": "/book",
    "about-us": "/about",
    "about": "/about",
    "our-story": "/about",
    "services": "/services",
    "our-services": "/services",
    "gallery": "/gallery",
    "photos": "/gallery",
    "contact": "/contact",
    "contact-us": "/contact",
    "contact--location": "/contact",
    "faqs": "/faq",
    "faq": "/faq",
    "new-patients": "/new-patients",
    "patient-information": "/patient-info",
    "gift-cards": "/gift-cards",
    "our-providers": "/providers",
    "providers": "/providers",
    "team": "/team",
  };
  return pathMap[pageId] ?? `/${pageId}`;
}

// ─── Color palette extraction ─────────────────────────────────────────────────

const INDUSTRY_DEFAULT_COLORS: Record<IndustryType, ColorPalette> = {
  beauty: { primary: "#C4847A", secondary: "#FAF8F5", accent: "#C9A96E", text: "#2C2C2C", background: "#FAF8F5", border: "#EDD9D5" },
  wellness: { primary: "#7A9E7E", secondary: "#F9F6F0", accent: "#C47A5A", text: "#1C1C1C", background: "#F9F6F0", border: "#D4E3D6" },
  medical: { primary: "#1B3A6B", secondary: "#FFFFFF", accent: "#2A9D8F", text: "#2D3748", background: "#FFFFFF", border: "#E2E8F0" },
  restaurant: { primary: "#8B4513", secondary: "#FFF8F0", accent: "#D4A853", text: "#2C2C2C", background: "#FFF8F0", border: "#E8D5C0" },
  default: { primary: "#2563EB", secondary: "#F8FAFC", accent: "#0EA5E9", text: "#1E293B", background: "#F8FAFC", border: "#E2E8F0" },
};

function extractColorPalette(parsed: ReturnType<typeof getSection>, industryType: IndustryType): ColorPalette {
  const defaults = INDUSTRY_DEFAULT_COLORS[industryType];
  if (!parsed) return defaults;

  const kv = parsed.keyValues;
  return {
    primary: extractHex(kv["Primary"] ?? kv["primary"] ?? defaults.primary),
    secondary: extractHex(kv["Secondary"] ?? kv["secondary"] ?? defaults.secondary),
    accent: extractHex(kv["Accent"] ?? kv["accent"] ?? defaults.accent),
    text: extractHex(kv["Text"] ?? kv["text"] ?? defaults.text),
    background: extractHex(kv["Background"] ?? kv["background"] ?? defaults.background),
    border: extractHex(kv["Border"] ?? kv["Borders/subtle backgrounds"] ?? kv["border"] ?? defaults.border),
  };
}

// ─── Hero visual spec ────────────────────────────────────────────────────────
// Derives a machine-readable HeroStyle from the resolved color palette.
// The site generator reads this directly — no more guessing from prose componentHints.

function buildHeroStyle(palette: ColorPalette, industry: IndustryType): HeroStyle {
  switch (industry) {
    case "beauty":
      // Soft gradient from warm cream (secondary) to blush border tone — feminine, luxe
      return {
        backgroundType: "gradient",
        gradientFrom: palette.secondary,
        gradientTo: palette.border,
        textColor: palette.text,
      };
    case "wellness":
      // Gradient from warm off-white (secondary) toward the primary green — calm, natural
      return {
        backgroundType: "gradient",
        gradientFrom: palette.secondary,
        gradientTo: palette.border,
        textColor: palette.text,
      };
    case "medical":
      // Clean solid white — clinical, trustworthy; primary color used only in CTA buttons
      return {
        backgroundType: "solid",
        backgroundColor: palette.background,
        textColor: palette.text,
      };
    case "restaurant":
      // Warm gradient using secondary (cream/buff) to border (light tan) — inviting, appetizing
      return {
        backgroundType: "gradient",
        gradientFrom: palette.secondary,
        gradientTo: palette.border,
        textColor: palette.text,
      };
    default:
      return {
        backgroundType: "gradient",
        gradientFrom: palette.secondary,
        gradientTo: palette.border,
        textColor: palette.text,
      };
  }
}

// ─── Typography by industry ───────────────────────────────────────────────────

const INDUSTRY_TYPOGRAPHY = {
  beauty: { headingFont: "'Cormorant Garamond', Georgia, serif", bodyFont: "'Inter', system-ui, sans-serif", scaleBase: "16px", headingWeight: "600" },
  wellness: { headingFont: "'Playfair Display', Georgia, serif", bodyFont: "'Lato', system-ui, sans-serif", scaleBase: "16px", headingWeight: "400" },
  medical: { headingFont: "'Inter', system-ui, sans-serif", bodyFont: "'Inter', system-ui, sans-serif", scaleBase: "16px", headingWeight: "600" },
  restaurant: { headingFont: "'Libre Baskerville', Georgia, serif", bodyFont: "'Source Sans Pro', system-ui, sans-serif", scaleBase: "16px", headingWeight: "700" },
  default: { headingFont: "system-ui, sans-serif", bodyFont: "system-ui, sans-serif", scaleBase: "16px", headingWeight: "600" },
};

// ─── Main run ─────────────────────────────────────────────────────────────────

async function run(state: WorkflowState): Promise<Partial<WebsiteBlueprint>> {
  const business = state.blueprint.business!;
  const { parsed } = state;

  const industryType = detectIndustry(business.industry);
  const toneSection = getSection(parsed, "tone");
  const colorSection = getSection(parsed, "colors");
  const pagesSection = getSection(parsed, "pages");

  // Desired pages from Markdown, or sensible defaults
  const desiredPageTitles: string[] =
    pagesSection?.items.length
      ? pagesSection.items
      : ["Home", "Services", "About", "Contact"];

  // Build the pages array
  const pages: PageDefinition[] = desiredPageTitles.map((title, idx) => {
    const id = toPageId(title);
    const pathStr = toPath(id, idx);
    const template = getPageTemplate(industryType, id);

    // Resolve "tel:" CTAs with the real phone number
    const resolveCTA = (cta: { label: string; href: string } | null) => {
      if (!cta) return null;
      if (cta.href === "tel:" && business.phone) {
        return { ...cta, href: `tel:${business.phone.replace(/\D/g, "")}` };
      }
      return cta;
    };

    return {
      id,
      path: pathStr,
      title,
      purpose: template.purpose,
      sections: template.sections,
      primaryCTA: resolveCTA(template.primaryCTA),
      secondaryCTA: resolveCTA(template.secondaryCTA),
      requiredContent: template.requiredContent,
      componentHints: template.componentHints,
    };
  });

  // Brand personality from tone section
  const brandPersonality: string[] =
    toneSection?.items.length
      ? toneSection.items
      : ["Professional and approachable", "Clear and trustworthy", "Focused on the client"];

  // Booking CTA label
  const bookingCTALabel = /medical|clinic|dental/.test(business.industry.toLowerCase())
    ? "Request Appointment"
    : /spa|massage|wellness/.test(business.industry.toLowerCase())
    ? "Book a Session"
    : "Book Now";

  const bookingHref = pages.find((p) => p.id === "book" || p.id === "book-online")?.path ?? "/contact";

  const colorPalette = extractColorPalette(colorSection, industryType);
  const typography = INDUSTRY_TYPOGRAPHY[industryType];

  const navigation = pages.map((p) => ({ label: p.title, href: p.path }));

  // heroStyle: machine-readable visual specification for the Hero component.
  // This is the single field the site generator reads to apply visual styling.
  // Previously, this intent was buried as prose in componentHints ("Full-width hero
  // with brand color overlay") — unreadable by the generator. Now it is structured.
  const heroStyle = buildHeroStyle(colorPalette, industryType);

  const ux: UXData = {
    brandPersonality,
    colorPalette,
    typography,
    layoutGuidelines: [
      "Mobile-first responsive design — test at 375px, 768px, 1280px breakpoints",
      "Maximum content width: 1200px, centered with 1.5rem side padding",
      "Generous whitespace to avoid visual clutter",
      "Sticky header with visible booking CTA on all pages",
      "All sections use consistent vertical padding (4rem top/bottom)",
    ],
    navigation,
    header: {
      sticky: true,
      showPhone: Boolean(business.phone),
      showCTA: true,
      ctaLabel: bookingCTALabel,
      ctaHref: bookingHref,
    },
    footer: {
      columns: ["Brand + contact", "Navigation", "Hours"],
      showHours: Object.keys(business.operatingHours).length > 0,
      showSocial: Object.keys(business.socialLinks).length > 0,
      showAddress: Boolean(business.address),
      legalNote: `© ${new Date().getFullYear()} ${business.name}. All rights reserved.`,
    },
    heroStyle,
    homepageStrategy: `Lead with a strong hero showcasing ${business.name}'s primary value proposition. Follow with ${business.services.slice(0, 3).join(", ")} as the featured services. Build trust with testimonials before presenting the booking CTA.`,
    componentStrategy: [
      "AccessibilitySkipLink: first element in every page",
      "Header: sticky, includes CTA button",
      "Hero: used on homepage and About; adapts headline per page",
      "ServicesGrid: card layout, 3 columns on desktop",
      "TestimonialsSection: displayed on Home and About",
      "GallerySection: filterable by category, used on Gallery and Home",
      "BookingCTA: standalone CTA section with accent background",
      "HoursBlock: used on Home, Contact, and Services",
      "ContactSection: used on Contact page; includes phone, email, address",
      "FAQSection: used on Services and Contact pages",
      "Footer: consistent across all pages",
    ],
    responsiveBehavior: [
      "Navigation collapses to hamburger menu at ≤ 768px",
      "ServicesGrid: 3 columns (desktop) → 2 columns (tablet) → 1 column (mobile)",
      "GallerySection: masonry grid adapts from 3 to 2 to 1 column",
      "Hero: font scales with clamp() — no layout shift between breakpoints",
      "Footer: stacked single column on mobile",
      "Touch targets: minimum 44x44px for all interactive elements",
    ],
    contentHierarchy: [
      "H1: Business name + primary service or location (one per page)",
      "H2: Section headings (Services, About, Contact, etc.)",
      "H3: Individual service names, team member names, FAQ questions",
      "Body: Descriptions, hours, address, testimonial text",
      "CTA: Primary action — always visible; secondary action nearby",
    ],
  };

  console.log(`  ✓  UX blueprint — ${pages.length} pages, ${industryType} strategy, ${Object.values(colorPalette).filter(Boolean).length} brand colors`);

  return { ux, pages };
}

export const uxAgent: AgentConfig = {
  name: "UXAgent",
  stage: "ux",
  run,
};
