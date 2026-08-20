/**
 * Deterministic coverage for Phase 1.5 explainable planning. Uses Node's
 * built-in test runner, same as tests/discovery.test.ts. Run with
 * `npm run test`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { parseMarkdown } from "../framework/core/markdown-parser.js";
import { businessDiscoveryAgent } from "../framework/discovery/business/business-discovery.agent.js";
import { deriveBusinessContext } from "../framework/discovery/discovery-result.types.js";
import type { DiscoveryResult } from "../framework/discovery/discovery-result.types.js";
import { createSolutionContext } from "../framework/core/contracts/context.js";
import type { SolutionContext } from "../framework/core/contracts/context.js";
import { matchesKeywords } from "../framework/planning/capability-selector/capability-selector.js";
import { assessCapability, legacyKeywordAssessment } from "../framework/planning/capability-assessment/assess-capabilities.js";
import { buildSolutionPlan } from "../framework/planning/capability-assessment/solution-plan.js";
import { assessWorkflowAutomation } from "../framework/capabilities/workflow-automation/workflow-automation.assessor.js";
import { buildWorkflowAutomationPlan } from "../framework/capabilities/workflow-automation/workflow-automation.planner.js";
import { workflowAutomationCapability } from "../framework/capabilities/workflow-automation/workflow-automation.capability.js";
import { websiteCapability } from "../framework/capabilities/website/website.capability.js";

const REPO_ROOT = process.cwd();

async function makeContext(markdown: string): Promise<SolutionContext> {
  const parsed = parseMarkdown(markdown);
  const discoveryResult = await businessDiscoveryAgent.run({ parsed });
  const context = createSolutionContext("test.md", "test-output", markdown, parsed);
  context.discoveryResult = discoveryResult;
  context.businessContext = deriveBusinessContext(discoveryResult);
  return context;
}

/** Every entity id an EvidenceReference could point at, across the whole DiscoveryResult. */
function collectAllEntityIds(result: DiscoveryResult): Set<string> {
  const ids = new Set<string>();
  for (const arr of [
    result.goals,
    result.painPoints,
    result.desiredOutcomes,
    result.actors,
    result.processes,
    result.requirements,
    result.systems,
    result.integrationNeeds,
    result.dataEntities,
    result.constraints,
    result.businessRules,
    result.informationGaps,
  ] as Array<Array<{ id: string }>>) {
    for (const item of arr) ids.add(item.id);
  }
  return ids;
}

const appointmentMarkdown = fs.readFileSync(
  path.join(REPO_ROOT, "examples/solution/appointment-business.md"),
  "utf-8"
);

describe("Workflow selection (appointment-business)", () => {
  test("structured signals recommend Workflow Automation", async () => {
    const context = await makeContext(appointmentMarkdown);
    const assessment = assessWorkflowAutomation(context);

    assert.equal(assessment.method, "structured");
    assert.ok(assessment.status === "recommended" || assessment.status === "needs-review");
    assert.ok(assessment.relatedProcessIds.length > 0);
    assert.equal(workflowAutomationCapability.supports(context), true);
  });
});

describe("No keyword dependency", () => {
  const markdown = `# Project: Test Co

## Business Processes

Order Intake

Trigger:
A new order arrives

Actors:
Sales Rep
Warehouse Lead

Current systems:
Shopify
QuickBooks

Steps:
1. Rep reviews the order
2. Rep enters it into QuickBooks
3. Warehouse Lead is notified

Automation candidates:
- Push order data directly into QuickBooks
- Notify warehouse lead right away
`;

  test("legacy keyword list does not match this input, but structured assessment still recommends it", async () => {
    const context = await makeContext(markdown);

    const legacyText = [
      ...(context.businessContext?.goals ?? []),
      ...(context.businessContext?.processes ?? []),
      ...(context.businessContext?.painPoints ?? []),
    ].join(" ");
    const legacyMatches = matchesKeywords(legacyText, [
      "workflow",
      "approval process",
      "automat",
      "manual process",
      "hand-off",
      "handoff",
    ]);
    assert.equal(legacyMatches, false, "fixture must not contain any legacy keyword — that's the point of this test");

    const assessment = assessWorkflowAutomation(context);
    assert.equal(assessment.status, "recommended");
    assert.equal(assessment.method, "structured");
  });
});

