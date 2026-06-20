#!/usr/bin/env tsx
/**
 * build-site-stitch — Generates a static website via Google Stitch MCP.
 *
 * Unlike build-site (which uses template-based code generation), this script
 * sends each page through the Stitch AI design pipeline and assembles the
 * resulting HTML into a deployable site.
 *
 * Steps:
 *   1. Read output/blueprint/website-blueprint.v1.json (or --blueprint path)
 *   2. Create a Stitch project for this business
 *   3. Generate one AI screen per blueprint page (uses STITCH_MODEL, default: GEMINI_3_PRO)
 *   4. Call build_site — maps all screens to routes, returns full HTML per page
 *   5. Post-process — inject SEO meta tags, JSON-LD, skip link, lang attribute
 *   6. Write output/stitch-site/{route}/index.html for every page
 *
 * Requirements:
 *   STITCH_API_KEY must be set in .env or the environment.
 *
 * Usage:
 *   npm run build:site:stitch
 *   npm run build:site:stitch -- --blueprint path/to/blueprint.json
 *   STITCH_MODEL=GEMINI_3_FLASH npm run build:site:stitch
 */

import * as fs from "fs";
import * as path from "path";
import { generateWithStitch } from "../framework/core/stitch-generator.js";
import type { WebsiteBlueprint } from "../framework/schemas/blueprint.types.js";

// Load .env if present (Node 18 does not auto-load .env)
loadDotEnv(path.resolve(".env"));

const args = process.argv.slice(2);
const getBlueprintPath = (): string => {
  const i = args.indexOf("--blueprint");
  return i !== -1 && args[i + 1]
    ? path.resolve(args[i + 1])
    : path.resolve("output/blueprint/website-blueprint.v1.json");
};

const DIVIDER = "━".repeat(52);

function step(n: number, total: number, label: string) {
  console.log(`\n  [${n}/${total}] ${label}...`);
}
function ok(msg: string)   { console.log(`  ✓  ${msg}`); }
function warn(msg: string) { console.warn(`  ⚠  ${msg}`); }
function fail(msg: string) { console.error(`  ✗  ${msg}`); }

async function main() {
  console.log(`\n${DIVIDER}`);
  console.log("  Stitchfy v2 — Build with Google Stitch");
  console.log(DIVIDER);

  const blueprintPath = getBlueprintPath();
  const outputDir     = path.resolve("output/stitch-site");
  const TOTAL         = 3;

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

  ok(
    `Blueprint loaded — ${blueprint.pages.length} pages` +
    ` | ${blueprint.business.name} | ${blueprint.business.industry}`
  );
  console.log(`  Output: ${outputDir}`);
  console.log(`  Model:  ${process.env.STITCH_MODEL ?? "GEMINI_3_PRO"}`);

  if (!process.env.STITCH_API_KEY) {
    fail("STITCH_API_KEY is not set.");
    console.log("  Add  STITCH_API_KEY=<your-key>  to your .env file and retry.\n");
    process.exit(1);
  }

  // ── Step 2: Generate with Stitch ────────────────────────────────────────────
  step(2, TOTAL, `Generating ${blueprint.pages.length} page(s) via Stitch MCP`);
  console.log("  (Each page goes through Gemini — this may take 30–90 seconds per page)\n");

  const result = await generateWithStitch(
    blueprint,
    outputDir,
    (msg) => console.log(`  ${msg}`)
  );

  for (const e of result.errors)   fail(e);
  for (const w of result.warnings) warn(w);

  if (!result.ok) {
    fail("Stitch generation failed — no pages were written.");
    process.exit(1);
  }

  ok(`${result.pagesGenerated} page(s) written to output/stitch-site/`);
  ok(`Stitch project ID: ${result.projectId}`);

  // ── Step 3: Done ────────────────────────────────────────────────────────────
  step(3, TOTAL, "Done");

  console.log(`\n${DIVIDER}`);
  console.log("  Stitch site ready at output/stitch-site/");
  console.log("  Open output/stitch-site/index.html to preview locally.");
  console.log('  Run "npm run audit" to check accessibility and SEO.');
  console.log(`${DIVIDER}\n`);
}

// ─── Minimal .env loader ──────────────────────────────────────────────────────
// Keeps the script self-contained without requiring dotenv as a dependency.

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
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

main().catch((e) => {
  console.error("\nFatal:", e);
  process.exit(1);
});
