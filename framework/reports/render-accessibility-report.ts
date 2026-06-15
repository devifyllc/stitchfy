/**
 * render-accessibility-report — Formats the accessibility section of
 * a QAReport as a human-readable Markdown document.
 *
 * TODO: Integrate with a real accessibility checker (e.g., axe-core)
 * that runs against the generated static HTML in output/static-site/.
 */

import type { QAReport } from "./report-types.js";

export function renderAccessibilityReport(report: QAReport): string {
  const { accessibility } = report;
  const lines: string[] = [];

  lines.push("# Accessibility Report");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`WCAG Level Target: AA`);
  lines.push("");

  const status = accessibility.passed ? "✓ PASSED" : "✗ FAILED";
  lines.push(`## Status: ${status}`);

  if (typeof accessibility.score === "number") {
    lines.push(`**Score:** ${accessibility.score}/100`);
  }
  lines.push("");

  if (accessibility.errors.length > 0) {
    lines.push("## Errors");
    for (const err of accessibility.errors) {
      lines.push(`- **[${err.rule}]** ${err.message}${err.element ? ` (\`${err.element}\`)` : ""}`);
    }
    lines.push("");
  }

  if (accessibility.warnings.length > 0) {
    lines.push("## Warnings");
    for (const warn of accessibility.warnings) {
      lines.push(`- **[${warn.rule}]** ${warn.message}${warn.element ? ` (\`${warn.element}\`)` : ""}`);
    }
    lines.push("");
  }

  if (accessibility.checks.length > 0) {
    lines.push("## Checks");
    for (const check of accessibility.checks) {
      const icon = check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "⚠";
      lines.push(`- ${icon} \`${check.rule}\`${check.detail ? `: ${check.detail}` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
