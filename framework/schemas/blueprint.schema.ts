/**
 * Zod schema for the WebsiteBlueprint.
 * Validates the complete blueprint before it is written to disk.
 * Produces actionable error messages that identify the failing section.
 */

import { z } from "zod";

// ─── Primitives ───────────────────────────────────────────────────────────────

const PageCTASchema = z.object({
  label: z.string().min(1, "CTA label must not be empty"),
  href: z.string().min(1, "CTA href must not be empty"),
});

// ─── project ─────────────────────────────────────────────────────────────────

const ProjectSchema = z.object({
  schemaVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  sourceFile: z.string().min(1),
  frameworkVersion: z.string().min(1),
});

// ─── business ────────────────────────────────────────────────────────────────

const BusinessSchema = z.object({
  name: z.string().min(1, "business.name is required"),
  industry: z.string().min(1, "business.industry is required"),
  description: z.string(),
  location: z.string(),
  address: z.string(),
  serviceAreas: z.array(z.string()),
  phone: z.string(),
  email: z.string(),
  operatingHours: z.record(z.string()),
  socialLinks: z.record(z.string()),
  booking: z.string(),
  services: z.array(z.string()),
  complianceFlags: z.array(z.string()),
  missingInformation: z.array(z.string()),
});

// ─── pages ────────────────────────────────────────────────────────────────────

const PageSchema = z.object({
  id: z.string().min(1, "page.id is required"),
  path: z.string().startsWith("/", "page.path must start with /"),
  title: z.string().min(1, "page.title is required"),
  purpose: z.string(),
  sections: z.array(z.string()),
  primaryCTA: PageCTASchema.nullable(),
  secondaryCTA: PageCTASchema.nullable(),
  requiredContent: z.array(z.string()),
  componentHints: z.array(z.string()),
});

// ─── ux ──────────────────────────────────────────────────────────────────────

const ColorPaletteSchema = z.object({
  primary: z.string().min(1),
  secondary: z.string().min(1),
  accent: z.string().min(1),
  text: z.string().min(1),
  background: z.string().min(1),
  border: z.string(),
});

const TypographySchema = z.object({
  headingFont: z.string().min(1),
  bodyFont: z.string().min(1),
  scaleBase: z.string(),
  headingWeight: z.string(),
});

const NavItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  external: z.boolean().optional(),
});

// HeroStyleSchema bridges colorPalette values to concrete rendering instructions.
// The UX Agent is responsible for outputting this; the site generator consumes it directly.
// This replaces the previous pattern of burying visual intent in prose componentHints strings.
const HeroStyleSchema = z.object({
  backgroundType: z.enum(["solid", "gradient", "image"], {
    errorMap: () => ({ message: "ux.heroStyle.backgroundType must be 'solid', 'gradient', or 'image'" }),
  }),
  backgroundColor: z.string().optional(),
  gradientFrom: z.string().optional(),
  gradientTo: z.string().optional(),
  textColor: z.string().min(1, "ux.heroStyle.textColor is required"),
  overlayOpacity: z.number().min(0).max(1).optional(),
});

const UXSchema = z.object({
  brandPersonality: z.array(z.string()).min(1, "ux.brandPersonality must have at least one entry"),
  colorPalette: ColorPaletteSchema,
  typography: TypographySchema,
  layoutGuidelines: z.array(z.string()),
  navigation: z.array(NavItemSchema).min(1, "ux.navigation must have at least one item"),
  header: z.object({
    sticky: z.boolean(),
    showPhone: z.boolean(),
    showCTA: z.boolean(),
    ctaLabel: z.string(),
    ctaHref: z.string(),
  }),
  footer: z.object({
    columns: z.array(z.string()),
    showHours: z.boolean(),
    showSocial: z.boolean(),
    showAddress: z.boolean(),
    legalNote: z.string(),
  }),
  heroStyle: HeroStyleSchema,
  homepageStrategy: z.string().min(1, "ux.homepageStrategy is required"),
  componentStrategy: z.array(z.string()),
  responsiveBehavior: z.array(z.string()),
  contentHierarchy: z.array(z.string()),
});

