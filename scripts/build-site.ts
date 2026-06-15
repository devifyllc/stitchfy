#!/usr/bin/env tsx
/**
 * build-site — Generates a static Next.js website from the blueprint.
 *
 * Steps:
 *   1. Read output/blueprint/website-blueprint.v1.json
 *   2. Generate output/generated-site/ (Next.js app with real data embedded)
 *   3. Create node_modules symlink so Next.js build can resolve packages
 *   4. Run next build inside output/generated-site/
 *   5. Copy output/generated-site/out/ → output/static-site/
 *
 * Usage:
 *   npm run build:site
 *   npm run build:site -- --blueprint path/to/blueprint.json
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { generateSite } from "../framework/core/site-generator.js";
import type { WebsiteBlueprint } from "../framework/schemas/blueprint.types.js";

const projectRoot = path.resolve(".");
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
function fail(msg: string) { console.error(`  ✗  ${msg}`); }

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Stitchfy v2 — Build Static Site");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const blueprintPath = getBlueprintPath();
  const generatedDir = path.resolve("output/generated-site");
  const staticDir = path.resolve("output/static-site");
  const TOTAL = 5;

  // ── Step 1: Read blueprint ────────────────────────────────────────────────
  step(1, TOTAL, "Reading blueprint");
  if (!fs.existsSync(blueprintPath)) {
    fail(`Blueprint not found at ${blueprintPath}`);
    console.log("  Run \"npm run stitchfy\" first to generate the blueprint.\n");
    process.exit(1);
  }

  let blueprint: WebsiteBlueprint;
  try {
    blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8")) as WebsiteBlueprint;
  } catch (e) {
    fail(`Failed to parse blueprint: ${(e as Error).message}`);
    process.exit(1);
  }
  ok(`Blueprint loaded — ${blueprint.pages.length} pages, ${blueprint.frontend.routes.length} routes`);

  // ── Step 2: Generate site source ─────────────────────────────────────────
  step(2, TOTAL, "Generating site source");
  try {
    const result = generateSite(blueprint, projectRoot);
    ok(`Generated ${result.filesWritten} files → output/generated-site/`);
    if (result.warnings.length > 0) {
      for (const w of result.warnings) console.log(`  ⚠  ${w}`);
    }
  } catch (e) {
    fail(`Site generation failed: ${(e as Error).message}`);
    console.error(e);
    process.exit(1);
  }

  // ── Step 3: Link node_modules ─────────────────────────────────────────────
  step(3, TOTAL, "Linking node_modules");
  const nodeModulesLink = path.join(generatedDir, "node_modules");
  const nodeModulesTarget = path.resolve("node_modules");

  if (fs.existsSync(nodeModulesLink)) {
    const stat = fs.lstatSync(nodeModulesLink);
    if (!stat.isSymbolicLink()) {
      fail("output/generated-site/node_modules exists but is not a symlink — remove it manually");
      process.exit(1);
    }
  } else {
    fs.symlinkSync(nodeModulesTarget, nodeModulesLink, "dir");
  }
  ok("node_modules symlink ready");

  // ── Step 4: Run next build ────────────────────────────────────────────────
  step(4, TOTAL, "Running next build (this may take 30–60 seconds)");
  const nextBin = path.resolve("node_modules/.bin/next");

  if (!fs.existsSync(nextBin)) {
    fail(`next binary not found at ${nextBin} — run npm install from the project root`);
    process.exit(1);
  }

  try {
    execSync(`"${nextBin}" build`, {
      cwd: generatedDir,
      stdio: "inherit",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    });
  } catch (e) {
    fail("next build failed — check output above for errors");
    process.exit(1);
  }

  // ── Step 5: Copy out/ → output/static-site/ ──────────────────────────────
  step(5, TOTAL, "Copying static export to output/static-site/");
  const outDir = path.join(generatedDir, "out");

  if (!fs.existsSync(outDir)) {
    fail(`next build did not produce an "out" directory. Make sure next.config.ts has output: "export".`);
    process.exit(1);
  }

  if (fs.existsSync(staticDir)) {
    fs.rmSync(staticDir, { recursive: true, force: true });
  }
  fs.cpSync(outDir, staticDir, { recursive: true });

  const staticFiles = countFiles(staticDir);
  ok(`Copied ${staticFiles} files → output/static-site/`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Static site ready at output/static-site/");
  console.log("  Deploy to: AWS S3, CloudFront, Netlify, Vercel, or any static host.");
  console.log("  Run \"npm run audit\" to generate HTML reports.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
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
