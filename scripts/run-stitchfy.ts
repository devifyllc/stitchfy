#!/usr/bin/env tsx
/**
 * run-stitchfy — Main CLI entry point for the Stitchfy pipeline.
 *
 * Usage:
 *   npm run stitchfy
 *   npm run stitchfy -- --input path/to/project.md
 *   npm run stitchfy -- --input path/to/project.md --output path/to/output
 */

import path from "path";
import { runPipeline } from "../framework/orchestrator/orchestrator.js";
import { validateInput } from "../framework/validators/validate-input.js";

async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag: string, fallback: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };

  const inputPath = path.resolve(getArg("--input", "input/project.md"));
  const outputDir = path.resolve(getArg("--output", "output"));

  const validation = validateInput(inputPath);
  for (const w of validation.warnings) console.warn(`  ⚠  ${w}`);
  if (!validation.valid) {
    for (const e of validation.errors) console.error(`  ✗  ${e}`);
    process.exit(1);
  }

  try {
    const state = await runPipeline(inputPath, outputDir);
    process.exit(state.stage === "complete" ? 0 : 1);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

main();
