/**
 * Accessibility Agent — WCAG-Oriented Accessibility Specialist
 *
 * Owns: blueprint.accessibility
 *
 * Target standard: WCAG 2.1 Level AA
 *
 * IMPORTANT: This agent produces an accessibility-oriented review against
 * the Stitchfy framework checklist. It does NOT claim ADA legal compliance.
 * ADA compliance for any specific deployment requires independent legal counsel.
 *
 * OPENAI INTEGRATION POINT:
 *   const response = await openai.chat.completions.create({
 *     model: process.env.OPENAI_MODEL ?? "gpt-4o",
 *     messages: [
 *       { role: "system", content: readPrompt("accessibility.prompt.md") },
 *       { role: "user", content: JSON.stringify({ business, pages, ux, complianceFlags }) },
 *     ],
 *     response_format: { type: "json_object" },
 *   });
 */

import type { AgentConfig } from "../orchestrator/agent-runner.js";
import type { WorkflowState } from "../orchestrator/workflow-state.js";
import type { WebsiteBlueprint, AccessibilityData, QACheckItem } from "../schemas/blueprint.types.js";

// ─── Base checklist (all sites) ───────────────────────────────────────────────

const BASE_CHECKLIST: QACheckItem[] = [
  { rule: "skip-link", description: "Skip to main content link is the first focusable element on every page", priority: "must" },
  { rule: "lang-attribute", description: "HTML <html> element has a valid lang attribute (e.g., lang='en')", priority: "must" },
  { rule: "page-title", description: "Each page has a unique, descriptive <title> element", priority: "must" },
  { rule: "heading-order", description: "Headings are used in order (H1 → H2 → H3) — no levels skipped", priority: "must" },
  { rule: "one-h1", description: "Each page has exactly one H1 element", priority: "must" },
  { rule: "color-contrast-normal", description: "Normal text achieves a minimum 4.5:1 contrast ratio (WCAG AA)", priority: "must" },
  { rule: "color-contrast-large", description: "Large text (18pt+ or 14pt+ bold) achieves a minimum 3:1 contrast ratio", priority: "must" },
  { rule: "image-alt-text", description: "All informational images have descriptive alt text; decorative images use alt=''", priority: "must" },
  { rule: "interactive-accessible", description: "All interactive elements (links, buttons) are operable via keyboard", priority: "must" },
  { rule: "focus-visible", description: "Keyboard focus state is clearly visible — min 3px outline, not removed with outline:none", priority: "must" },
  { rule: "link-purpose", description: "Link text describes the destination — no 'click here' or 'read more' without context", priority: "must" },
  { rule: "button-accessible-name", description: "All buttons have an accessible name (text content or aria-label)", priority: "must" },
  { rule: "phone-tel-link", description: "Phone numbers are wrapped in <a href='tel:...'> for mobile users", priority: "must" },
  { rule: "address-element", description: "Physical addresses use the <address> semantic element", priority: "should" },
  { rule: "landmark-banner", description: "Page has a <header role='banner'> landmark", priority: "must" },
  { rule: "landmark-navigation", description: "Page has a <nav aria-label='...''> landmark", priority: "must" },
  { rule: "landmark-main", description: "Page has a <main id='main-content'> landmark", priority: "must" },
  { rule: "landmark-contentinfo", description: "Page has a <footer role='contentinfo'> landmark", priority: "must" },
  { rule: "list-semantic", description: "Navigation and service lists use <ul>/<ol> with <li> elements", priority: "must" },
  { rule: "reduced-motion", description: "@media (prefers-reduced-motion) disables or reduces all animations and transitions", priority: "should" },
  { rule: "touch-target-size", description: "Interactive elements are at least 44×44px on touch devices", priority: "should" },
  { rule: "no-auto-play", description: "No audio or video autoplays — user must initiate all media", priority: "must" },
  { rule: "viewport-zoom", description: "Page does not disable user pinch-zoom (no user-scalable=no in viewport meta)", priority: "must" },
  { rule: "text-resize", description: "Content remains accessible and readable when text is resized to 200% in browser", priority: "must" },
];

