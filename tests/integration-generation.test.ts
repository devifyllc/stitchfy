/**
 * Deterministic coverage for Phase 4 integration architecture generation.
 * Uses Node's built-in test runner, same as the other test files. Run with
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

import { assessWorkflowAutomation } from "../framework/capabilities/workflow-automation/workflow-automation.assessor.js";
import { buildWorkflowAutomationPlan } from "../framework/capabilities/workflow-automation/workflow-automation.planner.js";
import { buildWorkflowDefinitions } from "../framework/capabilities/workflow-automation/generators/workflow-definition.generator.js";
import type { WorkflowDefinition } from "../framework/capabilities/workflow-automation/schemas/workflow-automation.types.js";

import { assessIntegrations } from "../framework/capabilities/integrations/integrations.assessor.js";
import { buildIntegrationPlan } from "../framework/capabilities/integrations/integrations.planner.js";
import { buildIntegrationDefinitions } from "../framework/capabilities/integrations/generators/integration-definition.generator.js";
import { buildIntegrationArtifacts } from "../framework/capabilities/integrations/generators/integration-artifact.generator.js";
import {
  validateIntegrationDefinition,
  detectDuplicateIntegrations,
} from "../framework/capabilities/integrations/validators/integration-definition.validator.js";
import type { IntegrationDefinition } from "../framework/capabilities/integrations/schemas/integrations.types.js";
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

async function generateWorkflows(context: SolutionContext): Promise<WorkflowDefinition[]> {
  const wfAssessment = assessWorkflowAutomation(context);
  const wfPlan = buildWorkflowAutomationPlan(context, wfAssessment);
  return buildWorkflowDefinitions(context, wfPlan);
}

async function generateIntegrations(markdown: string, includeWorkflows = true) {
  const context = await makeContext(markdown);
  const assessment = assessIntegrations(context);
  const plan = buildIntegrationPlan(context, assessment);
  const workflows = includeWorkflows ? await generateWorkflows(context) : [];
  const integrations = buildIntegrationDefinitions(context.discoveryResult!, plan.candidates, workflows);
  return { context, assessment, plan, workflows, integrations };
}

function collectAllEntityIds(result: DiscoveryResult): Set<string> {
  const ids = new Set<string>();
  for (const arr of [
    result.goals, result.painPoints, result.desiredOutcomes, result.actors, result.processes,
    result.requirements, result.systems, result.integrationNeeds, result.dataEntities,
    result.constraints, result.businessRules, result.informationGaps,
  ] as Array<Array<{ id: string }>>) {
    for (const item of arr) ids.add(item.id);
  }
  return ids;
}

const appointmentMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/appointment-business.md"), "utf-8");
const invoiceMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/invoice-approval.md"), "utf-8");
const apiMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/api-integration.md"), "utf-8");

describe("Structured capability selection", () => {
  test("selects based on structured system/workflow evidence, not keywords", async () => {
    const { assessment } = await generateIntegrations(appointmentMarkdown);
    assert.equal(assessment.method, "structured");
    assert.ok(assessment.status === "recommended" || assessment.status === "needs-review");
    assert.ok(assessment.relatedSystemIds.length > 0);
  });
});

describe("No raw keyword dependency", () => {
  const markdown = `# Project: Test Co

## Business Processes

Data Sync Process

Actors:
Operator

Current systems:
System Alpha
System Beta

Steps:
1. Operator checks System Alpha
2. Operator updates System Beta
`;

  test("stays selected purely from a multi-system process, no 'integration'/'API'/'connect' anywhere", async () => {
    assert.ok(!/integration|\bAPI\b|connect/i.test(markdown));
    const { assessment } = await generateIntegrations(markdown, false);
    assert.notEqual(assessment.status, "not-recommended");
  });
});

describe("Deduplication", () => {
  const markdown = `# Project: Test Co

## Existing Systems
- Google Calendar

## Integrations
- Synchronize calendar with Google Calendar
- Google Calendar synchronization for appointments
`;

  test("multiple evidence sources describing one logical integration produce one IntegrationDefinition", async () => {
    const { plan, integrations } = await generateIntegrations(markdown, false);
    assert.equal(plan.candidates.length, 1);
    assert.equal(plan.candidates[0].sourceIntegrationNeedIds.length, 2);
    assert.equal(integrations.length, 1);
  });
});

describe("Unknown mechanism", () => {
  test("Google Calendar synchronization without protocol information stays interactionPattern: unknown", async () => {
    const { integrations } = await generateIntegrations(appointmentMarkdown);
    const calendarIntegration = integrations.find((i) => i.purpose.toLowerCase().includes("calendar"));
    assert.ok(calendarIntegration);
    assert.equal(calendarIntegration!.interactionPattern, "unknown");
    assert.equal(calendarIntegration!.protocol, "unknown");
  });
});

describe("Unknown authentication", () => {
  test("no auth information produces authentication.mechanism: unknown", async () => {
    const { integrations } = await generateIntegrations(appointmentMarkdown);
    for (const integration of integrations) {
      assert.equal(integration.authentication?.mechanism, "unknown");
    }
  });
});

describe("No fabricated API", () => {
  test("appointment example receives no invented HTTP methods, endpoints, or base URLs", async () => {
    const { integrations } = await generateIntegrations(appointmentMarkdown);
    for (const integration of integrations) {
      assert.equal(integration.restContract, undefined);
      assert.equal(integration.webhookContract, undefined);
    }
  });
});

describe("Explicit REST", () => {
  test("the API example preserves the explicitly provided method/path/protocol/auth", async () => {
    const { integrations } = await generateIntegrations(apiMarkdown);
    assert.equal(integrations.length, 1);
    const integration = integrations[0];

    assert.equal(integration.protocol, "https");
    assert.equal(integration.authentication?.mechanism, "api-key");
    assert.ok(integration.restContract);
    assert.equal(integration.restContract!.operations[0].method, "POST");
    assert.equal(integration.restContract!.operations[0].path, "/v1/orders");
    assert.equal(integration.restContract!.baseUrl, undefined);
    assert.equal(integration.status, "complete");
  });
});

describe("Referential integrity", () => {
  test("all system/workflow/process/requirement references resolve", async () => {
    for (const markdown of [appointmentMarkdown, invoiceMarkdown, apiMarkdown]) {
      const { context, integrations, workflows } = await generateIntegrations(markdown);
      for (const integration of integrations) {
        const result = validateIntegrationDefinition(integration, context.discoveryResult!, workflows.map((w) => w.id));
        assert.deepEqual(result.issues.filter((i) => i.severity === "error"), [], `${integration.id}: ${JSON.stringify(result.issues)}`);
      }
    }
  });
});

describe("Data contract integrity", () => {
  test("data contract fields are only what the source explicitly stated, and operations only reference real contracts", async () => {
    const { integrations } = await generateIntegrations(apiMarkdown);
    const integration = integrations[0];
    const responseContract = integration.dataContracts.find((c) => c.direction === "response");
    assert.ok(responseContract);
    assert.deepEqual(
      responseContract!.fields.map((f) => f.name),
      ["Order identifier", "accepted status"]
    );
    for (const field of responseContract!.fields) {
      assert.equal(field.type, undefined);
      assert.equal(field.required, undefined);
    }

    const contractIds = new Set(integration.dataContracts.map((c) => c.id));
    for (const op of integration.operations) {
      if (op.requestContractId) assert.ok(contractIds.has(op.requestContractId));
      if (op.responseContractId) assert.ok(contractIds.has(op.responseContractId));
    }
  });
});

describe("Information gaps", () => {
  test("missing protocol/auth/data-contract details create appropriate gaps", async () => {
    const { integrations } = await generateIntegrations(appointmentMarkdown);
    const calendarIntegration = integrations.find((i) => i.purpose.toLowerCase().includes("calendar"))!;
    const topics = calendarIntegration.informationGaps.map((g) => g.topic);
    assert.ok(topics.includes("Integration source system"));
    assert.ok(topics.includes("Integration protocol"));
    assert.ok(topics.includes("Integration authentication"));
    for (const gap of calendarIntegration.informationGaps) {
      assert.equal(gap.blocking, false);
    }
  });
});

describe("Workflow cross-reference", () => {
  test("IntegrationDefinition references the workflow that created the external-system dependency", async () => {
    const { workflows, integrations } = await generateIntegrations(appointmentMarkdown);
    const calendarIntegration = integrations.find((i) => i.purpose.toLowerCase().includes("calendar"))!;
    assert.ok(calendarIntegration.relatedWorkflowIds.length > 0);
    assert.ok(workflows.some((w) => calendarIntegration.relatedWorkflowIds.includes(w.id)));
  });
});

describe("Traceability", () => {
  test("evidence refs point to real Discovery entities", async () => {
    const { context, integrations } = await generateIntegrations(appointmentMarkdown);
    const knownIds = collectAllEntityIds(context.discoveryResult!);
    for (const integration of integrations) {
      assert.ok(integration.evidenceRefs.length > 0);
      for (const ref of [...integration.evidenceRefs, ...integration.operations.flatMap((o) => o.evidenceRefs)]) {
        assert.ok(knownIds.has(ref.entityId), `${ref.entityType}/${ref.entityId} not found`);
      }
    }
  });
});

describe("Duplicate detection", () => {
  test("validator detects duplicate integration definitions", async () => {
    const { integrations } = await generateIntegrations(appointmentMarkdown);
    const original = integrations[0];
    const duplicate: IntegrationDefinition = { ...original, id: "INT-DUP" };

    const issues = detectDuplicateIntegrations([original, duplicate]);
    assert.ok(issues.some((i) => i.code === "duplicate-integration"));
  });
});

describe("Same-system boundary", () => {
  test("validator rejects source and target being the same known system", async () => {
    const { context, integrations } = await generateIntegrations(appointmentMarkdown);
    const original = integrations[0];
    const mutated: IntegrationDefinition = { ...original, sourceSystemId: original.targetSystemId };

    const result = validateIntegrationDefinition(mutated, context.discoveryResult!);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "same-system-boundary"));
  });
});

describe("Artifacts", () => {
  test("JSON and Markdown come from the same IntegrationDefinition", async () => {
    const { context, integrations } = await generateIntegrations(apiMarkdown);
    const integration = integrations[0];
    const artifacts = buildIntegrationArtifacts(integration, context.discoveryResult!);

    const json = artifacts.find((a) => a.path?.endsWith(".integration.json"));
    const md = artifacts.find((a) => a.path?.endsWith(".integration.md"));
    const openapi = artifacts.find((a) => a.path?.endsWith(".openapi.json"));
    assert.ok(json && md && openapi, "expected JSON + Markdown + OpenAPI artifacts for the explicit REST example");

    const parsed = JSON.parse(json!.content as string);
    assert.equal(parsed.id, integration.id);

    const mdContent = md!.content as string;
    for (const heading of ["Purpose", "Source System", "Target System", "Related Workflow", "Operations", "Interaction Pattern", "Data Exchanged", "Authentication", "Reliability", "Error Handling", "Security Considerations", "Information Gaps", "Traceability"]) {
      assert.ok(mdContent.includes(`## ${heading}`), `missing section: ${heading}`);
    }
  });
});

describe("Backward compatibility", () => {
  test("website capability is unaffected by integration generation changes", async () => {
    const context = await makeContext(appointmentMarkdown);
    assert.equal(websiteCapability.assess, undefined);
    assert.equal(websiteCapability.supports(context), true);
  });
});
