/**
 * SolutionBlueprint v1 contract tests (RC1) — locks in the compatibility
 * guarantees documented in docs/architecture/COMPATIBILITY.md and the
 * freeze decision in docs/architecture/decisions/ADR-002-solution-blueprint-v1-stability.md.
 * Reuses tests/reference/'s manifest/runner (no duplicated pipeline logic)
 * against the three canonical Phase 9 reference blueprints.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { REFERENCE_SOLUTIONS } from "../reference/reference-solutions.js";
import { runReferenceScenario } from "../reference/reference-runner.js";
import { validateSolutionBlueprint } from "../../framework/schemas/solution-blueprint/solution-blueprint.schema.js";
import { SOLUTION_BLUEPRINT_SCHEMA_VERSION } from "../../framework/core/version.js";

describe("SolutionBlueprint v1 — canonical reference blueprints", () => {
  for (const def of REFERENCE_SOLUTIONS) {
    test(`${def.name}: validates against SolutionBlueprintSchema`, async () => {
      const context = await runReferenceScenario(def);
      const validation = validateSolutionBlueprint(context.solutionBlueprint);
      assert.equal(validation.ok, true, validation.ok ? undefined : validation.errors.join("; "));
    });

    test(`${def.name}: schemaVersion stays "1.0"`, async () => {
      const context = await runReferenceScenario(def);
      assert.equal(context.solutionBlueprint.project?.schemaVersion, SOLUTION_BLUEPRINT_SCHEMA_VERSION);
      assert.equal(SOLUTION_BLUEPRINT_SCHEMA_VERSION, "1.0");
    });

    test(`${def.name}: does not populate the deprecated "deployment" field`, async () => {
      const context = await runReferenceScenario(def);
      assert.equal(context.solutionBlueprint.deployment, undefined);
    });

    test(`${def.name}: required base fields remain present`, async () => {
      const context = await runReferenceScenario(def);
      assert.ok(context.solutionBlueprint.project);
      assert.ok(context.solutionBlueprint.business);
    });
  }

  test("order-platform: architecture is the real CloudArchitectureSection, not the legacy deployment shape", async () => {
    const def = REFERENCE_SOLUTIONS.find((d) => d.id === "order-platform")!;
    const context = await runReferenceScenario(def);
    const architecture = context.solutionBlueprint.architecture;
    assert.ok(architecture, "expected architecture (CloudArchitectureSection) to be present");
    assert.ok(architecture.architecture.deploymentUnits.length > 0, "expected real DeploymentUnit(s)");
  });
});

describe("SolutionBlueprint v1 — legacy `deployment` remains accepted (deprecated, not removed)", () => {
  test("a historical document containing `deployment` still validates", async () => {
    const def = REFERENCE_SOLUTIONS.find((d) => d.id === "order-platform")!;
    const context = await runReferenceScenario(def);
    const legacyShaped = {
      ...context.solutionBlueprint,
      deployment: { environments: ["production"], strategy: "manual", notes: ["from a historical document"] },
    };
    const validation = validateSolutionBlueprint(legacyShaped);
    assert.equal(validation.ok, true, validation.ok ? undefined : validation.errors.join("; "));
    if (validation.ok) {
      assert.deepEqual(validation.blueprint.deployment, legacyShaped.deployment);
    }
  });
});

describe("SolutionBlueprint v1 — optional capability sections remain optional", () => {
  test("a minimal blueprint with no capability sections still validates", () => {
    const minimal = {
      project: { schemaVersion: SOLUTION_BLUEPRINT_SCHEMA_VERSION, generatedAt: new Date().toISOString(), sourceFile: "test.md", frameworkVersion: "0.0.0-test" },
      business: {
        businessName: "Test Co",
        industry: "unknown",
        goals: [],
        users: [],
        processes: [],
        painPoints: [],
        existingSystems: [],
        businessRules: [],
        integrations: [],
        data: [],
        constraints: [],
        desiredOutcomes: [],
        missingInformation: [],
      },
    };
    const validation = validateSolutionBlueprint(minimal);
    assert.equal(validation.ok, true, validation.ok ? undefined : validation.errors.join("; "));
  });
});
