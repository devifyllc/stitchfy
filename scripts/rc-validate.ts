#!/usr/bin/env tsx
/**
 * rc-validate — composes the existing release-candidate gates rather than
 * reimplementing them: typecheck, the full test suite (which already
 * includes tests/contracts/), and reference:validate. Writes
 * output/release/rc-validation.{json,md}.
 *
 * npm run stitchfy / npm run solution are documented as manual RC gates
 * (see docs/architecture/RELEASE_CANDIDATE.md "Release Gates") rather than
 * run here, to avoid unnecessary output churn on every rc:validate run.
 *
 * Usage: npm run rc:validate
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { STITCHFY_VERSION, SOLUTION_BLUEPRINT_SCHEMA_VERSION, WEBSITE_BLUEPRINT_SCHEMA_VERSION } from "../framework/core/version.js";

const REPO_ROOT = path.resolve(__dirname, "..");

interface GateResult {
  id: string;
  name: string;
  command: string;
  ok: boolean;
  durationMs: number;
  output?: string;
}

function runGate(id: string, name: string, command: string): GateResult {
  console.log(`\n▶ ${name} (${command})`);
  const start = Date.now();
  try {
    execSync(command, { cwd: REPO_ROOT, stdio: "inherit" });
    return { id, name, command, ok: true, durationMs: Date.now() - start };
  } catch (err) {
    return { id, name, command, ok: false, durationMs: Date.now() - start, output: err instanceof Error ? err.message : String(err) };
  }
}

function renderMarkdown(gates: GateResult[], overallOk: boolean): string {
  const lines: string[] = [
    "# Stitchfy RC Validation",
    "",
    `Status: **${overallOk ? "PASSED" : "FAILED"}**`,
    "",
    `Framework version: \`${STITCHFY_VERSION}\``,
    `SolutionBlueprint schema: \`${SOLUTION_BLUEPRINT_SCHEMA_VERSION}\``,
    `WebsiteBlueprint schema: \`${WEBSITE_BLUEPRINT_SCHEMA_VERSION}\``,
    "",
    "## Gates",
    "",
  ];
  for (const gate of gates) {
    lines.push(`- ${gate.ok ? "PASS" : "FAIL"} — ${gate.name} (\`${gate.command}\`, ${gate.durationMs}ms)`);
  }
  lines.push(
    "",
    "## Manual gates (not run by this script)",
    "",
    "- `npm run stitchfy` — website pipeline compatibility",
    "- `npm run solution` — solution pipeline compatibility (bare, default input)",
    ""
  );
  return lines.join("\n");
}

async function main() {
  const gates: GateResult[] = [
    runGate("typecheck", "Type safety", "npm run typecheck"),
    runGate("test", "Full test suite (incl. contract tests)", "npm run test"),
    runGate("reference", "Reference solutions", "npm run reference:validate"),
  ];

  const overallOk = gates.every((g) => g.ok);

  const outDir = path.join(REPO_ROOT, "output", "release");
  fs.mkdirSync(outDir, { recursive: true });

  const jsonReport = {
    frameworkVersion: STITCHFY_VERSION,
    solutionBlueprintSchema: SOLUTION_BLUEPRINT_SCHEMA_VERSION,
    websiteBlueprintSchema: WEBSITE_BLUEPRINT_SCHEMA_VERSION,
    gates: gates.map((g) => ({ id: g.id, name: g.name, command: g.command, ok: g.ok, durationMs: g.durationMs })),
    manualGates: ["npm run stitchfy", "npm run solution"],
    status: overallOk ? "passed" : "failed",
  };
  fs.writeFileSync(path.join(outDir, "rc-validation.json"), JSON.stringify(jsonReport, null, 2));
  fs.writeFileSync(path.join(outDir, "rc-validation.md"), renderMarkdown(gates, overallOk));

  console.log(`\n${overallOk ? "✓ RC gates passed." : "✗ One or more RC gates failed."}`);
  console.log(`  Report: output/release/rc-validation.md`);
  console.log(`  Index:  output/release/rc-validation.json`);
  console.log(`  Manual gates still required: npm run stitchfy, npm run solution`);

  process.exit(overallOk ? 0 : 1);
}

main();