// ─── seo ─────────────────────────────────────────────────────────────────────

const PageMetaSchema = z.object({
  pageId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
});

const SEOSchema = z.object({
  siteTitle: z.string().min(1, "seo.siteTitle is required"),
  defaultMetaDescription: z.string().min(1, "seo.defaultMetaDescription is required"),
  pageMeta: z.array(PageMetaSchema),
  h1Rules: z.array(z.string()),
  h2Rules: z.array(z.string()),
  localSeo: z.array(z.string()),
  structuredDataRecommendations: z.array(z.string()),
  openGraph: z.record(z.string()),
  imageAltTextRequirements: z.array(z.string()),
  internalLinking: z.array(z.string()),
  indexabilityRules: z.array(z.string()),
});

// ─── accessibility ────────────────────────────────────────────────────────────

const QACheckItemSchema = z.object({
  rule: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["must", "should", "nice-to-have"]),
});

const AccessibilitySchema = z.object({
  targetStandard: z.string().min(1, "accessibility.targetStandard is required"),
  semanticHtmlRequirements: z.array(z.string()),
  landmarkRequirements: z.array(z.string()),
  keyboardNavigationRequirements: z.array(z.string()),
  colorContrastRequirements: z.array(z.string()),
  formLabelRequirements: z.array(z.string()),
  imageAltTextRequirements: z.array(z.string()),
  focusStateRequirements: z.array(z.string()),
  ariaGuidelines: z.array(z.string()),
  reducedMotionGuidelines: z.array(z.string()),
  qaChecklist: z.array(QACheckItemSchema).min(1, "accessibility.qaChecklist must not be empty"),
});

// ─── frontend ────────────────────────────────────────────────────────────────

const ComponentMapEntrySchema = z.object({
  component: z.string().min(1),
  usedIn: z.array(z.string()),
  props: z.array(z.string()),
});

const RouteSchema = z.object({
  path: z.string().startsWith("/"),
  pageId: z.string().min(1),
  file: z.string().min(1),
});

const FrontendSchema = z.object({
  framework: z.string().min(1, "frontend.framework is required"),
  renderingMode: z.string().min(1, "frontend.renderingMode is required"),
  componentMap: z.array(ComponentMapEntrySchema),
  routes: z.array(RouteSchema),
  assets: z.record(z.string()),
  forms: z.record(z.string()),
  externalIntegrations: z.array(z.string()),
  unsupportedFeatures: z.array(z.string()),
  implementationNotes: z.array(z.string()),
});

// ─── qa ──────────────────────────────────────────────────────────────────────

const QASchema = z.object({
  expectedReports: z.array(z.string()),
  lighthouseTargets: z.record(z.number()),
  accessibilityChecks: z.array(z.string()),
  seoChecks: z.array(z.string()),
  knownLimitations: z.array(z.string()),
});

// ─── Root ─────────────────────────────────────────────────────────────────────

export const WebsiteBlueprintSchema = z.object({
  project: ProjectSchema,
  business: BusinessSchema,
  pages: z.array(PageSchema).min(1, "Blueprint must define at least one page"),
  ux: UXSchema,
  seo: SEOSchema,
  accessibility: AccessibilitySchema,
  frontend: FrontendSchema,
  qa: QASchema,
});

export type ValidationSuccess = { ok: true; blueprint: import("./blueprint.types.js").WebsiteBlueprint };
export type ValidationFailure = { ok: false; errors: string[] };
export type ValidationResult = ValidationSuccess | ValidationFailure;

export function validateBlueprint(data: unknown): ValidationResult {
  const result = WebsiteBlueprintSchema.safeParse(data);

  if (result.success) {
    return { ok: true, blueprint: result.data as import("./blueprint.types.js").WebsiteBlueprint };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    const section = issue.path[0] ?? "root";
    return `[${section}] ${path ? `${path}: ` : ""}${issue.message}`;
  });

  return { ok: false, errors };
}
