#!/usr/bin/env tsx
/**
 * reference-validate — runs the three canonical reference solutions
 * (examples/reference/) and checks them against tests/reference/reference-solutions.ts's
 * manifest: selected/not-selected capabilities, artifact existence,
 * semantic invariants, and golden-subset stability. Entirely offline — no
 * network call, no STITCH_API_KEY/OPENAI_API_KEY, and the analyzed
 * codebase fixture is left untouched.
 *
 * Usage: npm run reference:validate
 */

import * as fs from "fs";
import * as path from "path";
import {
  REFERENCE_SOLUTIONS,
  type ReferenceSolutionDefinition,
} from "../tests/reference/reference-solutions.js";
import {
  runReferenceScenario,
  normalizeReferenceOutput,
  checkArtifactDirs,
  assertGoldenSubset,
} from "../tests/reference/reference-runner.js";
import type { SolutionContext } from "../framework/core/contracts/context.js";

const REPO_ROOT = path.resolve(__dirname, "..");

interface ScenarioResult {
  id: string;
  name: string;
  stage: string;
  selectedCapabilities: string[];
  capabilityChecks: { capabilityId: string; expectedSelected: boolean; actualSelected: boolean; ok: boolean }[];
  artifactChecks: { dir: string; ok: boolean }[];
  invariantResults: { id: string; description: string; ok: boolean; detail?: string }[];
  goldenErrors: string[];
  ok: boolean;
}

function ok(msg: string) {
  console.log(`  ✓  ${msg}`);
}
function fail(msg: string) {
  console.error(`  ✗  ${msg}`);
}

async function validateScenario(def: ReferenceSolutionDefinition): Promise<ScenarioResult> {
  console.log(`\n▶ ${def.name} (${def.id})`);
  const context: SolutionContext = await runReferenceScenario(def);
  const selected = context.solutionPlan?.selectedCapabilities ?? [];

  const capabilityChecks = [
    ...def.expectedSelectedCapabilities.map((capabilityId) => ({
      capabilityId,
      expectedSelected: true,
      actualSelected: selected.includes(capabilityId),
      ok: selected.includes(capabilityId),
    })),
    ...def.expectedNotSelectedCapabilities.map((capabilityId) => ({
      capabilityId,
      expectedSelected: false,
      actualSelected: selected.includes(capabilityId),
      ok: !selected.includes(capabilityId),
    })),
  ];

  const outputDir = path.resolve(REPO_ROOT, "output", "reference", def.id);
  const artifactChecks = checkArtifactDirs(outputDir, def.expectedArtifactDirs);

  const invariantResults = def.expectedInvariants.map((inv) => {
    const result = inv.check(context);
    return { id: inv.id, description: inv.description, ok: result === true, detail: result === true ? undefined : result };
  });

  let goldenErrors: string[] = [];
  const fixturePath = path.resolve(REPO_ROOT, def.expectedFixturePath);
  if (fs.existsSync(fixturePath)) {
    const expected = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    const actual = normalizeReferenceOutput(context.solutionBlueprint);
    goldenErrors = assertGoldenSubset(expected, actual);
  } else {
    goldenErrors = [`golden fixture not found: ${def.expectedFixturePath}`];
  }

  const scenarioOk =
    context.stage === "complete" &&
    capabilityChecks.every((c) => c.ok) &&
    artifactChecks.every((a) => a.ok) &&
    invariantResults.every((i) => i.ok) &&
    goldenErrors.length === 0;

  for (const c of capabilityChecks) {
    const label = `${c.capabilityId}: expected ${c.expectedSelected ? "selected" : "not selected"}`;
    if (c.ok) ok(label);
    else fail(`${label}, got ${c.actualSelected ? "selected" : "not selected"}`);
  }
  for (const a of artifactChecks) (a.ok ? ok : fail)(`artifacts: ${a.dir}`);
  for (const i of invariantResults) (i.ok ? ok : fail)(`invariant ${i.id}${i.ok ? "" : `: ${i.detail}`}`);
  for (const e of goldenErrors) fail(`golden: ${e}`);

  return {
    id: def.id,
    name: def.name,
    stage: context.stage,
    selectedCapabilities: selected,
    capabilityChecks,
    artifactChecks,
    invariantResults,
    goldenErrors,
    ok: scenarioOk,
  };
}

function buildCapabilityCoverage(results: ScenarioResult[]): Record<string, string[]> {
  const coverage: Record<string, string[]> = {};
  for (const result of results) {
    for (const capabilityId of result.selectedCapabilities) {
      coverage[capabilityId] = coverage[capabilityId] ?? [];
      coverage[capabilityId].push(result.id);
    }
  }
  return coverage;
}

function renderMarkdown(results: ScenarioResult[], coverage: Record<string, string[]>): string {
  const lines: string[] = ["# Stitchfy Reference Validation", "", "## Summary", ""];
  const overallOk = results.every((r) => r.ok);
  lines.push(`Status: **${overallOk ? "PASSED" : "FAILED"}**`, "");
  for (const result of results) {
    lines.push(`## ${result.name}`, "", `Status: ${result.ok ? "PASS" : "FAIL"}`, "", "Selected capabilities:", "");
    for (const c of result.selectedCapabilities) lines.push(`- ${c}`);
    lines.push("", "Key invariants:", "");
    for (const inv of result.invariantResults) lines.push(`- ${inv.ok ? "PASS" : "FAIL"} — ${inv.description}${inv.ok ? "" : ` (${inv.detail})`}`);
    lines.push("");
  }
  lines.push("## Capability Coverage", "");
  for (const [capabilityId, scenarioIds] of Object.entries(coverage).sort()) {
    lines.push(`- **${capabilityId}**: ${scenarioIds.join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const results: ScenarioResult[] = [];
  for (const def of REFERENCE_SOLUTIONS) {
    results.push(await validateScenario(def));
  }

  const coverage = buildCapabilityCoverage(results);
  const overallOk = results.every((r) => r.ok);

  const outDir = path.resolve(REPO_ROOT, "output", "reference");
  fs.mkdirSync(outDir, { recursive: true });

  const markdown = renderMarkdown(results, coverage);
  fs.writeFileSync(path.join(outDir, "reference-validation.md"), markdown);

  const jsonIndex = {
    schemaVersion: "1.0",
    scenarios: results.map((r) => ({
      id: r.id,
      name: r.name,
      ok: r.ok,
      selectedCapabilities: r.selectedCapabilities,
      invariants: r.invariantResults,
    })),
    capabilityCoverage: coverage,
    status: overallOk ? "passed" : "failed",
  };
  fs.writeFileSync(path.join(outDir, "reference-validation.json"), JSON.stringify(jsonIndex, null, 2));

  console.log(`\n${overallOk ? "✓ All reference scenarios passed." : "✗ One or more reference scenarios failed."}`);
  console.log(`  Report: output/reference/reference-validation.md`);
  console.log(`  Index:  output/reference/reference-validation.json`);

  process.exit(overallOk ? 0 : 1);
}

main();