describe("Explainability", () => {
  test("every reason on a recommended assessment cites at least one evidence reference", async () => {
    const context = await makeContext(appointmentMarkdown);
    const assessment = assessWorkflowAutomation(context);
    assert.equal(assessment.status, "recommended");
    assert.ok(assessment.reasons.length > 0);
    for (const reason of assessment.reasons) {
      assert.ok(reason.evidenceRefs.length > 0, `reason "${reason.code}" has no evidence`);
    }
  });
});

describe("Referential integrity", () => {
  test("every EvidenceReference points at a real DiscoveryResult entity", async () => {
    const context = await makeContext(appointmentMarkdown);
    const assessment = assessWorkflowAutomation(context);
    const knownIds = collectAllEntityIds(context.discoveryResult!);

    for (const reason of assessment.reasons) {
      for (const ref of reason.evidenceRefs) {
        assert.ok(knownIds.has(ref.entityId), `evidenceRef ${ref.entityType}/${ref.entityId} does not exist`);
      }
    }
  });
});

describe("Derived requirement traceability", () => {
  test("a requirement derived from a DesiredOutcome retains a derived-from link back to it", async () => {
    const context = await makeContext(appointmentMarkdown);
    const discovery = context.discoveryResult!;
    const derivedReq = discovery.requirements.find((r) => r.relatedOutcomeIds.length > 0);
    assert.ok(derivedReq, "expected at least one derived requirement in the appointment-business example");

    const outcomeId = derivedReq!.relatedOutcomeIds[0];
    const link = discovery.traceability.find(
      (l) => l.fromId === derivedReq!.id && l.toId === outcomeId && l.relationship === "derived-from"
    );
    assert.ok(link, `expected a derived-from link ${derivedReq!.id} -> ${outcomeId}`);
  });
});

describe("Legacy compatibility", () => {
  test("the last unmigrated capability (website) still works via legacyKeywordAssessment", async () => {
    const context = await makeContext(appointmentMarkdown);
    assert.equal(websiteCapability.assess, undefined);

    const assessment = assessCapability(websiteCapability, context);
    assert.equal(assessment.method, "legacy-keyword");
    assert.equal(assessment.status === "recommended", websiteCapability.supports(context));

    const direct = legacyKeywordAssessment(websiteCapability, context);
    assert.equal(direct.status, assessment.status);
  });
});

describe("Website compatibility", () => {
  test("website capability is untouched — no assess(), legacy-keyword wrapping still works", async () => {
    const context = await makeContext(appointmentMarkdown);
    assert.equal(websiteCapability.assess, undefined);
    assert.equal(websiteCapability.supports(context), true);

    const assessment = assessCapability(websiteCapability, context);
    assert.equal(assessment.method, "legacy-keyword");
    assert.equal(assessment.status, "recommended");
  });
});

describe("No false positive", () => {
  test("a project with no structured automation signals is not recommended", async () => {
    const context = await makeContext("# Project: Empty Co\n\n## Goals\n- Grow revenue\n");
    const assessment = assessWorkflowAutomation(context);
    assert.equal(assessment.status, "not-recommended");
    assert.equal(assessment.confidence, "high");

    const plan = buildSolutionPlan([assessment], context.discoveryResult!);
    assert.ok(!plan.selectedCapabilities.includes("workflow-automation"));
  });
});

describe("HITL", () => {
  test("the appointment example retains human approval for scheduling conflicts", async () => {
    const context = await makeContext(appointmentMarkdown);
    const assessment = assessWorkflowAutomation(context);
    const plan = buildWorkflowAutomationPlan(context, assessment);

    assert.ok(plan.humanTouchpoints.length > 0);
    const conflictTouchpoint = plan.humanTouchpoints.find((t) => /conflict/i.test(t.trigger));
    assert.ok(conflictTouchpoint, "expected a human touchpoint referencing the scheduling-conflict outcome");
    assert.equal(conflictTouchpoint!.approval.decision, "pending");
    assert.equal(conflictTouchpoint!.approval.approvalRequired, true);
  });
});
