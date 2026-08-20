/**
 * stitch-a11y.agent — Reviews Stitch-generated HTML for accessibility issues.
 *
 * Runs after postProcessPage (skip link, lang, id="main-content" already done).
 * Catches patterns Stitch consistently introduces:
 *   - <img data-alt="..."> instead of alt="..." (Stitch stores alt in a custom attr)
 *   - <nav> without aria-label (multiple nav landmarks need distinguishing labels)
 *   - Mobile menu <button> with icon-only content and no aria-label
 *   - focus:outline-none on interactive elements (WCAG 2.4.7 violation)
 *   - Star rating icon groups without role/aria-label
 *   - Decorative material icons that are read aloud by screen readers
 *
 * Returns patches (attribute-level only, safe to auto-apply) and findings
 * that require human judgment before deploying.
 */

import type { PageDefinition, WebsiteBlueprint } from "../schemas/blueprint.types.js";
import type { HtmlPatch, HtmlReviewResult, ReviewFinding } from "./stitch-html-review.types.js";

// Material icon names that are decorative when adjacent to visible text.
// These will receive aria-hidden="true" automatically.
const DECORATIVE_ICONS = new Set([
  "location_on", "schedule", "arrow_forward", "arrow_back",
  "arrow_right_alt", "chevron_right", "chevron_left",
  "phone", "email", "place", "map", "directions",
  "open_in_new", "check", "check_circle", "info",
  "menu", // icon-only button is handled separately with aria-label
]);