// ─── Medical / clinic additions ───────────────────────────────────────────────

const MEDICAL_ADDITIONS: QACheckItem[] = [
  { rule: "emergency-contact-visible", description: "Emergency contact or after-hours line is visible without interaction — never hidden in a modal", priority: "must" },
  { rule: "plain-language", description: "All medical content uses plain language (≤ 8th grade reading level) — avoid jargon", priority: "must" },
  { rule: "no-medical-forms", description: "Do NOT collect health information, diagnosis details, or patient records through the contact form", priority: "must" },
  { rule: "disclaimer-prominent", description: "General inquiry form includes a visible disclaimer: 'Not for medical advice or emergencies'", priority: "must" },
];

// ─── Form additions (any site with contact-form compliance flag) ───────────────

const FORM_ADDITIONS: QACheckItem[] = [
  { rule: "form-label-visible", description: "All form inputs have a visible <label> — not placeholder-only labels", priority: "must" },
  { rule: "form-label-linked", description: "Labels are linked to inputs via matching for/id or wrapping <label>", priority: "must" },
  { rule: "form-error-message", description: "Validation errors are programmatically associated with the failing field via aria-describedby", priority: "must" },
  { rule: "form-required-marked", description: "Required fields are marked with aria-required='true' and a visible indicator", priority: "must" },
];

// ─── Gallery additions ────────────────────────────────────────────────────────

const GALLERY_ADDITIONS: QACheckItem[] = [
  { rule: "gallery-alt-descriptive", description: "Gallery images have service-specific alt text describing the treatment and result — not file names", priority: "must" },
  { rule: "gallery-filter-accessible", description: "Gallery filter buttons announce their active state via aria-pressed or aria-selected", priority: "must" },
];

// ─── Main run ─────────────────────────────────────────────────────────────────

