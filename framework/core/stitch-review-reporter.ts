/**
 * stitch-review-reporter — Generates output/reports/stitch-review-report.html
 *
 * Produces one self-contained HTML report per pipeline run showing:
 *   - Per-page: patches auto-applied, findings requiring manual action
 *   - Severity badges (error / warning / info)
 *   - Overall summary counts
 */

import * as fs from "fs";
import * as path from "path";
import type { PageReviewSummary, FindingSeverity } from "../agents/stitch-html-review.types.js";

export function generateReviewReport(
  pages: PageReviewSummary[],
  outputDir: string
): string {
  const reportsDir = path.join(outputDir, "..", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const reportPath = path.join(reportsDir, "stitch-review-report.html");
  fs.writeFileSync(reportPath, buildHtml(pages), "utf-8");
  return reportPath;
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(pages: PageReviewSummary[]): string {
  const totalPatches = pages.reduce((n, p) => n + p.patchesApplied.length, 0);
  const totalErrors   = pages.reduce((n, p) => n + p.findings.filter(f => f.severity === "error").length, 0);
  const totalWarnings = pages.reduce((n, p) => n + p.findings.filter(f => f.severity === "warning").length, 0);
  const totalInfo     = pages.reduce((n, p) => n + p.findings.filter(f => f.severity === "info").length, 0);
  const generatedAt   = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stitch Review Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8f9fa; color: #1a1a2e; line-height: 1.6; }
  .header { background: linear-gradient(135deg, #b30069 0%, #7a004a 100%); color: #fff; padding: 2rem 2.5rem; }
  .header h1 { font-size: 1.6rem; font-weight: 700; }
  .header p  { font-size: 0.875rem; opacity: .8; margin-top: .25rem; }
  .summary { display: flex; gap: 1rem; padding: 1.5rem 2.5rem; background: #fff; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
  .stat { background: #f3f4f6; border-radius: 8px; padding: .75rem 1.25rem; min-width: 130px; text-align: center; }
  .stat .num { font-size: 1.75rem; font-weight: 700; }
  .stat .lbl { font-size: .75rem; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
  .stat.green .num { color: #059669; }
  .stat.red   .num { color: #dc2626; }
  .stat.amber .num { color: #d97706; }
  .stat.blue  .num { color: #2563eb; }
  .content { max-width: 960px; margin: 2rem auto; padding: 0 1.5rem 3rem; }
  .page-card { background: #fff; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 1.5rem; overflow: hidden; }
  .page-header { background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: .9rem 1.25rem; display: flex; align-items: center; justify-content: space-between; }
  .page-title { font-weight: 700; font-size: 1rem; }
  .page-route { font-size: .8rem; color: #6b7280; background: #e5e7eb; border-radius: 4px; padding: .15rem .5rem; font-family: monospace; }
  .page-body { padding: 1.25rem; }
  .section-label { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin-bottom: .6rem; margin-top: 1rem; }
  .section-label:first-child { margin-top: 0; }
  .patch-list, .finding-list { list-style: none; display: flex; flex-direction: column; gap: .4rem; }
  .patch-item { display: flex; align-items: flex-start; gap: .5rem; font-size: .875rem; }
  .patch-item::before { content: "✓"; color: #059669; font-weight: 700; flex-shrink: 0; margin-top: .05rem; }
  .patch-skipped::before { content: "–"; color: #9ca3af; }
  .finding-item { border-radius: 6px; padding: .6rem .9rem; font-size: .875rem; border-left: 4px solid; }
  .finding-error   { background: #fef2f2; border-color: #dc2626; }
  .finding-warning { background: #fffbeb; border-color: #d97706; }
  .finding-info    { background: #eff6ff; border-color: #2563eb; }
  .badge { display: inline-block; border-radius: 4px; padding: .15rem .45rem; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin-right: .4rem; }
  .badge-error   { background: #fee2e2; color: #b91c1c; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-info    { background: #dbeafe; color: #1e40af; }
  .badge-seo  { background: #f3e8ff; color: #7c3aed; }
  .badge-a11y { background: #ecfdf5; color: #065f46; }
  .rec { margin-top: .3rem; font-size: .8rem; color: #4b5563; }
  .empty { color: #9ca3af; font-size: .875rem; font-style: italic; }
  .disclaimer { margin-top: 2rem; padding: 1rem 1.25rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font-size: .8rem; color: #6b7280; }
</style>
</head>
<body>
<div class="header">
  <h1>Stitchfy · Stitch Review Report</h1>
  <p>Generated ${generatedAt} · ${pages.length} page(s) reviewed</p>
</div>
<div class="summary">
  <div class="stat green"><div class="num">${totalPatches}</div><div class="lbl">Auto-patched</div></div>
  <div class="stat red">  <div class="num">${totalErrors}</div>  <div class="lbl">Errors</div></div>
  <div class="stat amber"><div class="num">${totalWarnings}</div><div class="lbl">Warnings</div></div>
  <div class="stat blue"> <div class="num">${totalInfo}</div>   <div class="lbl">Info</div></div>
</div>
<div class="content">
${pages.map(renderPageCard).join("\n")}
<div class="disclaimer">
  <strong>Note:</strong> Auto-patches are attribute-level only (aria-label, alt, aria-hidden, JSON-LD rewrite).
  No structural changes were made. Findings marked <em>error</em> or <em>warning</em> require human review
  before deploying to production. This report does not constitute a full WCAG or legal compliance audit.
</div>
</div>
</body>
</html>`;
}

function renderPageCard(page: PageReviewSummary): string {
  const errors   = page.findings.filter(f => f.severity === "error");
  const warnings = page.findings.filter(f => f.severity === "warning");
  const infos    = page.findings.filter(f => f.severity === "info");

  const patchesHtml = page.patchesApplied.length > 0
    ? `<ul class="patch-list">${page.patchesApplied.map(d => `<li class="patch-item">${esc(d)}</li>`).join("")}</ul>`
    : `<p class="empty">No patches needed — Stitch output was clean for this page.</p>`;

  const findingsHtml = page.findings.length > 0
    ? [...errors, ...warnings, ...infos].map(renderFinding).join("")
    : `<p class="empty">No manual findings — this page is ready to deploy.</p>`;

  return `<div class="page-card">
  <div class="page-header">
    <span class="page-title">${esc(page.pageId)}</span>
    <span class="page-route">${esc(page.route)}</span>
  </div>
  <div class="page-body">
    <div class="section-label">Auto-patched (${page.patchesApplied.length})</div>
    ${patchesHtml}
    <div class="section-label">Manual review required (${page.findings.length})</div>
    ${findingsHtml}
  </div>
</div>`;
}

function renderFinding(f: { severity: FindingSeverity; category: string; rule: string; description: string; recommendation: string }): string {
  return `<div class="finding-item finding-${f.severity}">
  <span class="badge badge-${f.severity}">${f.severity}</span>
  <span class="badge badge-${f.category}">${f.category}</span>
  <strong>${esc(f.rule)}</strong><br>
  ${esc(f.description)}
  <div class="rec">→ ${esc(f.recommendation)}</div>
</div>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
