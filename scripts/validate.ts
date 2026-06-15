#!/usr/bin/env tsx
/**
 * validate — Validates the input Markdown file and (if present) the
 * output blueprint against their schemas.
 *
 * Usage:
 *   npm run validate
 *   npm run validate -- --input path/to/project.md
 */

import path from "path";
import fs from "fs";
import { validateInput } from "../framework/validators/validate-input.js";
import { validateBlueprint } from "../framework/validators/validate-blueprint.js";

const args = process.argv.slice(2);
const getArg = (flag: string, fallback: string) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const inputPath = path.resolve(getArg("--input", "input/project.md"));
const blueprintPath = path.resolve(getArg("--blueprint", "output/blueprint/website-blueprint.json"));

let failed = false;

console.log("\n── Input validation ──────────────────────────");
const inputResult = validateInput(inputPath);
for (const w of inputResult.warnings) console.warn(`  ⚠  ${w}`);
for (const e of inputResult.errors) { console.error(`  ✗  ${e}`); failed = true; }
if (inputResult.valid) console.log("  ✓  Input file is valid.");

if (fs.existsSync(blueprintPath)) {
  console.log("\n── Blueprint validation ──────────────────────");
  const bpResult = validateBlueprint(blueprintPath);
  for (const w of bpResult.warnings) console.warn(`  ⚠  ${w}`);
  for (const e of bpResult.errors) { console.error(`  ✗  ${e}`); failed = true; }
  if (bpResult.valid) console.log("  ✓  Blueprint is valid.");
} else {
  console.log(`\n── Blueprint not found at ${blueprintPath} (run npm run stitchfy first)`);
}

console.log("");
process.exit(failed ? 1 : 0);