async function run(state: WorkflowState): Promise<Partial<WebsiteBlueprint>> {
  const business = state.blueprint.business!;
  const pages = state.blueprint.pages ?? [];

  const flags = business.complianceFlags;
  const hasMedical = flags.includes("medical-context");
  const hasForm = flags.includes("contact-form") || pages.some((p) => p.sections.includes("ContactSection"));
  const hasGallery = pages.some((p) => p.sections.includes("GallerySection"));

  const qaChecklist: QACheckItem[] = [
    ...BASE_CHECKLIST,
    ...(hasMedical ? MEDICAL_ADDITIONS : []),
    ...(hasForm ? FORM_ADDITIONS : []),
    ...(hasGallery ? GALLERY_ADDITIONS : []),
  ];

  const accessibility: AccessibilityData = {
    targetStandard: "WCAG 2.1 Level AA — accessibility-oriented review against Stitchfy framework checklist (not a legal ADA compliance assessment)",

    semanticHtmlRequirements: [
      "Use HTML5 semantic elements: <header>, <nav>, <main>, <section>, <article>, <footer>, <aside>",
      "Use <h1>–<h6> for headings only — not for styling purposes",
      "Use <ul>/<ol> for all lists (navigation, services, social links)",
      "Use <button> for actions and <a> for navigation — do not swap their semantic roles",
      "Use <address> for all physical address blocks",
      "Use <time> for hours with machine-readable datetime attribute",
      "Use <figure>/<figcaption> for gallery images with captions",
    ],

    landmarkRequirements: [
      "<header role='banner'> — site header, wraps logo and navigation",
      "<nav aria-label='Main navigation'> — primary site navigation",
      "<nav aria-label='Footer navigation'> — secondary nav in footer",
      "<main id='main-content'> — primary page content (skip link target)",
      "<footer role='contentinfo'> — site footer",
      "Each page section is wrapped in <section aria-labelledby='section-heading-id'>",
    ],

    keyboardNavigationRequirements: [
      "All interactive elements reachable via Tab key in logical DOM order",
      "Skip to main content link reveals on first Tab keypress",
      "Navigation menu items navigable with Tab; dropdowns (if any) with Arrow keys",
      "Modal dialogs (if any) trap focus within the modal while open",
      "Escape key closes any open modal, dropdown, or overlay",
      "No keyboard traps — user can always Tab out of any interactive element",
    ],

    colorContrastRequirements: [
      `Primary color (${state.blueprint.ux?.colorPalette?.primary ?? "brand color"}) on white/light backgrounds: verify ≥ 4.5:1 using WebAIM Contrast Checker`,
      "Text on hero overlay/image backgrounds: ensure overlay provides sufficient contrast",
      "Button text (white on primary color): verify ≥ 4.5:1",
      "Placeholder text in form inputs: ensure ≥ 4.5:1 (not just 3:1 as older WCAG 1.4.3 allowed)",
      "Focus ring color must contrast ≥ 3:1 against adjacent background",
    ],

    formLabelRequirements: [
      "Every form input (<input>, <textarea>, <select>) has an associated <label>",
      "Labels use for='input-id' and input uses id='input-id' (or label wraps the input)",
      "Placeholder text supplements labels — it does NOT replace them",
      "Required fields: add aria-required='true' and a visible * (asterisk) with a legend explaining the marker",
      "Error states: add aria-invalid='true' and aria-describedby='error-id' pointing to the error message element",
    ],

    imageAltTextRequirements: [
      "Write alt text for what the image communicates, not just what it depicts",
      "Informational images: provide descriptive alt text (≤ 125 chars)",
      "Decorative images: use alt='' — do not describe images that add no information",
      "Complex images (charts, infographics): provide long description in <figcaption> or adjacent text",
      "Hero images: if text is overlaid, the alt can be empty (the overlaid text conveys the message)",
    ],

    focusStateRequirements: [
      "Focus outline must never be removed with CSS outline:none without a replacement indicator",
      "Replacement focus indicator must be visible and high-contrast (e.g., colored box-shadow)",
      "Focus indicator minimum size: 3px solid outline, or equivalent CSS box-shadow",
      "All focus states tested with keyboard navigation — Tab through every page",
      "Focus must return to triggering element after closing any modal or dialog",
    ],

    ariaGuidelines: [
      "Do not use ARIA to fix bad HTML — prefer semantic HTML over ARIA roles",
      "aria-label: use on elements without visible text (icon-only buttons, navigation)",
      "aria-labelledby: use to associate headings with sections",
      "aria-describedby: use to associate error messages, hints, or instructions with inputs",
      "aria-expanded: use on toggle buttons (hamburger menu, accordions)",
      "aria-current='page': use on the active navigation item",
      "aria-hidden='true': use on purely decorative icons (SVGs, FontAwesome)",
      "aria-live: use sparingly for dynamic content updates (form success messages)",
    ],

    reducedMotionGuidelines: [
      "@media (prefers-reduced-motion: reduce) must disable or substantially reduce all CSS transitions and animations",
      "Fade-in animations: replace with instant display under prefers-reduced-motion",
      "Scroll-triggered animations: skip entirely under prefers-reduced-motion",
      "Auto-advancing carousels (if any): pause under prefers-reduced-motion",
      "Test reduced-motion behavior in macOS Accessibility → Display → Reduce Motion",
    ],

    qaChecklist,
  };

  console.log(`  ✓  Accessibility — WCAG 2.1 AA, ${qaChecklist.length} checks (${qaChecklist.filter((c) => c.priority === "must").length} must, ${qaChecklist.filter((c) => c.priority === "should").length} should)`);

  return { accessibility };
}

export const accessibilityAgent: AgentConfig = {
  name: "AccessibilityAgent",
  stage: "accessibility",
  run,
};
