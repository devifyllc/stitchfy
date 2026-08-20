/**
 * Deterministic coverage for Phase 7A Observability and Operational
 * Architecture generation. Uses Node's built-in test runner, same as the
 * other test files. Run with `npm run test`.
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

import { assessAIAgents } from "../framework/capabilities/ai-agents/ai-agents.assessor.js";
import { buildAIAgentPlan } from "../framework/capabilities/ai-agents/ai-agents.planner.js";
import { buildAIAgentDefinitions } from "../framework/capabilities/ai-agents/generators/ai-agent-definition.generator.js";
import type { AIAgentDefinition } from "../framework/capabilities/ai-agents/schemas/ai-agents.types.js";

import { buildSecurityArchitecture } from "../framework/capabilities/security-governance/generators/security-architecture.generator.js";
import { buildGovernancePlan } from "../framework/capabilities/security-governance/generators/governance-plan.generator.js";
import { buildAIAgentSecurityRequirements } from "../framework/capabilities/security-governance/generators/ai-agent-security.generator.js";
import type { SecurityArchitecture, GovernancePlan } from "../framework/capabilities/security-governance/schemas/security-governance.types.js";

import { assessObservability, OBSERVABILITY_CAPABILITY_ID } from "../framework/capabilities/observability/observability.assessor.js";
import { buildObservabilityPlan } from "../framework/capabilities/observability/observability.planner.js";
import { buildObservabilityArchitecture } from "../framework/capabilities/observability/generators/observability-architecture.generator.js";
import { buildObservabilityArtifacts } from "../framework/capabilities/observability/generators/observability-artifact.generator.js";
import { validateObservabilityArchitecture } from "../framework/capabilities/observability/validators/observability.validator.js";
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

async function generateAgents(context: SolutionContext, workflows: WorkflowDefinition[], integrations: IntegrationDefinition[]): Promise<AIAgentDefinition[]> {
  const assessment = assessAIAgents(context);
  const plan = buildAIAgentPlan(context, assessment);
  return buildAIAgentDefinitions(context.discoveryResult!, plan, workflows, integrations);
}

function generateSecurityGovernance(
  context: SolutionContext,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[],
  agents: AIAgentDefinition[]
): { security: SecurityArchitecture; governance: GovernancePlan } {
  const security = buildSecurityArchitecture(context.discoveryResult!, workflows, integrations);
  const governance = buildGovernancePlan(context.discoveryResult!, workflows, security);
  if (agents.length > 0) {
    const agentSecurity = buildAIAgentSecurityRequirements(agents);
    security.requirements.push(...agentSecurity.requirements);
    security.risks.push(...agentSecurity.risks);
    security.informationGaps.push(...agentSecurity.informationGaps);
  }
  return { security, governance };
}

async function generateObservability(markdown: string) {
  const context = await makeContext(markdown);
  const workflows = await generateWorkflows(context);
  const integrations = await generateIntegrations(context, workflows);
  const agents = await generateAgents(context, workflows, integrations);
  const { security, governance } = generateSecurityGovernance(context, workflows, integrations, agents);
  const assessment = assessObservability(context);
  const plan = buildObservabilityPlan(context, assessment);
  const architecture = buildObservabilityArchitecture(context.discoveryResult!, workflows, integrations, agents, security, governance);
  return { context, workflows, integrations, agents, security, governance, assessment, plan, architecture };
}

const appointmentMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/appointment-business.md"), "utf-8");
const invoiceApprovalMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/invoice-approval.md"), "utf-8");
const apiIntegrationMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/api-integration.md"), "utf-8");
const restExportReadyMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/rest-export-ready.md"), "utf-8");
const customerSupportMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/customer-support-agent.md"), "utf-8");
const invoiceTriageMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/invoice-triage-agent.md"), "utf-8");
const operationalMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/operational-order-processing.md"), "utf-8");

describe("Structured selection", () => {
  test("workflow/integration/AI architecture causes selection without the literal word 'observability'", async () => {
    assert.ok(!/\bobservability\b/i.test(appointmentMarkdown));
    const context = await makeContext(appointmentMarkdown);
    const assessment = assessObservability(context);
    assert.equal(assessment.method, "structured");
    assert.ok(assessment.status === "recommended" || assessment.status === "needs-review");
  });
});

describe("Static website restraint", () => {
  test("a plain static-website-only scenario does not select observability", async () => {
    const markdown = `# Project: Simple Co

## Business
- **Business Name:** Simple Co
- **Industry:** Local services

## Goals
- Have an informational website

## Users
- Visitors
`;
    const context = await makeContext(markdown);
    const assessment = assessObservability(context);
    assert.equal(assessment.status, "not-recommended");
  });
});

describe("Workflow signals", () => {
  test("workflow start/outcome observability is generated", async () => {
    const { architecture, workflows } = await generateObservability(appointmentMarkdown);
    for (const workflow of workflows) {
      for (const outcome of ["started", "completed", "failed"]) {
        assert.ok(architecture.signals.some((s) => s.name === `${workflow.name} ${outcome}`));
      }
    }
  });
});

describe("Decision visibility", () => {
  test("a real workflow decision generates decision-result visibility", async () => {
    const { architecture, workflows } = await generateObservability(invoiceApprovalMarkdown);
    assert.ok(workflows[0].decisions.length > 0);
    assert.ok(architecture.signals.some((s) => s.name.startsWith("Decision evaluated:")));
  });
});

describe("Approval visibility", () => {
  test("a real approval generates audit/operational visibility", async () => {
    const { architecture, security } = await generateObservability(invoiceApprovalMarkdown);
    assert.ok(architecture.signals.some((s) => s.name.startsWith("Approval requested:")));
    assert.ok(architecture.signals.some((s) => s.name.startsWith("Approval completed:")));
    assert.ok(security.auditRequirements.length > 0);
    assert.ok(architecture.auditMappings.length > 0);
  });
});

describe("Integration signals", () => {
  test("a real IntegrationOperation generates attempt/outcome signals", async () => {
    const { architecture, integrations } = await generateObservability(apiIntegrationMarkdown);
    const op = integrations[0].operations[0];
    for (const outcome of ["attempted", "succeeded", "failed"]) {
      assert.ok(architecture.signals.some((s) => s.name === `${op.name} ${outcome}`));
    }
  });
});

describe("Integration duration", () => {
  test("operation duration is recommended without inventing a latency target", async () => {
    const { architecture } = await generateObservability(apiIntegrationMarkdown);
    const duration = architecture.metricRequirements.find((m) => m.kind === "timer");
    assert.ok(duration);
    assert.equal(duration!.unit, undefined);
  });
});

describe("No HTTP fabrication", () => {
  test("an unknown integration protocol produces no HTTP-specific telemetry", async () => {
    const { architecture, integrations } = await generateObservability(appointmentMarkdown);
    const calendarIntegration = integrations.find((i) => i.purpose.toLowerCase().includes("calendar"));
    assert.equal(calendarIntegration!.restContract, undefined);
    const calendarSignals = architecture.signals.filter((s) => s.source.entityType === "integration" && s.source.entityId === calendarIntegration!.id);
    for (const s of calendarSignals) {
      assert.ok(!s.attributes.some((a) => a.name === "httpMethod" || a.name === "httpPath"));
    }
  });
});

describe("Explicit REST", () => {
  test("REST integration may have HTTP-specific operation context only where Phase 4 knows REST", async () => {
    const { architecture, integrations } = await generateObservability(apiIntegrationMarkdown);
    assert.ok(integrations[0].restContract);
    const outcomeSignals = architecture.signals.filter(
      (s) => s.source.entityType === "integration" && s.source.entityId === integrations[0].id && s.name.endsWith("succeeded")
    );
    assert.ok(outcomeSignals.some((s) => s.attributes.some((a) => a.name === "httpMethod")));
  });
});

describe("AI tool visibility", () => {
  test("a real AI tool generates tool-invocation visibility", async () => {
    const { architecture, agents } = await generateObservability(customerSupportMarkdown);
    assert.ok(agents[0].tools.length > 0);
    for (const outcome of ["requested", "completed", "failed"]) {
      assert.ok(architecture.signals.some((s) => s.name === `Tool invocation: ${agents[0].tools[0].name} ${outcome}`));
    }
  });

  test("tool-invocation signals never collide by name with the underlying integration operation signal", async () => {
    const { architecture } = await generateObservability(customerSupportMarkdown);
    const names = architecture.signals.map((s) => s.name.toLowerCase());
    assert.equal(new Set(names).size, names.length);
  });
});

describe("AI no-tool restraint", () => {
  test("invoice-triage agent (zero tools) generates zero tool-invocation telemetry", async () => {
    const { architecture, agents } = await generateObservability(invoiceTriageMarkdown);
    assert.deepEqual(agents[0].tools, []);
    assert.ok(!architecture.signals.some((s) => s.name.startsWith("Tool invocation:")));
  });
});

describe("AI escalation", () => {
  test("a real agent escalation generates an escalation signal", async () => {
    const { architecture, agents } = await generateObservability(customerSupportMarkdown);
    assert.ok(agents[0].escalationPolicy.length > 0);
    assert.ok(architecture.signals.some((s) => s.name.endsWith("escalation occurred")));
  });
});

describe("No prompt logging", () => {
  test("customer prompts/messages are never automatically logged as an attribute", async () => {
    const { architecture } = await generateObservability(customerSupportMarkdown);
    for (const signal of architecture.signals) {
      assert.ok(!signal.attributes.some((a) => /message|prompt/i.test(a.name)));
    }
  });
});

describe("No response logging", () => {
  test("AI responses are never automatically logged as an attribute", async () => {
    const { architecture } = await generateObservability(customerSupportMarkdown);
    for (const signal of architecture.signals) {
      assert.ok(!signal.attributes.some((a) => /response|conversation/i.test(a.name)));
    }
  });
});

describe("Sensitive payload restraint", () => {
  test("customer/invoice/order payload fields never appear as attributes across any example", async () => {
    const examples = [appointmentMarkdown, invoiceApprovalMarkdown, apiIntegrationMarkdown, customerSupportMarkdown, invoiceTriageMarkdown, operationalMarkdown];
    for (const markdown of examples) {
      const { architecture } = await generateObservability(markdown);
      for (const signal of architecture.signals) {
        for (const a of signal.attributes) {
          assert.ok(!/payload|body|content$/i.test(a.name), `${markdown.slice(0, 20)}: unexpected attribute "${a.name}"`);
        }
      }
    }
  });
});

describe("API-key protection", () => {
  test("API-key secrets cannot appear in signal attributes or log requirements", async () => {
    const { architecture } = await generateObservability(apiIntegrationMarkdown);
    for (const log of architecture.logRequirements) {
      assert.ok(!/api[_-]?key\s*[:=]\s*["'][^"']+["']/i.test(JSON.stringify(log)));
    }
    assert.ok(architecture.logRequirements.some((l) => l.prohibitedData.some((p) => /credential|api-key/i.test(p))));
  });
});

describe("Security references", () => {
  test("telemetry data-protection rules reference real Phase 5 requirements", async () => {
    const { architecture, security } = await generateObservability(operationalMarkdown);
    const securityTelemetry = architecture.telemetryRequirements.filter((r) => r.purpose === "security");
    assert.ok(securityTelemetry.length > 0);
    const knownDataProtectionEvidenceIds = new Set(security.dataProtection.flatMap((d) => d.evidenceRefs.map((e) => e.entityId)));
    for (const req of securityTelemetry) {
      assert.ok(req.evidenceRefs.every((e) => knownDataProtectionEvidenceIds.has(e.entityId)));
    }
  });
});

describe("Audit mapping", () => {
  test("a real AuditRequirement maps to real signals", async () => {
    const { architecture, security } = await generateObservability(invoiceApprovalMarkdown);
    assert.ok(security.auditRequirements.length > 0);
    const knownAuditIds = new Set(security.auditRequirements.map((a) => a.id));
    for (const mapping of architecture.auditMappings) {
      assert.ok(knownAuditIds.has(mapping.auditRequirementId));
      assert.ok(mapping.signalIds.length > 0);
    }
  });
});

describe("Correlation", () => {
  test("a workflow to integration path generates a correlation requirement", async () => {
    const { architecture } = await generateObservability(appointmentMarkdown);
    assert.ok(
      architecture.correlationRequirements.some(
        (c) => c.architecturePath.some((r) => r.entityType === "workflow") && c.architecturePath.some((r) => r.entityType === "integration")
      )
    );
  });
});

describe("No tracing-vendor assumption", () => {
  test("no OpenTelemetry/W3C/Datadog-specific trace format appears anywhere in the architecture", async () => {
    const { architecture } = await generateObservability(appointmentMarkdown);
    const serialized = JSON.stringify(architecture);
    assert.ok(!/opentelemetry|traceparent|x-ray|datadog trace|w3c trace context/i.test(serialized));
  });
});

describe("Explicit threshold", () => {
  test("the operational example preserves the 5-consecutive-failure threshold verbatim", async () => {
    const { architecture } = await generateObservability(operationalMarkdown);
    const alert = architecture.alertRequirements.find((a) => a.provenance === "explicit");
    assert.ok(alert);
    assert.match(alert!.threshold ?? "", /5\s+consecutive/i);
    assert.ok(alert!.evidenceRefs.length > 0);
  });
});

describe("Explicit performance objective", () => {
  test("the operational example preserves the 95%/2-second objective verbatim", async () => {
    const { architecture } = await generateObservability(operationalMarkdown);
    const objective = architecture.operationalObjectives.find((o) => o.explicit);
    assert.ok(objective);
    assert.match(objective!.targetValue ?? "", /95/);
    assert.match(objective!.targetValue ?? "", /2/);
  });
});

describe("No threshold fabrication", () => {
  test("examples without explicit thresholds gain none", async () => {
    for (const markdown of [appointmentMarkdown, apiIntegrationMarkdown, restExportReadyMarkdown]) {
      const { architecture } = await generateObservability(markdown);
      assert.deepEqual(architecture.operationalObjectives.filter((o) => o.explicit), []);
    }
  });
});

describe("Alert destination unknown", () => {
  test("no destination is invented for any generated alert", async () => {
    const { architecture } = await generateObservability(operationalMarkdown);
    for (const alert of architecture.alertRequirements) {
      if (!alert.destination) continue;
      assert.fail("no example states an explicit alert destination — one should never be invented");
    }
  });
});

describe("Dashboard consistency", () => {
  test("dashboard signal IDs resolve to real signals", async () => {
    const { architecture } = await generateObservability(appointmentMarkdown);
    const signalIds = new Set(architecture.signals.map((s) => s.id));
    for (const dashboard of architecture.dashboardSpecifications) {
      for (const id of dashboard.signalIds) assert.ok(signalIds.has(id));
    }
  });
});

describe("Referential integrity", () => {
  test("all architecture references resolve for every example", async () => {
    for (const markdown of [appointmentMarkdown, invoiceApprovalMarkdown, apiIntegrationMarkdown, customerSupportMarkdown, invoiceTriageMarkdown, operationalMarkdown]) {
      const { architecture, context, workflows, integrations, agents, security } = await generateObservability(markdown);
      const result = validateObservabilityArchitecture(architecture, context.discoveryResult!, workflows, integrations, agents, security);
      assert.deepEqual(result.issues.filter((i) => i.severity === "error"), [], JSON.stringify(result.issues));
    }
  });
});

describe("Artifact consistency", () => {
  test("JSON and Markdown render from identical structured objects", async () => {
    const { architecture } = await generateObservability(operationalMarkdown);
    const artifacts = buildObservabilityArtifacts(architecture);
    const json = artifacts.find((a) => a.path?.endsWith("observability-architecture.json"));
    const md = artifacts.find((a) => a.path?.endsWith("observability-architecture.md"));
    assert.ok(json && md);
    const parsed = JSON.parse(json!.content as string);
    assert.equal(parsed.version, architecture.version);
    const mdContent = md!.content as string;
    for (const heading of [
      "Scope", "Observable Components", "Workflow Visibility", "Integration Visibility", "AI Agent Visibility",
      "Logs and Events", "Metrics", "Correlation / Tracing", "Auditability", "Health Requirements",
      "Alert Requirements", "Operational Objectives", "Dashboards / Operational Views", "Data Protection in Telemetry",
      "Information Gaps", "Traceability",
    ]) {
      assert.ok(mdContent.includes(`## ${heading}`), `missing section: ${heading}`);
    }
  });
});

describe("Backward compatibility", () => {
  test("website capability is unaffected by observability generation changes", async () => {
    const context = await makeContext(appointmentMarkdown);
    assert.equal(websiteCapability.assess, undefined);
    assert.equal(websiteCapability.supports(context), true);
  });
});

describe("Integration export compatibility", () => {
  test("Phase 5.5A exporters remain unchanged and make zero network calls", async () => {
    const { integrations } = await generateObservability(apiIntegrationMarkdown);
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

describe("AI compatibility", () => {
  test("Phase 6 AI agent outputs remain unchanged by observability generation", async () => {
    const { agents } = await generateObservability(customerSupportMarkdown);
    assert.equal(agents.length, 1);
    assert.equal(agents[0].autonomy, "supervised");
    assert.equal(agents[0].memory.mode, "session");
  });
});

describe("Capability id", () => {
  test("OBSERVABILITY_CAPABILITY_ID is stable", () => {
    assert.equal(OBSERVABILITY_CAPABILITY_ID, "observability");
  });
});
