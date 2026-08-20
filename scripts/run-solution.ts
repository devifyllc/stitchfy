#!/usr/bin/env tsx
/**
 * run-solution — CLI entry point for the new Solution Pipeline
 * (business discovery → SolutionContext → capability registry →
 * solution-blueprint.v1.json). Mirrors run-stitchfy.ts's shape.
 *
 * Usage:
 *   npm run solution
 *   npm run solution -- --input path/to/project.md
 *   npm run solution -- --input path/to/project.md --output path/to/output
 *   npm run solution -- --input spec.md --codebase ../repo --system-id SYS-001
 *   npm run solution -- --input spec.md --codebase ../repo --system-id SYS-001 --modernization-export generic-java-replatform
 */

import path from "path";
import { runSolutionPipeline } from "../framework/orchestrator/solution-orchestrator.js";
import { validateInput } from "../framework/validators/validate-input.js";

async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag: string, fallback: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };

  const getOptionalArg = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };

  const inputPath = path.resolve(getArg("--input", "input/project.md"));
  const outputDir = path.resolve(getArg("--output", "output"));
  const codebaseArg = getOptionalArg("--codebase");
  const codebasePath = codebaseArg ? path.resolve(codebaseArg) : undefined;
  const codebaseSystemId = getOptionalArg("--system-id");
  const modernizationExportTarget = getOptionalArg("--modernization-export");

  const validation = validateInput(inputPath);
  for (const w of validation.warnings) console.warn(`  ⚠  ${w}`);
  if (!validation.valid) {
    for (const e of validation.errors) console.error(`  ✗  ${e}`);
    process.exit(1);
  }

  try {
    const context = await runSolutionPipeline(inputPath, outputDir, codebasePath, codebaseSystemId, modernizationExportTarget);
    process.exit(context.stage === "complete" ? 0 : 1);
  } catch (err) {
    console.error("Fatal error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
