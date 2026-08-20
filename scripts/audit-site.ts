#!/usr/bin/env tsx
/**
 * audit-site — Generates HTML audit reports from the blueprint and
 * analyzes the generated static HTML for accessibility and SEO issues.
 *
 * Supports both output strategies:
 *   --dir static   Audit output/static-site/ (default, v2.0.0 behavior)
 *   --dir stitch   Audit output/stitch-site/ → prefixed stitch-*.html reports
 *   --dir both     Run both audits in sequence
 *
 * Usage:
 *   npm run audit                          ← static-site (default)
 *   npm run audit -- --dir stitch          ← stitch-site
 *   npm run audit -- --dir both            ← both
 *   npm run audit -- --blueprint path.json ← custom blueprint
 */

import * as fs from "fs";
import * as path from "path";
import {
  generateReports,
  analyzeHtmlFile,
  type PageAnalysis,
  type ReportData,
} from "../framework/core/report-generator.js";
import type { WebsiteBlueprint } from "../framework/schemas/blueprint.types.js";

// ─── Arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}

const dirArg  = (getArg("--dir") ?? "static") as "static" | "stitch" | "both";
const blueprintPath = path.resolve(
  getArg("--blueprint") ?? "output/blueprint/website-blueprint.v1.json"
);

const DIVIDER = "━".repeat(52);

function step(n: number, total: number, label: string) {
  console.log(`\n  [${n}/${total}] ${label}...`);
}
function ok(msg: string)   { console.log(`  ✓  ${msg}`); }
function warn(msg: string) { console.log(`  ⚠  ${msg}`); }
function fail(msg: string) { console.error(`  ✗  ${msg}`); }

// ─── Core audit runner (reusable by build-site-stitch.ts) ────────────────────

export interface AuditResult {
  siteDir: string;
  reportsWritten: string[];
  passCount: number;
  warnCount: number;
  failCount: number;
}

export async function runAudit(
  blueprint: WebsiteBlueprint,
  siteDir: string,
  outputDir: string,
  reportPrefix: string,
  onProgress?: (msg: string) => void
): Promise<AuditResult> {
  const log = onProgress ?? (() => {});
  const siteExists = fs.existsSync(siteDir) && countFiles(siteDir) > 0;
  const reportsWritten: string[] = [];

  if (!siteExists) {
    log(`⚠  ${siteDir} is empty or missing — HTML checks will be skipped`);
  }

  // Analyse each page from the blueprint
  const pageAnalyses: PageAnalysis[] = [];

  for (const route of blueprint.frontend.routes) {
    const page = blueprint.pages.find((p) => p.id === route.pageId);
    const title = page?.title ?? route.pageId;
    const htmlFile = locateHtmlFile(siteDir, route.path);
    let checks: ReturnType<typeof analyzeHtmlFile> = [];

    if (siteExists && fs.existsSync(htmlFile)) {
      const html = fs.readFileSync(htmlFile, "utf-8");
      checks = analyzeHtmlFile(html);
      const passed = checks.filter((c) => c.status === "pass").length;
      log(`  ${title} — ${passed}/${checks.length} checks passed`);
    } else if (siteExists) {
      log(`  ⚠  HTML not found for ${route.path}`);
    }

    pageAnalyses.push({ pageId: route.pageId, title, path: route.path, file: route.file, checks });
  }

  // Generate reports
  const reportData: ReportData = {
    blueprint,
    blueprintPath,
    generatedAt: new Date().toISOString(),
    pageAnalyses,
    staticSiteExists: siteExists,
  };

  generateReports(reportData, outputDir, reportPrefix);

  reportsWritten.push(
    `${reportPrefix}accessibility-report.html`,
    `${reportPrefix}seo-report.html`,
    `${reportPrefix}final-report.html`,
  );

  const allChecks = pageAnalyses.flatMap((p) => p.checks);
  return {
    siteDir,
    reportsWritten,
    passCount: allChecks.filter((c) => c.status === "pass").length,
    warnCount: allChecks.filter((c) => c.status === "warn").length,
    failCount: allChecks.filter((c) => c.status === "fail").length,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${DIVIDER}`);
  console.log("  Stitchfy v2 — Audit");
  console.log(DIVIDER);

  const outputDir = path.resolve("output");
  const TOTAL = 3;

  // ── Step 1: Read blueprint ──────────────────────────────────────────────────
  step(1, TOTAL, "Reading blueprint");

  if (!fs.existsSync(blueprintPath)) {
    fail(`Blueprint not found: ${blueprintPath}`);
    console.log('  Run "npm run stitchfy" first.\n');
    process.exit(1);
  }

  let blueprint: WebsiteBlueprint;
  try {
    blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8")) as WebsiteBlueprint;
  } catch (e) {
    fail(`Failed to parse blueprint: ${(e as Error).message}`);
    process.exit(1);
  }
  ok(`Blueprint loaded — ${blueprint.business.name}, ${blueprint.pages.length} pages`);

  // ── Step 2: Resolve target(s) ───────────────────────────────────────────────
  const targets: Array<{ siteDir: string; prefix: string; label: string }> = [];

  if (dirArg === "static" || dirArg === "both") {
    targets.push({
      siteDir: path.resolve("output/static-site"),
      prefix: "",
      label: "static-site",
    });
  }
  if (dirArg === "stitch" || dirArg === "both") {
    targets.push({
      siteDir: path.resolve("output/stitch-site"),
      prefix: "stitch-",
      label: "stitch-site",
    });
  }

  if (targets.length === 0) {
    fail(`Unknown --dir value "${dirArg}". Use: static | stitch | both`);
    process.exit(1);
  }

  // ── Step 3: Audit each target ───────────────────────────────────────────────
  let totalFails = 0;
  const allReports: string[] = [];

  for (const target of targets) {
    step(2, TOTAL, `Auditing ${target.label}`);

    const result = await runAudit(
      blueprint,
      target.siteDir,
      outputDir,
      target.prefix,
      (msg) => console.log(`  ${msg}`)
    );

    for (const r of result.reportsWritten) {
      ok(r);
      allReports.push(r);
    }

    if (result.passCount + result.warnCount + result.failCount > 0) {
      ok(
        `HTML checks: ${result.passCount} passed, ${result.warnCount} warnings, ${result.failCount} failures`
      );
    }
    totalFails += result.failCount;
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  step(3, TOTAL, "Done");
  console.log(`\n${DIVIDER}`);
  console.log("  Reports written to output/reports/");
  for (const r of allReports) console.log(`    → ${r}`);
  if (totalFails > 0) {
    console.log(`\n  ⚠  ${totalFails} check(s) failed — review the accessibility report(s)`);
  }
  console.log(`${DIVIDER}\n`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function locateHtmlFile(siteDir: string, routePath: string): string {
  if (routePath === "/") return path.join(siteDir, "index.html");
  const slug = routePath.replace(/^\//, "").replace(/\/$/, "");
  return path.join(siteDir, slug, "index.html");
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

// Only run main() when this file is the direct entry point, not when imported.
const isDirectEntry = process.argv[1]?.endsWith("audit-site.ts") ||
                      process.argv[1]?.endsWith("audit-site.js");

if (isDirectEntry) {
  main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
}
