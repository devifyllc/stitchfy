/**
 * render-seo-report — Formats the SEO section of a QAReport
 * as a human-readable Markdown document.
 *
 * TODO: Integrate with a real SEO auditor that crawls the static output
 * and checks meta tags, Open Graph, JSON-LD, and sitemap.
 */

import type { QAReport } from "./report-types.js";

export function renderSEOReport(report: QAReport): string {
  const { seo } = report;
  const lines: string[] = [];

  lines.push("# SEO Report");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");

  const status = seo.passed ? "✓ PASSED" : "✗ FAILED";
  lines.push(`## Status: ${status}`);

  if (typeof seo.score === "number") {
    lines.push(`**Score:** ${seo.score}/100`);
  }
  lines.push("");

  if (seo.errors.length > 0) {
    lines.push("## Errors");
    for (const err of seo.errors) {
      lines.push(`- **[${err.rule}]** ${err.message}`);
    }
    lines.push("");
  }

  if (seo.warnings.length > 0) {
    lines.push("## Warnings");
    for (const warn of seo.warnings) {
      lines.push(`- **[${warn.rule}]** ${warn.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
