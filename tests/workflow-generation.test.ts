/**
 * Deterministic coverage for Phase 3 workflow specification generation.
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
import { buildWorkflowArtifacts } from "../framework/capabilities/workflow-automation/generators/workflow-artifact.generator.js";
import { validateWorkflowDefinition } from "../framework/capabilities/workflow-automation/validators/workflow-definition.validator.js";
import { websiteCapability } from "../framework/capabilities/website/website.capability.js";
import type { WorkflowDefinition } from "../framework/capabilities/workflow-automation/schemas/workflow-automation.types.js";

const REPO_ROOT = process.cwd();

async function makeContext(markdown: string): Promise<SolutionContext> {
  const parsed = parseMarkdown(markdown);
  const discoveryResult = await businessDiscoveryAgent.run({ parsed });
  const context = createSolutionContext("test.md", "test-output", markdown, parsed);
  context.discoveryResult = discoveryResult;
  context.businessContext = deriveBusinessContext(discoveryResult);
  return context;
}

async function generateWorkflows(markdown: string): Promise<{ context: SolutionContext; workflows: WorkflowDefinition[] }> {
  const context = await makeContext(markdown);
  const assessment = assessWorkflowAutomation(context);
  const plan = buildWorkflowAutomationPlan(context, assessment);
  const workflows = buildWorkflowDefinitions(context, plan);
  return { context, workflows };
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

describe("Basic workflow generation", () => {
  test("a relevant BusinessProcess produces one WorkflowDefinition", async () => {
    const { context, workflows } = await generateWorkflows(appointmentMarkdown);
    assert.equal(workflows.length, 1);
    const process = context.discoveryResult!.processes[0];
    assert.equal(workflows[0].processId, process.id);
  });
});

describe("Sequential transitions", () => {
  test("ordered business steps produce valid sequential transitions", async () => {
    const { workflows } = await generateWorkflows(invoiceMarkdown);
    const workflow = workflows[0];
    // The first 5 steps are the AS-IS process.steps, in order — verify each
    // is chained to the next before any synthesized decision steps appear.
    for (let i = 0; i < 4; i++) {
      const transition = workflow.transitions.find((t) => t.fromStepId === workflow.steps[i].id);
      assert.ok(transition, `expected a transition out of step ${i}`);
      assert.equal(transition!.toStepId, workflow.steps[i + 1].id);
    }
  });
});

describe("Traceability", () => {
  test("every generated step has valid evidence references", async () => {
    const { context, workflows } = await generateWorkflows(appointmentMarkdown);
    const knownIds = collectAllEntityIds(context.discoveryResult!);
    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        assert.ok(step.evidenceRefs.length > 0, `step "${step.id}" has no evidence`);
        for (const ref of step.evidenceRefs) {
          assert.ok(knownIds.has(ref.entityId), `step "${step.id}" cites unknown entity ${ref.entityType}/${ref.entityId}`);
        }
      }
    }
  });
});

describe("No invention", () => {
  const markdown = `# Project: Test Co

## Business Processes

Untriggered Process

Actors:
Worker

Current systems:
Tool

Steps:
1. Worker does something
2. Worker does something else

Automation candidates:
- Automate the something
`;

  test("missing trigger does not result in a fabricated HTTP/webhook trigger", async () => {
    const { workflows } = await generateWorkflows(markdown);
    assert.equal(workflows.length, 1);
    const workflow = workflows[0];
    assert.equal(workflow.triggers.length, 0);
    assert.ok(!workflow.triggers.some((t) => /http|webhook|kafka|cron|lambda/i.test(t.description)));
    assert.ok(workflow.informationGaps.some((g) => g.topic === "Process trigger"));
  });
});

describe("HITL", () => {
  test("appointment conflict handling preserves human oversight", async () => {
    const { workflows } = await generateWorkflows(appointmentMarkdown);
    const workflow = workflows[0];
    assert.ok(workflow.decisions.length > 0);
    assert.ok(workflow.approvals.length > 0);
    const approval = workflow.approvals[0];
    const targetStep = workflow.steps.find((s) => s.id === approval.stepId);
    assert.equal(targetStep?.type, "human-task");
    assert.equal(approval.approval.decision, "pending");
  });
});

describe("Approval referential integrity", () => {
  test("every approval references a valid workflow element", async () => {
    const { context, workflows } = await generateWorkflows(appointmentMarkdown);
    for (const workflow of workflows) {
      const validation = validateWorkflowDefinition(workflow, context.discoveryResult!);
      const approvalIssues = validation.issues.filter((i) => i.code.includes("approval"));
      assert.deepEqual(approvalIssues, []);
    }
  });
});

describe("External system references", () => {
  test("every referenced system exists in DiscoveryResult", async () => {
    const { context, workflows } = await generateWorkflows(invoiceMarkdown);
    const systemIds = new Set(context.discoveryResult!.systems.map((s) => s.id));
    for (const workflow of workflows) {
      assert.ok(workflow.externalSystems.length > 0);
      for (const es of workflow.externalSystems) {
        assert.ok(systemIds.has(es.systemId));
      }
    }
  });
});

describe("Orphan detection", () => {
  test("validator detects an unreachable generated step", async () => {
    const { context, workflows } = await generateWorkflows(appointmentMarkdown);
    const workflow = workflows[0];
    const orphanStep = { ...workflow.steps[0], id: "STEP-ORPHAN", name: "Orphan step" };
    const mutated: WorkflowDefinition = { ...workflow, steps: [...workflow.steps, orphanStep] };

    const validation = validateWorkflowDefinition(mutated, context.discoveryResult!);
    assert.ok(validation.issues.some((i) => i.code === "orphan-step" && i.message.includes("STEP-ORPHAN")));
  });
});

describe("Broken transition", () => {
  test("validator rejects transition references to nonexistent steps", async () => {
    const { context, workflows } = await generateWorkflows(appointmentMarkdown);
    const workflow = workflows[0];
    const mutated: WorkflowDefinition = {
      ...workflow,
      transitions: [...workflow.transitions, { id: "TRANS-BROKEN", fromStepId: workflow.steps[0].id, toStepId: "STEP-DOES-NOT-EXIST" }],
    };

    const validation = validateWorkflowDefinition(mutated, context.discoveryResult!);
    assert.equal(validation.ok, false);
    assert.ok(validation.issues.some((i) => i.code === "broken-transition"));
  });
});

describe("Multiple workflows", () => {
  const markdown = `# Project: Two Process Co

## Business Processes

Process One

Trigger:
Something starts process one

Actors:
Agent A

Current systems:
System A

Steps:
1. Agent A does step one
2. Agent A does step two

Automation candidates:
- Automate step one

Process Two

Trigger:
Something starts process two

Actors:
Agent B

Current systems:
System B

Steps:
1. Agent B does step one
2. Agent B does step two

Automation candidates:
- Automate step two
`;

  test("two relevant business processes produce two independent WorkflowDefinitions", async () => {
    const { workflows } = await generateWorkflows(markdown);
    assert.equal(workflows.length, 2);
    assert.notEqual(workflows[0].id, workflows[1].id);
    assert.notEqual(workflows[0].processId, workflows[1].processId);
  });
});

describe("AS-IS / TO-BE preservation", () => {
  test("the original business process remains identifiable separately from the generated proposal", async () => {
    const { context, workflows } = await generateWorkflows(appointmentMarkdown);
    const process = context.discoveryResult!.processes.find((p) => p.id === workflows[0].processId);
    assert.ok(process);
    // AS-IS: plain strings. TO-BE: typed WorkflowStep objects. Different shapes, same source order.
    assert.equal(typeof process!.steps[0], "string");
    assert.equal(typeof workflows[0].steps[0], "object");
    assert.equal(process!.steps.length > 0, true);
  });
});

describe("No false automation", () => {
  const markdown = `# Project: Test Co

## Business Processes

Manual Only Process

Trigger:
Something happens

Actors:
Reviewer

Current systems:
Filing Cabinet

Steps:
1. Reviewer manually files the paperwork by hand

Automation candidates:
- Digitize archival records
`;

  test("a manual step without matching automation evidence stays human, not auto-converted", async () => {
    const { workflows } = await generateWorkflows(markdown);
    const workflow = workflows[0];
    const step = workflow.steps.find((s) => s.description.includes("files the paperwork"));
    assert.ok(step);
    assert.equal(step!.type, "human-task");
  });
});

describe("Artifact generation", () => {
  test("workflow JSON and Markdown artifacts are generated from the same WorkflowDefinition", async () => {
    const { context, workflows } = await generateWorkflows(appointmentMarkdown);
    const artifacts = buildWorkflowArtifacts(workflows[0], context.discoveryResult!);
    assert.equal(artifacts.length, 2);

    const json = artifacts.find((a) => a.path?.endsWith(".workflow.json"));
    const md = artifacts.find((a) => a.path?.endsWith(".workflow.md"));
    assert.ok(json && md);

    const parsed = JSON.parse(json!.content as string);
    assert.equal(parsed.id, workflows[0].id);

    const mdContent = md!.content as string;
    for (const heading of ["Source Process", "Trigger", "Current Process", "Proposed Workflow", "Human Tasks", "Automated Tasks", "Decisions", "Approvals", "Notifications", "External Systems", "Information Gaps", "Traceability"]) {
      assert.ok(mdContent.includes(`## ${heading}`), `missing section: ${heading}`);
    }
  });
});

describe("Mermaid consistency", () => {
  test("every diagram node and edge corresponds to a real WorkflowDefinition element", async () => {
    const { context, workflows } = await generateWorkflows(appointmentMarkdown);
    const workflow = workflows[0];
    const artifacts = buildWorkflowArtifacts(workflow, context.discoveryResult!);
    const md = artifacts.find((a) => a.path?.endsWith(".workflow.md"))!.content as string;
    const mermaidBlock = md.split("```mermaid")[1].split("```")[0];

    const stepIdSet = new Set(workflow.steps.map((s) => s.id.replace(/-/g, "_")));
    const nodeDeclarations = [...mermaidBlock.matchAll(/^\s{4}(\S+?)[[{(]/gm)].map((m) => m[1]);
    for (const nodeId of nodeDeclarations) {
      assert.ok(stepIdSet.has(nodeId), `mermaid node "${nodeId}" has no corresponding step`);
    }

    const edgeRefs = [...mermaidBlock.matchAll(/(\S+)\s*-->/g)].map((m) => m[1]);
    for (const ref of edgeRefs) {
      assert.ok(stepIdSet.has(ref), `mermaid edge source "${ref}" has no corresponding step`);
    }
  });
});

describe("Backward compatibility", () => {
  test("website capability is unaffected by workflow generation changes", async () => {
    const context = await makeContext(appointmentMarkdown);
    assert.equal(websiteCapability.assess, undefined);
    assert.equal(websiteCapability.supports(context), true);
  });
});