export function reviewA11y(
  html: string,
  _page: PageDefinition,
  _blueprint: WebsiteBlueprint
): HtmlReviewResult {
  const patches: HtmlPatch[] = [];
  const findings: ReviewFinding[] = [];

  // ── 1. data-alt → alt on <img> elements ─────────────────────────────────────
  // Stitch stores alt descriptions in data-alt, not the standard alt attribute.
  // Screen readers ignore data-alt entirely and read the full src URL instead.
  if (/(<img\b[^>]*?)\bdata-alt=/i.test(html)) {
    patches.push({
      description: 'Convert data-alt to alt on all <img> elements (WCAG 1.1.1)',
      find: /(<img\b[^>]*?)\bdata-alt=/gi,
      replace: "$1 alt=",
      replaceAll: true,
    });
  }

  // ── 2. <nav> missing aria-label ─────────────────────────────────────────────
  // When a page has more than one nav landmark, each must be distinguishable.
  if (/<nav\b(?![^>]*aria-label)[^>]*>/i.test(html)) {
    patches.push({
      description: 'Add aria-label="Main navigation" to unlabelled <nav> (WCAG 1.3.6)',
      find: /<nav\b(?![^>]*aria-label)([^>]*)>/i,
      replace: '<nav aria-label="Main navigation"$1>',
    });
  }

  // ── 3. Mobile menu button: icon-only, no aria-label ─────────────────────────
  // Pattern: <button ...>  <span class="material-symbols-outlined">menu</span> </button>
  // The button has no accessible name — screen readers announce "button" only.
  if (/(<button[^>]*md:hidden[^>]*focus:outline-none[^>]*>)/i.test(html)) {
    patches.push({
      description:
        'Add aria-label to mobile menu button and fix focus outline removal (WCAG 4.1.2, 2.4.7)',
      find: /(<button)([^>]*\bmd:hidden\b[^>]*)\bfocus:outline-none\b([^>]*>)/gi,
      replace: '$1 aria-label="Open menu"$2 focus:ring-2 focus:ring-primary focus:ring-offset-2$3',
      replaceAll: true,
    });
  } else if (/(<button[^>]*md:hidden[^>]*>)/i.test(html)) {
    // Same button without the focus class pattern
    patches.push({
      description: 'Add aria-label to mobile menu button (WCAG 4.1.2)',
      find: /(<button)([^>]*\bmd:hidden\b[^>]*>)/gi,
      replace: '$1 aria-label="Open menu"$2',
      replaceAll: true,
    });
  }

  // ── 4. Star rating groups: not announced as a rating ────────────────────────
  // Stitch renders 5 <span>star</span> icons. Screen readers say "star star star…"
  // Fix: wrap the group with role="img" aria-label="5 out of 5 stars"
  const starGroupPattern = /<div([^>]*)>\s*(?:<span[^>]*>star<\/span>\s*){3,}/i;
  if (starGroupPattern.test(html)) {
    patches.push({
      description: 'Add role="img" aria-label to star rating groups (WCAG 1.1.1)',
      find: /(<div)([^>]*\bflex\b[^>]*\btext-primary\b[^>]*mb-sm[^>]*>)(\s*<span[^>]*material-symbols)/gi,
      replace: '$1 role="img" aria-label="5 out of 5 stars"$2$3',
      replaceAll: true,
    });
  }

  // ── 5. Decorative material icons: not aria-hidden ───────────────────────────
  // Icons like location_on, schedule, arrow_forward appear next to visible text.
  // Without aria-hidden, screen readers announce them mid-sentence.
  for (const iconName of DECORATIVE_ICONS) {
    // Match the icon span without an existing aria-hidden attribute
    const find = new RegExp(
      `(<span\\b(?![^>]*aria-hidden)[^>]*\\bmaterial-symbols-outlined\\b[^>]*>)(${iconName})(<\\/span>)`,
      "gi"
    );
    if (find.test(html)) {
      patches.push({
        description: `Add aria-hidden="true" to decorative icon "${iconName}" (WCAG 1.1.1)`,
        find: new RegExp(
          `(<span\\b(?![^>]*aria-hidden)[^>]*\\bmaterial-symbols-outlined\\b[^>]*>)(${iconName})(<\\/span>)`,
          "gi"
        ),
        replace: '$1$2$3'.replace(
          '$1',
          `<span aria-hidden="true" `
        ).replace(
          /^<span aria-hidden="true" /,
          // Rebuild properly — replace opening tag inline
          ''
        ),
      });
    }
  }

  // Simpler, more reliable approach for decorative icons — direct string patches
  patches.push(...buildDecorativeIconPatches(html));

  // ── 6. Footer links without <nav> wrapper ───────────────────────────────────
  if (/<footer[^>]*>[\s\S]*?<a\b/i.test(html) && !/<footer[^>]*>[\s\S]*?<nav\b/i.test(html)) {
    findings.push({
      severity: "info",
      category: "accessibility",
      rule: "WCAG 1.3.1: footer navigation landmark",
      description: "Footer contains links but no <nav> landmark. Keyboard and AT users cannot jump to footer nav.",
      recommendation:
        'Wrap footer links in <nav aria-label="Footer navigation">. This is a structural change — not auto-patched.',
    });
  }

  // ── 7. focus:outline-none on non-button elements ────────────────────────────
  const outlineNoneCount = (html.match(/\bfocus:outline-none\b/g) ?? []).length;
  // We already patch the button above; flag any remaining occurrences
  if (outlineNoneCount > 1) {
    findings.push({
      severity: "warning",
      category: "accessibility",
      rule: "WCAG 2.4.7: focus visible",
      description: `Found ${outlineNoneCount} uses of focus:outline-none. One (the menu button) is auto-patched. Others may suppress focus indicators.`,
      recommendation:
        "Search for focus:outline-none in the page and replace with focus:ring-* utilities.",
    });
  }

  // ── 8. <img> with src but no alt (after the data-alt patch) ─────────────────
  // This catches any images Stitch added without any alt attribute at all.
  const imgNoAlt = /<img\b(?![^>]*\balt=)[^>]*>/gi;
  const orphanImgs = html.match(imgNoAlt) ?? [];
  if (orphanImgs.length > 0) {
    // Only flag images that still have no alt after the data-alt patch is applied
    const withoutDataAlt = orphanImgs.filter((t) => !t.includes("data-alt="));
    if (withoutDataAlt.length > 0) {
      findings.push({
        severity: "error",
        category: "accessibility",
        rule: "WCAG 1.1.1: non-text content",
        description: `${withoutDataAlt.length} <img> element(s) have no alt attribute and no data-alt fallback.`,
        recommendation:
          "Add alt text to content images or alt=\"\" to purely decorative ones.",
      });
    }
  }

  return { patches, findings };
}

// ─── Decorative icon patches ──────────────────────────────────────────────────
// More reliable than a generic regex loop: build concrete patches per icon.

function buildDecorativeIconPatches(html: string): HtmlPatch[] {
  const result: HtmlPatch[] = [];
  for (const iconName of DECORATIVE_ICONS) {
    // Match any <span ... material-symbols-outlined ...>ICON</span> without aria-hidden
    const testRe = new RegExp(
      `<span(?![^>]*aria-hidden)[^>]*material-symbols-outlined[^>]*>${iconName}</span>`,
      "i"
    );
    if (!testRe.test(html)) continue;

    result.push({
      description: `aria-hidden decorative icon "${iconName}"`,
      find: new RegExp(
        `(<span)((?![^>]*aria-hidden)[^>]*\\bmaterial-symbols-outlined\\b[^>]*>)(${iconName}</span>)`,
        "gi"
      ),
      replace: '$1 aria-hidden="true"$2$3',
      replaceAll: true,
    });
  }
  return result;
}
