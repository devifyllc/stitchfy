/**
 * stitch-prompt-builder — Converts blueprint data into a per-page text prompt
 * for the Stitch generate_screen_from_text MCP tool.
 *
 * Every prompt starts with an explicit design-system block (exact hex colors,
 * fonts, nav links) so that Stitch stays consistent across all generated pages.
 */

import type { PageDefinition, WebsiteBlueprint } from "../schemas/blueprint.types.js";

export function buildPagePrompt(page: PageDefinition, blueprint: WebsiteBlueprint): string {
  const { business, ux, seo } = blueprint;

  const pageMeta = seo.pageMeta.find((m) => m.pageId === page.id);

  const navList = ux.navigation
    .map((n) => `  • ${n.label} → ${n.href}${n.external ? " (external)" : ""}`)
    .join("\n");

  const hoursList = Object.entries(business.operatingHours)
    .map(([day, hrs]) => `  ${day}: ${hrs}`)
    .join("\n");

  const socialList = Object.entries(business.socialLinks)
    .map(([platform, handle]) => `  ${platform}: ${handle}`)
    .join("\n");

  const lines: string[] = [
    `Design the "${page.title}" page for ${business.name}, a ${business.industry} business located in ${business.location || business.address}.`,
    "",
    // ── Design system block ─────────────────────────────────────────────────
    "=== DESIGN SYSTEM — use these exact values, no substitutions ===",
    "Colors:",
    `  Primary:    ${ux.colorPalette.primary}`,
    `  Secondary:  ${ux.colorPalette.secondary}`,
    `  Accent:     ${ux.colorPalette.accent}`,
    `  Text:       ${ux.colorPalette.text}`,
    `  Background: ${ux.colorPalette.background}`,
    `  Border:     ${ux.colorPalette.border}`,
    "Typography:",
    `  Heading font:   ${ux.typography.headingFont} (weight: ${ux.typography.headingWeight})`,
    `  Body font:      ${ux.typography.bodyFont}`,
    `  Base font size: ${ux.typography.scaleBase}`,
    "",
    // ── Shared layout ───────────────────────────────────────────────────────
    "=== SHARED LAYOUT (identical across all pages) ===",
    "Sticky header containing:",
    `  • Logo / business name: ${business.name}`,
    `  • Navigation links:\n${navList}`,
    `  • Phone number: ${business.phone}`,
    `  • CTA button: "${ux.header.ctaLabel}" → ${ux.header.ctaHref}`,
    "Footer containing:",
    `  • Columns: ${ux.footer.columns.join(", ")}`,
    `  • Address: ${business.address}`,
    `  • Hours summary`,
    `  • Social links${socialList ? `:\n${socialList}` : ": none"}`,
    `  • Legal note: ${ux.footer.legalNote || `© ${new Date().getFullYear()} ${business.name}`}`,
    "",
    // ── Business information ────────────────────────────────────────────────
    "=== BUSINESS INFORMATION ===",
    `Name:        ${business.name}`,
    `Industry:    ${business.industry}`,
    `Description: ${business.description}`,
    `Phone:       ${business.phone}`,
    `Email:       ${business.email}`,
    `Address:     ${business.address}`,
    `Booking:     ${business.booking}`,
    `Services:    ${business.services.join(", ")}`,
    "Hours:",
    hoursList,
    "",
    // ── This specific page ──────────────────────────────────────────────────
    "=== THIS PAGE ===",
    `Title:   ${page.title}`,
    `Route:   ${page.path}`,
    `Purpose: ${page.purpose}`,
    `Sections to render (in this exact order): ${page.sections.join(", ")}`,
  ];

  if (page.primaryCTA) {
    lines.push(`Primary CTA:   "${page.primaryCTA.label}" → ${page.primaryCTA.href}`);
  }
  if (page.secondaryCTA) {
    lines.push(`Secondary CTA: "${page.secondaryCTA.label}" → ${page.secondaryCTA.href}`);
  }
  if (page.requiredContent.length > 0) {
    lines.push(`Required content on this page: ${page.requiredContent.join(", ")}`);
  }
  if (pageMeta?.description) {
    lines.push(`Meta description (place in <meta name="description">): "${pageMeta.description}"`);
  }

  // Hero style — only relevant for home page but harmless if included elsewhere
  if (page.id === "home") {
    lines.push("", "=== HERO VISUAL SPEC ===");
    const h = ux.heroStyle;
    if (h.backgroundType === "gradient") {
      lines.push(
        `Background: CSS linear-gradient from ${h.gradientFrom} to ${h.gradientTo}`,
        `Text color: ${h.textColor} (must pass WCAG AA contrast against the gradient)`
      );
    } else if (h.backgroundType === "solid") {
      lines.push(
        `Background: solid ${h.backgroundColor}`,
        `Text color: ${h.textColor}`
      );
    } else {
      lines.push(
        `Background: full-width image with overlay opacity ${h.overlayOpacity ?? 0.5}`,
        `Text color: ${h.textColor}`
      );
    }
  }

  lines.push(
    "",
    // ── Hard requirements ───────────────────────────────────────────────────
    "=== REQUIREMENTS ===",
    "- Desktop-first, fully responsive",
    "- Semantic HTML5: proper heading hierarchy, one <h1> per page",
    "- WCAG 2.1 AA: use the exact hex colors above — do not substitute",
    "- All navigation links must use the exact routes listed above",
    "- No placeholder lorem ipsum — use the actual business information provided",
    "- Include <html lang=\"en\"> on the root element",
    "- Do not include <title> or <meta> tags — those will be injected separately",
  );

  return lines.join("\n");
}
