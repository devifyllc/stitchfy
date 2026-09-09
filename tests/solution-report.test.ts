/**
 * Coverage for the Solution Report (framework/reports/solution-report/) —
 * the human-readable HTML projection of solution-blueprint.v1.json. Reuses
 * the canonical reference-scenario infrastructure (tests/reference/) for
 * data-driven assertions, same convention as reference-solutions.test.ts,
 * and adds two hand-built minimal/adversarial blueprints for the two cases
 * real reference data can't exercise (missing optional fields, hostile
 * input). Run with `npm run test`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { REFERENCE_SOLUTIONS } from "./reference/reference-solutions.js";
import { runReferenceScenario } from "./reference/reference-runner.js";
import type { SolutionContext } from "../framework/core/contracts/context.js";
import type { SolutionBlueprint } from "../framework/schemas/solution-blueprint/solution-blueprint.types.js";
import { buildSolutionReportProjection } from "../framework/reports/solution-report/projection.js";
import { renderSolutionReportHtml } from "../framework/reports/solution-report/render.js";
import { writeSolutionReport } from "../framework/reports/solution-report/index.js";

const REPO_ROOT = process.cwd();

// Reuse the same scenario run(s) reference-solutions.test.ts already exercises
// rather than re-running the pipeline a second time in this file.
const scenarioPromises = new Map<string, Promise<SolutionContext>>();
function getContext(id: string): Promise<SolutionContext> {
  const def = REFERENCE_SOLUTIONS.find((d) => d.id === id)!;
  let promise = scenarioPromises.get(id);
  if (!promise) {
    promise = runReferenceScenario(def);
    scenarioPromises.set(id, promise);
  }
  return promise;
}

function minimalBlueprint(overrides: Partial<SolutionBlueprint> = {}): SolutionBlueprint {
  return {
    project: {
      schemaVersion: "1.0",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceFile: "test.md",
      frameworkVersion: "2.2.0",
    },
    business: {
      businessName: "Test Co",
      industry: "retail",
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
    ...overrides,
  };
}

// ─── Data-driven checks against the real legacy-java-modernization scenario ─

describe("Solution Report — legacy-java-modernization reference data", () => {
  test("generates reports/solution-report.html as part of the normal pipeline run", async () => {
    await getContext("legacy-java-modernization");
    const filePath = path.resolve(REPO_ROOT, "output/reference/legacy-java-modernization/reports/solution-report.html");
    assert.ok(fs.existsSync(filePath), `${filePath} was not generated`);
    const html = fs.readFileSync(filePath, "utf-8");
    assert.ok(html.startsWith("<!DOCTYPE html>"));
    assert.ok(html.includes("<title>Solution Report"));
  });

  test("project metadata (business name, source file, framework/schema version) renders", async () => {
    const context = await getContext("legacy-java-modernization");
    const blueprint = context.solutionBlueprint as SolutionBlueprint;
    const html = renderSolutionReportHtml(buildSolutionReportProjection(blueprint));
    assert.ok(html.includes(blueprint.business.businessName));
    assert.ok(html.includes(blueprint.project.sourceFile));
    assert.ok(html.includes(blueprint.project.frameworkVersion));
    assert.ok(html.includes(blueprint.project.schemaVersion));
  });

  test("both the Capabilities and Implementation Backlog views exist", async () => {
    const context = await getContext("legacy-java-modernization");
    const html = renderSolutionReportHtml(buildSolutionReportProjection(context.solutionBlueprint as SolutionBlueprint));
    assert.ok(html.includes('id="panel-capabilities"'));
    assert.ok(html.includes('id="panel-backlog"'));
    assert.ok(html.includes('id="tab-capabilities"'));
    assert.ok(html.includes('id="tab-backlog"'));
  });

  test("capability assessments render with status, confidence and method-derived reasons", async () => {
    const context = await getContext("legacy-java-modernization");
    const projection = buildSolutionReportProjection(context.solutionBlueprint as SolutionBlueprint);
    const modernization = projection.capabilities.find((c) => c.capabilityId === "modernization");
    assert.ok(modernization);
    assert.equal(modernization!.assessmentStatus, "recommended");
    assert.equal(modernization!.executionStatus, "executed");
    assert.ok(modernization!.reasons.length > 0);
  });

  test("selected/executed and not-selected/skipped capabilities remain visibly distinguishable", async () => {
    const context = await getContext("legacy-java-modernization");
    const html = renderSolutionReportHtml(buildSolutionReportProjection(context.solutionBlueprint as SolutionBlueprint));
    // modernization: recommended + executed. workflow-automation: not-recommended + skipped.
    assert.ok(html.includes('pill-positive">recommended<'));
    assert.ok(html.includes('pill-negative">not-recommended<'));
    assert.ok(html.includes('pill-positive">executed<'));
    assert.ok(html.includes('pill-neutral">skipped<'));
  });

  test("evidence references are preserved and resolvable back to real discovery entities", async () => {
    const context = await getContext("legacy-java-modernization");
    const projection = buildSolutionReportProjection(context.solutionBlueprint as SolutionBlueprint);
    const modernization = projection.capabilities.find((c) => c.capabilityId === "modernization")!;
    const allEvidence = modernization.reasons.flatMap((r) => r.evidenceRefs);
    assert.ok(allEvidence.length > 0);
    for (const ref of allEvidence) {
      assert.ok(ref.entityId.length > 0);
    }
    // At least one reason should cite a real system that exists in the blueprint.
    assert.ok(allEvidence.some((r) => r.entityType === "system" && projection.entityIndex[r.entityId] !== undefined));
  });

  test("information gaps remain visible as Information Gap backlog items, never silently dropped", async () => {
    const context = await getContext("legacy-java-modernization");
    const blueprint = context.solutionBlueprint as SolutionBlueprint;
    const projection = buildSolutionReportProjection(blueprint);
    const gapItems = projection.backlog.filter((i) => i.type === "Information Gap");
    assert.ok(gapItems.length > 0);
    assert.ok((blueprint.informationGaps ?? []).length > 0);
    for (const gap of blueprint.informationGaps ?? []) {
      assert.ok(gapItems.some((i) => i.id === gap.id), `gap ${gap.id} missing from backlog`);
    }
  });

  test("risks remain type \"Risk\" — never silently converted into a generic task/step", async () => {
    const context = await getContext("legacy-java-modernization");
    const blueprint = context.solutionBlueprint as SolutionBlueprint;
    const projection = buildSolutionReportProjection(blueprint);
    const allRisks = [...(blueprint.security?.risks ?? []), ...(blueprint.modernization?.architecture.risks ?? [])];
    assert.ok(allRisks.length > 0);
    for (const risk of allRisks) {
      const item = projection.backlog.find((i) => i.id === risk.id);
      assert.ok(item, `risk ${risk.id} missing from backlog`);
      assert.equal(item!.type, "Risk");
    }
  });

  test("modernization migration-recipe steps appear as Implementation Step backlog items", async () => {
    const context = await getContext("legacy-java-modernization");
    const blueprint = context.solutionBlueprint as SolutionBlueprint;
    const projection = buildSolutionReportProjection(blueprint);
    const steps = (blueprint.modernization?.exports ?? []).flatMap((bundle) => bundle.recipe.steps);
    assert.ok(steps.length > 0);
    for (const step of steps) {
      const item = projection.backlog.find((i) => i.id === step.id);
      assert.ok(item, `step ${step.id} missing from backlog`);
      assert.equal(item!.type, "Implementation Step");
      assert.ok(item!.capabilityIds.includes("modernization"));
    }
  });
});

// ─── Unit-level checks needing controlled/adversarial fixtures ─────────────

describe("Solution Report — robustness", () => {
  test("a report is generated for a minimal, mostly-empty blueprint with no crash", () => {
    const blueprint = minimalBlueprint();
    const result = writeSolutionReport(blueprint, path.join(REPO_ROOT, "output", "test-scratch", "minimal"));
    assert.ok(result.ok, result.error);
    assert.ok(result.filePath && fs.existsSync(result.filePath));
  });

  test("missing optional sections (no capabilities/risks/gaps/artifacts) render without throwing", () => {
    const blueprint = minimalBlueprint();
    assert.doesNotThrow(() => {
      const projection = buildSolutionReportProjection(blueprint);
      renderSolutionReportHtml(projection);
    });
    const projection = buildSolutionReportProjection(blueprint);
    assert.deepEqual(projection.capabilities, []);
    assert.deepEqual(projection.backlog, []);
  });

  test("HTML-sensitive blueprint content is escaped, never interpreted as markup", () => {
    const payload = '<script>alert(1)</script>"><img src=x onerror=alert(2)>';
    const blueprint = minimalBlueprint({
      business: {
        ...minimalBlueprint().business,
        businessName: payload,
        desiredOutcomes: [payload],
      },
      informationGaps: [
        {
          id: "GAP-001",
          topic: payload,
          question: payload,
          importance: "high",
          blocking: false,
          relatedCapabilityIds: [],
        },
      ],
    });

    const html = renderSolutionReportHtml(buildSolutionReportProjection(blueprint));
    assert.ok(!html.includes("<script>alert(1)</script>"), "raw <script> tag leaked into output unescaped");
    assert.ok(!html.includes("<img src=x onerror=alert(2)>"), "raw <img onerror> leaked into output unescaped");
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "expected escaped form of the payload");
  });
});
