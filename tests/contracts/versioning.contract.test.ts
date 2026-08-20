/**
 * Version-consistency contract tests (RC1) — guards against exactly the
 * drift this phase found and fixed: package.json's version disagreeing
 * with hardcoded frameworkVersion strings in generated artifacts. See
 * docs/architecture/KNOWN_TECHNICAL_DEBT.md "Resolved by RC1".
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { STITCHFY_VERSION } from "../../framework/core/version.js";
import { REFERENCE_SOLUTIONS } from "../reference/reference-solutions.js";
import { runReferenceScenario } from "../reference/reference-runner.js";
import { runPipeline } from "../../framework/orchestrator/orchestrator.js";

const REPO_ROOT = process.cwd();

describe("STITCHFY_VERSION source of truth", () => {
  test("matches package.json's version", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
    assert.equal(STITCHFY_VERSION, pkg.version);
  });
});

describe("Generated frameworkVersion matches STITCHFY_VERSION", () => {
  for (const def of REFERENCE_SOLUTIONS) {
    test(`${def.name}: solution-blueprint frameworkVersion`, async () => {
      const context = await runReferenceScenario(def);
      assert.equal(context.solutionBlueprint.project?.frameworkVersion, STITCHFY_VERSION);
    });
  }

  test("website pipeline: website-blueprint frameworkVersion", async () => {
    // Runs the existing website pipeline directly (framework/orchestrator/orchestrator.ts),
    // the same function scripts/run-stitchfy.ts calls — not a subprocess,
    // not a duplicate of Phase 9's solution-pipeline-specific runner.
    const outputDir = path.join(REPO_ROOT, "output", "contracts", "website-version-check");
    const state = await runPipeline(path.join(REPO_ROOT, "input", "project.md"), outputDir);
    assert.equal(state.stage, "complete");
    const blueprintPath = path.join(outputDir, "blueprint", "website-blueprint.v1.json");
    const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8"));
    assert.equal(blueprint.project.frameworkVersion, STITCHFY_VERSION);
  });
});
