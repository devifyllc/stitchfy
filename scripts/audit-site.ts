#!/usr/bin/env tsx
/**
 * audit-site — Generates HTML audit reports from the blueprint and
 * optionally analyzes the generated static HTML for accessibility and SEO issues.
 *
 * Steps:
 *   1. Read the blueprint
 *   2. Locate HTML files in output/static-site/ (if built)
 *   3. Run static HTML checks on each page
 *   4. Generate HTML reports → output/reports/
 *
 * Usage:
 *   npm run audit
 *   npm run audit -- --blueprint path/to/blueprint.json
 */

import * as fs from "fs";
import * as path from "path";
import { generateReports, analyzeHtmlFile, type PageAnalysis, type ReportData } from "../framework/core/report-generator.js";
import type { WebsiteBlueprint } from "../framework/schemas/blueprint.types.js";

const args = process.argv.slice(2);
const getBlueprintPath = () => {
  const i = args.indexOf("--blueprint");
  return i !== -1 && args[i + 1]
    ? path.resolve(args[i + 1])
    : path.resolve("output/blueprint/website-blueprint.v1.json");
};

function step(n: number, total: number, label: string) {
  console.log(`\n  [${n}/${total}] ${label}...`);
}
function ok(msg: string) { console.log(`  ✓  ${msg}`); }
function warn(msg: string) { console.log(`  ⚠  ${msg}`); }

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Stitchfy v2 — Audit");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const blueprintPath = getBlueprintPath();
  const staticDir = path.resolve("output/static-site");
  const outputDir = path.resolve("output");
  const TOTAL = 4;

  // ── Step 1: Read blueprint ────────────────────────────────────────────────
  step(1, TOTAL, "Reading blueprint");
  if (!fs.existsSync(blueprintPath)) {
    console.error(`  ✗  Blueprint not found: ${blueprintPath}`);
    console.log("  Run \"npm run stitchfy\" first.\n");
    process.exit(1);
  }

  let blueprint: WebsiteBlueprint;
  try {
    blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8")) as WebsiteBlueprint;
  } catch (e) {
    console.error(`  ✗  Failed to parse blueprint: ${(e as Error).message}`);
    process.exit(1);
  }
  ok(`Blueprint loaded — ${blueprint.business.name}, ${blueprint.pages.length} pages`);

  // ── Step 2: Check for static site ────────────────────────────────────────
  step(2, TOTAL, "Locating static HTML files");
  const staticSiteExists = fs.existsSync(staticDir) && countFiles(staticDir) > 0;

  if (!staticSiteExists) {
    warn("output/static-site/ is empty or missing — HTML checks will be skipped");
    warn("Run \"npm run build:site\" to build the site before auditing");
  } else {
    ok(`Found static site at output/static-site/`);
  }

  // ── Step 3: Analyze HTML files ─────────────────────────────────────────────
  step(3, TOTAL, "Analyzing pages");
  const pageAnalyses: PageAnalysis[] = [];

  for (const route of blueprint.frontend.routes) {
    const page = blueprint.pages.find((p) => p.id === route.pageId);
    const meta = blueprint.seo.pageMeta.find((m) => m.pageId === route.pageId);
    const title = page?.title ?? route.pageId;

    // Locate the HTML file for this route
    const htmlFile = locateHtmlFile(staticDir, route.path);
    let checks = [];

    if (staticSiteExists && htmlFile && fs.existsSync(htmlFile)) {
      const html = fs.readFileSync(htmlFile, "utf-8");
      checks = analyzeHtmlFile(html);
      const passCount = checks.filter((c) => c.status === "pass").length;
      ok(`${title} — ${passCount}/${checks.length} checks passed`);
    } else {
      if (staticSiteExists) {
        warn(`HTML not found for ${route.path} — skipping analysis`);
      }
    }

    pageAnalyses.push({
      pageId: route.pageId,
      title,
      path: route.path,
      file: route.file,
      checks,
    });
  }

  // ── Step 4: Generate reports ──────────────────────────────────────────────
  step(4, TOTAL, "Generating HTML reports");
  const reportData: ReportData = {
    blueprint,
    blueprintPath,
    generatedAt: new Date().toISOString(),
    pageAnalyses,
    staticSiteExists,
  };

  try {
    generateReports(reportData, outputDir);
    ok("accessibility-report.html");
    ok("seo-report.html");
    ok("final-report.html");
  } catch (e) {
    console.error(`  ✗  Report generation failed: ${(e as Error).message}`);
    process.exit(1);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const allChecks = pageAnalyses.flatMap((p) => p.checks);
  const passCount = allChecks.filter((c) => c.status === "pass").length;
  const warnCount = allChecks.filter((c) => c.status === "warn").length;
  const failCount = allChecks.filter((c) => c.status === "fail").length;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (staticSiteExists && allChecks.length > 0) {
    console.log(`  HTML checks: ${passCount} passed, ${warnCount} warnings, ${failCount} failures`);
  }
  console.log("  Reports written to output/reports/");
  console.log("    → accessibility-report.html");
  console.log("    → seo-report.html");
  console.log("    → final-report.html");
  if (failCount > 0) {
    console.log(`\n  ⚠  ${failCount} check(s) failed — review accessibility-report.html`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

function locateHtmlFile(staticDir: string, routePath: string): string {
  if (routePath === "/") return path.join(staticDir, "index.html");
  const slug = routePath.replace(/^\//, "").replace(/\/$/, "");
  return path.join(staticDir, slug, "index.html");
}

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
    else count++;
  }
  return count;
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
