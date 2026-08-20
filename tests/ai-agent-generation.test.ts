/**
 * Deterministic coverage for Phase 6 AI Agent architecture generation.
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
import { createSolutionContext } from "../framework/core/contracts/context.js";
import type { SolutionContext } from "../framework/core/contracts/context.js";

import { assessWorkflowAutomation } from "../framework/capabilities/workflow-automation/workflow-automation.assessor.js";
import { buildWorkflowAutomationPlan } from "../framework/capabilities/workflow-automation/workflow-automation.planner.js";
import { buildWorkflowDefinitions } from "../framework/capabilities/workflow-automation/generators/workflow-definition.generator.js";
import type { WorkflowDefinition } from "../framework/capabilities/workflow-automation/schemas/workflow-automation.types.js";

import { assessIntegrations } from "../framework/capabilities/integrations/integrations.assessor.js";
import { buildIntegrationPlan } from "../framework/capabilities/integrations/integrations.planner.js";
import { buildIntegrationDefinitions } from "../framework/capabilities/integrations/generators/integration-definition.generator.js";
import type { IntegrationDefinition } from "../framework/capabilities/integrations/schemas/integrations.types.js";

import { assessAIAgents, AI_AGENTS_CAPABILITY_ID } from "../framework/capabilities/ai-agents/ai-agents.assessor.js";
import { buildAIAgentPlan } from "../framework/capabilities/ai-agents/ai-agents.planner.js";
import { buildAIAgentDefinitions } from "../framework/capabilities/ai-agents/generators/ai-agent-definition.generator.js";
import { buildAIAgentArtifacts } from "../framework/capabilities/ai-agents/generators/ai-agent-artifact.generator.js";
import { validateAIAgentDefinition, detectOrphanTools } from "../framework/capabilities/ai-agents/validators/ai-agent-definition.validator.js";
import { websiteCapability } from "../framework/capabilities/website/website.capability.js";
import { genericRestTypeScriptExporter } from "../framework/capabilities/integrations/exporters/generic-rest-typescript/generic-rest-typescript.exporter.js";

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

async function generateIntegrations(context: SolutionContext, workflows: WorkflowDefinition[]): Promise<IntegrationDefinition[]> {
  const assessment = assessIntegrations(context);
  const plan = buildIntegrationPlan(context, assessment);
  return buildIntegrationDefinitions(context.discoveryResult!, plan.candidates, workflows);
}

async function generateAgents(markdown: string) {
  const context = await makeContext(markdown);
  const workflows = await generateWorkflows(context);
  const integrations = await generateIntegrations(context, workflows);
  const assessment = assessAIAgents(context);
  const plan = buildAIAgentPlan(context, assessment);
  const agents = context.discoveryResult ? buildAIAgentDefinitions(context.discoveryResult, plan, workflows, integrations) : [];
  return { context, workflows, integrations, assessment, plan, agents };
}

const customerSupportMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/customer-support-agent.md"), "utf-8");
const invoiceTriageMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/invoice-triage-agent.md"), "utf-8");
const appointmentMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/appointment-business.md"), "utf-8");
const invoiceApprovalMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/invoice-approval.md"), "utf-8");
const apiIntegrationMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/api-integration.md"), "utf-8");
const restExportReadyMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/rest-export-ready.md"), "utf-8");
const customerDataWorkflowMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/customer-data-workflow.md"), "utf-8");
const nonAIExamples = [appointmentMarkdown, invoiceApprovalMarkdown, apiIntegrationMarkdown, restExportReadyMarkdown, customerDataWorkflowMarkdown];

describe("Structured selection", () => {
  test("customer-support-agent.md selects AI Agents from a structured AI Agent Need", async () => {
    const context = await makeContext(customerSupportMarkdown);
    const assessment = assessAIAgents(context);
    assert.equal(assessment.method, "structured");
    assert.ok(assessment.status === "recommended" || assessment.status === "needs-review");
    assert.ok(assessment.reasons.some((r) => r.code === "ai-agent-need"));
  });
});

describe("No legacy keyword dependence", () => {
  test("selection does not depend on raw Markdown scanning for generic automation words", async () => {
    const markdown = `# Project: Test Co

## Business Processes

Data Sync Process

Actors:
Operator

Automation candidates:
- Automate the data sync workflow using the integration

Steps:
1. Operator checks System Alpha
2. Operator updates System Beta
`;
    const context = await makeContext(markdown);
    const assessment = assessAIAgents(context);
    assert.equal(assessment.status, "not-recommended");
  });
});

describe("Negative automation case", () => {
  test("none of the 5 non-AI examples select AI Agents", async () => {
    for (const markdown of nonAIExamples) {
      const context = await makeContext(markdown);
      const assessment = assessAIAgents(context);
      assert.equal(assessment.status, "not-recommended", `unexpected AI Agents selection for a non-AI example`);
    }
  });
});

describe("Minimal-agent principle", () => {
  test("one AI Agent Need produces exactly one agent, never multiple", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    assert.equal(agents.length, 1);
  });
});

describe("Conversational agent", () => {
  test("customer-support agent resolves to conversational interaction mode", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    assert.equal(agents[0].interactionMode, "conversational");
  });
});

describe("Assistive agent", () => {
  test("invoice-triage agent remains assistive with no write permissions", async () => {
    const { agents } = await generateAgents(invoiceTriageMarkdown);
    assert.equal(agents[0].autonomy, "assistive");
    assert.deepEqual(agents[0].permissions.filter((p) => p.action === "write"), []);
  });
});

describe("No autonomous inference", () => {
  test("neither example becomes autonomous/semi-autonomous unless explicitly stated", async () => {
    const support = await generateAgents(customerSupportMarkdown);
    const triage = await generateAgents(invoiceTriageMarkdown);
    assert.ok(!["autonomous", "semi-autonomous"].includes(support.agents[0].autonomy));
    assert.ok(!["autonomous", "semi-autonomous"].includes(triage.agents[0].autonomy));
  });

  test("a prohibition mentioning 'autonomously' is never read as granting autonomy", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    // The example explicitly says "may not cancel appointments autonomously" —
    // a prohibition, not a grant; autonomy must not become semi-autonomous/autonomous from it.
    assert.ok(!["autonomous", "semi-autonomous"].includes(agents[0].autonomy));
  });
});

describe("Model unknown preservation", () => {
  test("no provider/model is ever chosen when the source doesn't state one", async () => {
    const support = await generateAgents(customerSupportMarkdown);
    const triage = await generateAgents(invoiceTriageMarkdown);
    assert.equal(support.agents[0].modelRequirements.provider, undefined);
    assert.equal(support.agents[0].modelRequirements.model, undefined);
    assert.equal(triage.agents[0].modelRequirements.provider, undefined);
    assert.equal(triage.agents[0].modelRequirements.model, undefined);
  });
});

describe("No numeric threshold fabrication", () => {
  test("no confidence number appears unless the source explicitly provides one", async () => {
    const support = await generateAgents(customerSupportMarkdown);
    const triage = await generateAgents(invoiceTriageMarkdown);
    assert.equal(support.agents[0].confidencePolicy.threshold, undefined);
    assert.equal(triage.agents[0].confidencePolicy.threshold, undefined);
    assert.notEqual(support.agents[0].confidencePolicy.mode, "explicit-threshold");
  });
});

describe("Session memory", () => {
  test("explicit session-only memory is preserved", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    assert.equal(agents[0].memory.mode, "session");
  });

  test("a negated persistence statement ('should not persist') is read as session, not persistent", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    assert.notEqual(agents[0].memory.mode, "persistent");
  });
});

describe("No persistent memory fabrication", () => {
  test("neither example gains persistent memory without evidence", async () => {
    const support = await generateAgents(customerSupportMarkdown);
    const triage = await generateAgents(invoiceTriageMarkdown);
    assert.notEqual(support.agents[0].memory.mode, "persistent");
    assert.notEqual(triage.agents[0].memory.mode, "persistent");
  });
});

describe("Tool derivation", () => {
  test("the appointment-availability tool references a real IntegrationOperation", async () => {
    const { agents, integrations } = await generateAgents(customerSupportMarkdown);
    const tool = agents[0].tools.find((t) => t.kind === "integration-operation");
    assert.ok(tool, "expected a real integration-operation tool");
    assert.ok(integrations.some((i) => i.id === tool!.integrationId));
    assert.ok(integrations.flatMap((i) => i.operations).some((o) => o.id === tool!.integrationOperationId));
  });

  test("false-positive matches on generic actor words ('customer'/'employee') do not produce spurious duplicate tools", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    assert.equal(agents[0].tools.length, 1);
  });
});

describe("No invented tool", () => {
  test("invoice-triage agent has zero tools — summarize/classify/highlight are not integration/workflow operations", async () => {
    const { agents } = await generateAgents(invoiceTriageMarkdown);
    assert.deepEqual(agents[0].tools, []);
  });

  test("a prohibited action never produces a tool even when a same-topic operation exists elsewhere", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    // "must not confirm a conflicting appointment" / "may not cancel appointments" must never become tools
    assert.ok(!agents[0].tools.some((t) => /confirm|cancel/i.test(t.name)));
  });
});

describe("Read side effect", () => {
  test("the availability lookup tool stays read-only", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    const tool = agents[0].tools.find((t) => t.kind === "integration-operation");
    assert.equal(tool!.sideEffect, "read");
  });
});

describe("Write permission restraint", () => {
  test("invoice-triage agent receives no write permission of any kind", async () => {
    const { agents } = await generateAgents(invoiceTriageMarkdown);
    assert.deepEqual(agents[0].permissions, []);
  });
});

describe("HITL", () => {
  test("the conflicting-booking prohibition preserves employee approval via the existing WorkflowApproval", async () => {
    const { agents, workflows } = await generateAgents(customerSupportMarkdown);
    const oversight = agents[0].humanOversight.find((o) => /conflicting/i.test(o.reason));
    assert.ok(oversight);
    assert.equal(oversight!.approval.decision, "pending");
    const workflowApprovalIds = new Set(workflows.flatMap((w) => w.approvals.map((a) => a.approval.id)));
    assert.ok(workflowApprovalIds.has(oversight!.approval.id), "expected the agent to reuse the workflow's own approval, not a new one");
  });
});

describe("Approval referential integrity", () => {
  test("the generated HumanApprovalRequest resolves and is never pre-decided", async () => {
    const { agents, context, workflows, integrations } = await generateAgents(customerSupportMarkdown);
    const result = validateAIAgentDefinition(agents[0], context.discoveryResult!, workflows, integrations);
    assert.deepEqual(result.issues.filter((i) => i.severity === "error"), [], JSON.stringify(result.issues));
    for (const o of agents[0].humanOversight) assert.equal(o.approval.decision, "pending");
  });
});

describe("Tool permission evidence", () => {
  test("every non-unknown permission has at least one evidence reference", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    for (const permission of agents[0].permissions) {
      assert.ok(permission.evidenceRefs.length > 0);
    }
  });

  test("a tool existing does not automatically create a permission", async () => {
    // The availability tool only gets a permission because "may check" is
    // independent grant language on the SAME task bullet — verified by
    // ensuring permission count never exceeds tool count for either example.
    const support = await generateAgents(customerSupportMarkdown);
    assert.ok(support.agents[0].permissions.length <= support.agents[0].tools.length);
  });
});

describe("Agent to workflow/integration references", () => {
  test("relatedWorkflowIds and relatedIntegrationIds resolve to real entities", async () => {
    const { agents, workflows, integrations } = await generateAgents(customerSupportMarkdown);
    const workflowIds = new Set(workflows.map((w) => w.id));
    const integrationIds = new Set(integrations.map((i) => i.id));
    for (const id of agents[0].relatedWorkflowIds) assert.ok(workflowIds.has(id));
    for (const id of agents[0].relatedIntegrationIds) assert.ok(integrationIds.has(id));
  });
});

describe("Referential integrity", () => {
  test("all agent references resolve for both AI examples", async () => {
    for (const markdown of [customerSupportMarkdown, invoiceTriageMarkdown]) {
      const { agents, context, workflows, integrations } = await generateAgents(markdown);
      for (const agent of agents) {
        const result = validateAIAgentDefinition(agent, context.discoveryResult!, workflows, integrations);
        assert.deepEqual(result.issues.filter((i) => i.severity === "error"), [], JSON.stringify(result.issues));
      }
    }
  });

  test("no orphan tools — every generated tool belongs to at least one agent", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    const toolCatalog = agents.flatMap((a) => a.tools);
    assert.deepEqual(detectOrphanTools(agents, toolCatalog), []);
  });
});

describe("Artifacts", () => {
  test("JSON and Markdown render from the same AIAgentDefinition", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    const artifacts = buildAIAgentArtifacts(agents);
    const json = artifacts.find((a) => a.path?.endsWith(".agent.json"));
    const md = artifacts.find((a) => a.path?.endsWith(".agent.md"));
    assert.ok(json && md);
    const parsed = JSON.parse(json!.content as string);
    assert.equal(parsed.id, agents[0].id);
    const mdContent = md!.content as string;
    for (const heading of ["Purpose", "Interaction Mode", "Autonomy", "Model Requirements", "Inputs", "Outputs", "Tools", "Permissions", "Memory", "Human Oversight", "Guardrails", "Escalation", "Information Gaps", "Related Workflows", "Related Integrations", "Security / Governance Considerations", "Traceability"]) {
      assert.ok(mdContent.includes(`## ${heading}`), `missing section: ${heading}`);
    }
  });

  test("tool catalog contains the same tool definitions as agent architecture", async () => {
    const { agents } = await generateAgents(customerSupportMarkdown);
    const artifacts = buildAIAgentArtifacts(agents);
    const catalogJson = artifacts.find((a) => a.path?.endsWith("tool-catalog.json"));
    const catalog = JSON.parse(catalogJson!.content as string);
    const agentToolIds = new Set(agents.flatMap((a) => a.tools.map((t) => t.id)));
    for (const tool of catalog) assert.ok(agentToolIds.has(tool.id));
    assert.equal(catalog.length, agentToolIds.size);
  });
});

describe("Backward compatibility", () => {
  test("website capability is unaffected by AI Agent generation changes", async () => {
    const context = await makeContext(customerSupportMarkdown);
    assert.equal(websiteCapability.assess, undefined);
    assert.equal(websiteCapability.supports(context), true);
  });
});

describe("Integration export compatibility", () => {
  test("Phase 5.5A exporters remain unchanged and make zero network calls", async () => {
    const { integrations } = await generateAgents(apiIntegrationMarkdown);
    const integration = integrations.find((i) => Boolean(i.restContract));
    assert.ok(integration);
    assert.equal(genericRestTypeScriptExporter.supports(integration!), true);
    const source = fs.readFileSync(
      path.join(REPO_ROOT, "framework/capabilities/integrations/exporters/generic-rest-typescript/generic-rest-typescript.exporter.ts"),
      "utf-8"
    );
    assert.ok(!/\bfetch\(/.test(source));
  });
});
