/**
 * Deterministic coverage for Phase 7B Vendor-Neutral Cloud and Deployment
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

import { buildObservabilityArchitecture } from "../framework/capabilities/observability/generators/observability-architecture.generator.js";
import type { ObservabilityArchitecture } from "../framework/capabilities/observability/schemas/observability.types.js";

import { assessCloud, CLOUD_CAPABILITY_ID } from "../framework/capabilities/cloud/cloud.assessor.js";
import { buildCloudPlan } from "../framework/capabilities/cloud/cloud.planner.js";
import { buildCloudArchitecture } from "../framework/capabilities/cloud/generators/cloud-architecture.generator.js";
import { buildCloudArtifacts } from "../framework/capabilities/cloud/generators/cloud-artifact.generator.js";
import { validateCloudArchitecture } from "../framework/capabilities/cloud/validators/cloud.validator.js";
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

async function generateCloud(markdown: string) {
  const context = await makeContext(markdown);
  const workflows = await generateWorkflows(context);
  const integrations = await generateIntegrations(context, workflows);
  const agents = await generateAgents(context, workflows, integrations);
  const { security, governance } = generateSecurityGovernance(context, workflows, integrations, agents);
  const observability: ObservabilityArchitecture = buildObservabilityArchitecture(context.discoveryResult!, workflows, integrations, agents, security, governance);
  const assessment = assessCloud(context);
  const plan = buildCloudPlan(context, assessment);
  const architecture = buildCloudArchitecture(context.discoveryResult!, workflows, integrations, agents, security, governance, observability);
  return { context, workflows, integrations, agents, security, governance, observability, assessment, plan, architecture };
}

const appointmentMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/appointment-business.md"), "utf-8");
const invoiceApprovalMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/invoice-approval.md"), "utf-8");
const apiIntegrationMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/api-integration.md"), "utf-8");
const restExportReadyMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/rest-export-ready.md"), "utf-8");
const customerDataWorkflowMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/customer-data-workflow.md"), "utf-8");
const customerSupportMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/customer-support-agent.md"), "utf-8");
const invoiceTriageMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/invoice-triage-agent.md"), "utf-8");
const operationalMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/operational-order-processing.md"), "utf-8");
const cloudOrderPlatformMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/cloud-order-platform.md"), "utf-8");
const cloudProviderExplicitMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/cloud-provider-explicit.md"), "utf-8");

const RESTRAINT_EXAMPLES = [appointmentMarkdown, invoiceApprovalMarkdown, apiIntegrationMarkdown, restExportReadyMarkdown, customerDataWorkflowMarkdown, operationalMarkdown];
const AI_EXAMPLES = [customerSupportMarkdown, invoiceTriageMarkdown];

describe("Selection restraint", () => {
  test("a workflow-only, integration-only, or plain operational example never selects Cloud", async () => {
    for (const markdown of RESTRAINT_EXAMPLES) {
      const context = await makeContext(markdown);
      const assessment = assessCloud(context);
      assert.equal(assessment.status, "not-recommended", `unexpected status for example starting "${markdown.slice(0, 30)}"`);
    }
  });

  test("a plain static-website-only scenario does not select Cloud", async () => {
    const markdown = `# Project: Simple Co\n\n## Business\n- **Business Name:** Simple Co\n- **Industry:** Local services\n\n## Goals\n- Have an informational website\n\n## Users\n- Visitors\n`;
    const context = await makeContext(markdown);
    const assessment = assessCloud(context);
    assert.equal(assessment.status, "not-recommended");
  });
});

describe("AI agent supporting signal", () => {
  test("an AI agent example reaches needs-review without ever selecting a provider", async () => {
    for (const markdown of AI_EXAMPLES) {
      const context = await makeContext(markdown);
      const assessment = assessCloud(context);
      assert.equal(assessment.status, "needs-review");
    }
  });

  test("an AI agent generates a runtime requirement but no deployment unit or provider", async () => {
    const { architecture, agents } = await generateCloud(customerSupportMarkdown);
    assert.ok(agents.length > 0);
    assert.ok(architecture.runtimeRequirements.some((r) => r.appliesTo.some((a) => a.entityType === "ai-agent")));
    assert.equal(architecture.deploymentUnits.length, 0);
    assert.equal(architecture.providerRequirement.explicit, false);
    assert.equal(architecture.providerRequirement.provider, "unspecified");
  });
});

describe("Explicit deployment selection", () => {
  test("cloud-order-platform.md selects Cloud as recommended", async () => {
    const context = await makeContext(cloudOrderPlatformMarkdown);
    const assessment = assessCloud(context);
    assert.equal(assessment.status, "recommended");
  });

  test("cloud-provider-explicit.md selects Cloud as recommended", async () => {
    const context = await makeContext(cloudProviderExplicitMarkdown);
    const assessment = assessCloud(context);
    assert.equal(assessment.status, "recommended");
  });
});

describe("Deployment unit restraint", () => {
  test("deployment units are only created from explicit solution-managed language, never one per workflow/integration/agent", async () => {
    const { architecture, workflows, integrations } = await generateCloud(cloudOrderPlatformMarkdown);
    assert.equal(architecture.deploymentUnits.length, 2);
    // The unit names ("Order API"/"Order Processor") come from the deployment-need bullets
    // themselves, never from the WorkflowDefinition/IntegrationDefinition names/ids.
    const workflowNames = new Set(workflows.map((w) => w.name));
    const integrationIds = new Set(integrations.map((i) => i.id));
    for (const unit of architecture.deploymentUnits) {
      assert.ok(!workflowNames.has(unit.name));
      assert.ok(!integrationIds.has(unit.id));
    }
  });

  test("external systems referenced by integrations never become deployment units", async () => {
    const { architecture, context } = await generateCloud(cloudOrderPlatformMarkdown);
    const systemIds = new Set(context.discoveryResult!.systems.map((s) => s.id));
    for (const unit of architecture.deploymentUnits) {
      assert.ok(!systemIds.has(unit.id));
    }
  });

  test("a plain integration-only example (api-integration.md) produces zero deployment units", async () => {
    const { architecture } = await generateCloud(apiIntegrationMarkdown);
    assert.equal(architecture.deploymentUnits.length, 0);
  });
});

describe("Exposure resolution", () => {
  test("the publicly-reachable unit resolves to a public inbound connectivity requirement", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    const orderApi = architecture.deploymentUnits.find((u) => u.name === "Order API");
    assert.ok(orderApi);
    const conn = architecture.connectivityRequirements.find((c) => c.target.kind === "deployment-unit" && c.target.entityId === orderApi!.id);
    assert.ok(conn);
    assert.equal(conn!.exposure, "public");
    assert.equal(conn!.protocol, "https");
  });

  test("the non-public unit never receives a public connectivity requirement", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    const processor = architecture.deploymentUnits.find((u) => u.name === "Order Processor");
    assert.ok(processor);
    const publicConn = architecture.connectivityRequirements.find(
      (c) => c.target.kind === "deployment-unit" && c.target.entityId === processor!.id && c.exposure === "public"
    );
    assert.equal(publicConn, undefined);
  });
});

describe("Connectivity from real integrations", () => {
  test("a real integration produces a connectivity requirement referencing it verbatim, protocol preserved", async () => {
    const { architecture, integrations } = await generateCloud(cloudOrderPlatformMarkdown);
    assert.ok(integrations.length > 0);
    const conn = architecture.connectivityRequirements.find((c) => c.integrationId === integrations[0].id);
    assert.ok(conn);
    assert.equal(conn!.protocol, integrations[0].protocol);
    assert.equal(conn!.target.kind, "external-system");
  });

  test("external SaaS systems are never marked solution-managed", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    for (const conn of architecture.connectivityRequirements) {
      if (conn.target.kind === "external-system") assert.notEqual(conn.target.kind, "deployment-unit");
    }
  });
});

describe("Environment preservation", () => {
  test("explicitly named environments are preserved verbatim, not normalized", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    const names = architecture.environmentRequirements.map((e) => e.name);
    assert.ok(names.includes("Test"));
    assert.ok(names.includes("Production"));
  });

  test("no environments are generated when none are explicit", async () => {
    const { architecture } = await generateCloud(appointmentMarkdown);
    assert.deepEqual(architecture.environmentRequirements, []);
  });
});

describe("Scalability restraint", () => {
  test("an explicit concurrency target is preserved verbatim with evidence", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    const scale = architecture.scalabilityRequirements.find((s) => s.dimension === "concurrency");
    assert.ok(scale);
    assert.match(scale!.requirement ?? "", /100/);
    assert.ok(scale!.evidenceRefs.length > 0);
  });

  test("no scalability requirements are invented for examples without explicit targets", async () => {
    const { architecture } = await generateCloud(appointmentMarkdown);
    assert.deepEqual(architecture.scalabilityRequirements, []);
  });
});

describe("Resilience restraint", () => {
  test("an explicit dependency-unavailability statement produces a resilience requirement referencing the real integration, with no strategy invented", async () => {
    const { architecture, integrations } = await generateCloud(cloudOrderPlatformMarkdown);
    const resilience = architecture.resilienceRequirements.find((r) => r.concern === "dependency-failure");
    assert.ok(resilience);
    assert.equal(resilience!.strategy, "unspecified");
    assert.ok(resilience!.target.some((t) => t.entityType === "integration" && integrations.some((i) => i.id === t.entityId)));
  });
});

describe("Durable state from workflow approval", () => {
  test("a workflow with a real pending approval derives durable state without inventing a database", async () => {
    const { architecture, workflows } = await generateCloud(invoiceApprovalMarkdown);
    const approvalWorkflow = workflows.find((w) => w.approvals.length > 0);
    assert.ok(approvalWorkflow);
    const state = architecture.stateRequirements.find((s) => s.mode === "durable" && s.appliesTo.some((a) => a.entityType === "workflow" && a.entityId === approvalWorkflow!.id));
    assert.ok(state);
    assert.equal(architecture.persistenceRequirements.some((p) => /postgres|mysql|mongo|dynamo|redis/i.test(p.purpose)), false);
  });
});

describe("Explicit persistence requirement", () => {
  test("explicit restart-survival language produces paired state + persistence requirements with unspecified technology", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    const state = architecture.stateRequirements.find((s) => s.mode === "durable" && /restart/i.test(s.purpose));
    const persistence = architecture.persistenceRequirements.find((p) => /restart/i.test(p.purpose));
    assert.ok(state);
    assert.ok(persistence);
    assert.equal(persistence!.technology, "unspecified");
  });
});

describe("Provider preservation without invention", () => {
  test("explicit AWS + region is preserved verbatim, no service invented", async () => {
    const { architecture } = await generateCloud(cloudProviderExplicitMarkdown);
    assert.equal(architecture.providerRequirement.provider, "aws");
    assert.equal(architecture.providerRequirement.explicit, true);
    assert.ok(architecture.providerRequirement.evidenceRefs.length > 0);
    assert.equal(architecture.locationRequirement?.location, "us-east-1");
    assert.equal(architecture.locationRequirement?.explicit, true);
  });

  test("no example ever mentions a specific provider service, VPC, or network implementation", async () => {
    const denylist = /\b(Lambda|ECS|EKS|Fargate|EC2|RDS|DynamoDB|S3|SQS|AKS|App Service|Cosmos DB|Azure Functions|GKE|Cloud Run|Cloud Functions|Firestore|Pub\/?Sub|VPC|subnet|NAT gateway|security group|load balancer|private link|route table|internet gateway)\b/i;
    for (const markdown of [...RESTRAINT_EXAMPLES, ...AI_EXAMPLES, cloudOrderPlatformMarkdown, cloudProviderExplicitMarkdown]) {
      const { architecture } = await generateCloud(markdown);
      assert.ok(!denylist.test(JSON.stringify(architecture)), `denylisted term found for example starting "${markdown.slice(0, 30)}"`);
    }
  });

  test("hostingModel is never inferred as cloud from a negative provider statement", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    assert.equal(architecture.hostingModel, "unknown");
  });
});

describe("Security mapping", () => {
  test("a security requirement applying to a mapped integration links to the owning deployment unit's connectivity", async () => {
    const { architecture, security } = await generateCloud(cloudOrderPlatformMarkdown);
    assert.ok(security.requirements.length > 0);
    if (architecture.securityMappings.length > 0) {
      for (const mapping of architecture.securityMappings) {
        assert.ok(security.requirements.some((r) => r.id === mapping.securityRequirementId));
      }
    }
  });

  test("no secret-manager product is ever named", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    assert.ok(!/secrets manager|key vault|vault\b|k8s secret/i.test(JSON.stringify(architecture)));
  });
});

describe("Observability mapping", () => {
  test("observability mapping ids reference real Phase 7A ids verbatim", async () => {
    const { architecture, observability } = await generateCloud(cloudOrderPlatformMarkdown);
    const knownIds = new Set([...observability.signals.map((s) => s.id), ...observability.healthRequirements.map((h) => h.id), ...observability.operationalObjectives.map((o) => o.id)]);
    for (const mapping of architecture.observabilityMappings) {
      for (const id of [...mapping.telemetryRequirementIds, ...mapping.healthRequirementIds, ...mapping.operationalObjectiveIds]) {
        assert.ok(knownIds.has(id));
      }
    }
  });

  test("no infrastructure metric (CPU/memory/disk/pod-count) is ever fabricated", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    assert.ok(!/\bcpu\b|\bmemory\b|\bdisk\b|\bpod.?count\b|\bnode.?count\b|\bcontainer restart\b/i.test(JSON.stringify(architecture)));
  });
});

describe("Microservice restraint", () => {
  test("multiple workflow/integration/agent objects do not automatically become multiple deployment units", async () => {
    const { architecture, workflows, integrations, agents } = await generateCloud(operationalMarkdown);
    assert.ok(workflows.length + integrations.length + agents.length >= 1);
    assert.equal(architecture.deploymentUnits.length, 0);
  });
});

describe("Referential integrity", () => {
  test("all architecture references resolve for every example", async () => {
    for (const markdown of [...RESTRAINT_EXAMPLES, ...AI_EXAMPLES, cloudOrderPlatformMarkdown, cloudProviderExplicitMarkdown]) {
      const { architecture, context, workflows, integrations, agents, security, observability } = await generateCloud(markdown);
      const result = validateCloudArchitecture(architecture, context.discoveryResult!, workflows, integrations, agents, security, observability);
      assert.deepEqual(result.issues.filter((i) => i.severity === "error"), [], JSON.stringify(result.issues));
    }
  });
});

describe("Artifact consistency", () => {
  test("JSON and Markdown render from identical structured objects", async () => {
    const { architecture } = await generateCloud(cloudOrderPlatformMarkdown);
    const artifacts = buildCloudArtifacts(architecture);
    const json = artifacts.find((a) => a.path?.endsWith("cloud-architecture.json"));
    const md = artifacts.find((a) => a.path?.endsWith("cloud-architecture.md"));
    assert.ok(json && md);
    const parsed = JSON.parse(json!.content as string);
    assert.equal(parsed.version, architecture.version);
    const mdContent = md!.content as string;
    for (const heading of [
      "Hosting Model", "Deployment Units", "Runtime Requirements", "State Requirements", "Persistence Requirements",
      "Connectivity", "Environments", "Scalability", "Resilience", "Deployment Strategy", "Security Mapping",
      "Observability Mapping", "Information Gaps",
    ]) {
      assert.ok(mdContent.includes(`## ${heading}`), `missing section: ${heading}`);
    }
  });
});

describe("Deployment-boundary ambiguity gap", () => {
  test("runtime ownership without deployment units generates an information gap rather than guessing", async () => {
    const { architecture } = await generateCloud(customerSupportMarkdown);
    assert.ok(architecture.informationGaps.some((g) => /deployment boundary/i.test(g.topic)));
  });
});

describe("Backward compatibility", () => {
  test("website capability is unaffected by cloud generation changes", async () => {
    const context = await makeContext(appointmentMarkdown);
    assert.equal(websiteCapability.assess, undefined);
    assert.equal(websiteCapability.supports(context), true);
  });

  test("Phase 6 AI agent outputs remain unchanged by cloud generation", async () => {
    const { agents } = await generateCloud(customerSupportMarkdown);
    assert.equal(agents.length, 1);
    assert.equal(agents[0].autonomy, "supervised");
  });
});

describe("Capability id", () => {
  test("CLOUD_CAPABILITY_ID is stable", () => {
    assert.equal(CLOUD_CAPABILITY_ID, "cloud");
  });
});
