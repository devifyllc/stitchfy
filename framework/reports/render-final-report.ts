/**
 * render-final-report — Combines all audit sections into a single
 * Markdown report written to output/reports/final-report.md.
 */

import * as fs from "fs";
import * as path from "path";
import { renderAccessibilityReport } from "./render-accessibility-report.js";
import { renderSEOReport } from "./render-seo-report.js";
import type { QAReport } from "./report-types.js";

export function renderFinalReport(report: QAReport, outputDir: string): string {
  const sections: string[] = [];

  sections.push("# Stitchfy QA Report");
  sections.push(`Generated: ${report.generatedAt}`);
  sections.push(`Blueprint: ${report.inputBlueprint}`);
  sections.push("");

  const { summary } = report;
  sections.push("## Summary");
  sections.push(`| | |`);
  sections.push(`|---|---|`);
  sections.push(`| Overall | ${summary.overallPassed ? "✓ Passed" : "✗ Failed"} |`);
  sections.push(`| Errors | ${summary.totalErrors} |`);
  sections.push(`| Warnings | ${summary.totalWarnings} |`);
  if (summary.recommendation) {
    sections.push(`| Recommendation | ${summary.recommendation} |`);
  }
  sections.push("");
  sections.push("---");
  sections.push("");

  sections.push(renderAccessibilityReport(report));
  sections.push("---");
  sections.push("");
  sections.push(renderSEOReport(report));

  const markdown = sections.join("\n");

  const outPath = path.join(outputDir, "reports", "final-report.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, markdown);
  console.log(`Report written to: ${outPath}`);

  return markdown;
}
