#!/usr/bin/env tsx
/**
 * build-site-stitch — Generates a static website via Google Stitch MCP.
 *
 * Steps:
 *   1. Read blueprint
 *   2. Generate pages via Stitch (create project → screens → get HTML →
 *      post-process → SEO/A11y agent review → patch → write)
 *   3. Run general HTML audit on output/stitch-site/ → stitch-*.html reports
 *   4. Done
 *
 * Requirements:
 *   STITCH_API_KEY must be set in .env or the environment.
 *
 * Usage:
 *   npm run build:site:stitch
 *   npm run build:site:stitch -- --blueprint path/to/blueprint.json
 *   npm run build:site:stitch -- --no-audit   (skip step 3)
 *   STITCH_MODEL=GEMINI_3_FLASH npm run build:site:stitch
 */

import * as fs from "fs";
import * as path from "path";
import { generateWithStitch } from "../framework/core/stitch-generator.js";
import { runAudit } from "./audit-site.js";
import type { WebsiteBlueprint } from "../framework/schemas/blueprint.types.js";

loadDotEnv(path.resolve(".env"));

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}

const blueprintPath = path.resolve(getArg("--blueprint") ?? "output/blueprint/website-blueprint.v1.json");
const skipAudit     = args.includes("--no-audit");

const DIVIDER = "━".repeat(52);

function step(n: number, total: number, label: string) {
  console.log(`\n  [${n}/${total}] ${label}...`);
}
function ok(msg: string)   { console.log(`  ✓  ${msg}`); }
function warn(msg: string) { console.warn(`  ⚠  ${msg}`); }
function fail(msg: string) { console.error(`  ✗  ${msg}`); }

async function main() {
  const TOTAL = skipAudit ? 3 : 4;

  console.log(`\n${DIVIDER}`);
  console.log("  Stitchfy v2 — Build with Google Stitch");
  console.log(DIVIDER);

  const outputDir = path.resolve("output/stitch-site");

  // ── Step 1: Read blueprint ──────────────────────────────────────────────────
  step(1, TOTAL, "Reading blueprint");

  if (!fs.existsSync(blueprintPath)) {
    fail(`Blueprint not found: ${blueprintPath}`);
    console.log('  Run "npm run stitchfy" first to generate the blueprint.\n');
    process.exit(1);
  }

  let blueprint: WebsiteBlueprint;
  try {
    blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8")) as WebsiteBlueprint;
  } catch (e) {
    fail(`Failed to parse blueprint: ${(e as Error).message}`);
    process.exit(1);
  }

  ok(`Blueprint loaded — ${blueprint.pages.length} pages | ${blueprint.business.name} | ${blueprint.business.industry}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Model:  ${process.env.STITCH_MODEL ?? "GEMINI_3_1_PRO"}`);

  if (!process.env.STITCH_API_KEY) {
    fail("STITCH_API_KEY is not set.");
    console.log("  Add  STITCH_API_KEY=<your-key>  to your .env file and retry.\n");
    process.exit(1);
  }

  // ── Step 2: Generate with Stitch ────────────────────────────────────────────
  step(2, TOTAL, `Generating ${blueprint.pages.length} page(s) via Stitch MCP`);
  console.log("  (Each page goes through Gemini — this may take 30–90 seconds per page)\n");

  const result = await generateWithStitch(blueprint, outputDir, (msg) => console.log(`  ${msg}`));

  for (const e of result.errors)   fail(e);
  for (const w of result.warnings) warn(w);

  if (!result.ok) {
    fail("Stitch generation failed — no pages were written.");
    process.exit(1);
  }

  ok(`${result.pagesGenerated} page(s) written to output/stitch-site/`);
  ok(`Stitch project ID: ${result.projectId}`);
  if (result.reportPath) ok(`Inline review report: ${path.relative(process.cwd(), result.reportPath)}`);

  // ── Step 3: General HTML audit ──────────────────────────────────────────────
  if (!skipAudit) {
    step(3, TOTAL, "Running general HTML audit on output/stitch-site/");

    const auditResult = await runAudit(
      blueprint,
      outputDir,
      path.resolve("output"),
      "stitch-",
      (msg) => console.log(`  ${msg}`)
    );

    for (const r of auditResult.reportsWritten) ok(r);

    if (auditResult.passCount + auditResult.warnCount + auditResult.failCount > 0) {
      ok(`HTML checks: ${auditResult.passCount} passed, ${auditResult.warnCount} warnings, ${auditResult.failCount} failures`);
    }
    if (auditResult.failCount > 0) {
      warn(`${auditResult.failCount} check(s) failed — review output/reports/stitch-accessibility-report.html`);
    }
  }

  // ── Step 4: Done ────────────────────────────────────────────────────────────
  step(TOTAL, TOTAL, "Done");

  console.log(`\n${DIVIDER}`);
  console.log("  Stitch site ready at output/stitch-site/");
  console.log("  Open output/stitch-site/index.html to preview locally.");
  console.log("  Reports → output/reports/");
  console.log("    → stitch-review-report.html      (inline agent review)");
  if (!skipAudit) {
    console.log("    → stitch-accessibility-report.html (general HTML audit)");
    console.log("    → stitch-seo-report.html            (general SEO audit)");
    console.log("    → stitch-final-report.html          (pipeline summary)");
  }
  console.log(`${DIVIDER}\n`);
}

// ─── Minimal .env loader ──────────────────────────────────────────────────────

function loadDotEnv(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

main().catch((e) => {
  console.error("\nFatal:", e);
  process.exit(1);
});
