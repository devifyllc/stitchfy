/**
 * Shared types for the Stitch HTML review agents.
 *
 * These agents run AFTER Google Stitch generates the HTML and AFTER the
 * post-processor injects SEO/a11y attributes. Their job is to catch what
 * Stitch introduced that neither tool covers, then either auto-patch it
 * (attribute-level only) or flag it for manual review before deploying.
 */

// ─── Patch ────────────────────────────────────────────────────────────────────

/**
 * A single string find-and-replace operation on the HTML.
 * The patcher applies patches sequentially and records which ones matched.
 *
 * Patches MUST be attribute-level only — no structural changes, no content
 * edits, no element moves. The boundary: if removing the patch leaves the
 * visual layout unchanged, it's safe.
 */
export interface HtmlPatch {
  description: string;
  find: string | RegExp;
  replace: string;
  replaceAll?: boolean;
}

// ─── Finding ──────────────────────────────────────────────────────────────────

export type FindingSeverity = "error" | "warning" | "info";
export type FindingCategory = "seo" | "accessibility";

export interface ReviewFinding {
  severity: FindingSeverity;
  category: FindingCategory;
  rule: string;
  description: string;
  recommendation: string;
}

// ─── Agent result ─────────────────────────────────────────────────────────────

export interface HtmlReviewResult {
  patches: HtmlPatch[];
  findings: ReviewFinding[];
}

// ─── Per-page summary (used by reporter) ─────────────────────────────────────

export interface PageReviewSummary {
  pageId: string;
  route: string;
  patchesApplied: string[];
  patchesSkipped: string[];
  findings: ReviewFinding[];
}
