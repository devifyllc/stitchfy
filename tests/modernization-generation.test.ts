/**
 * Deterministic coverage for Phase 8 Legacy Modernization Assessment and
 * Migration Strategy Architecture generation. Uses Node's built-in test
 * runner, same as the other test files. Run with `npm run test`.
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

import { assessCloud } from "../framework/capabilities/cloud/cloud.assessor.js";
import { buildCloudArchitecture } from "../framework/capabilities/cloud/generators/cloud-architecture.generator.js";
import type { CloudArchitecture } from "../framework/capabilities/cloud/schemas/cloud.types.js";

import { assessModernization, MODERNIZATION_CAPABILITY_ID } from "../framework/capabilities/modernization/modernization.assessor.js";
import { buildModernizationRisks } from "../framework/capabilities/modernization/generators/migration-strategy.generator.js";
import { buildModernizationArchitecture } from "../framework/capabilities/modernization/generators/modernization-architecture.generator.js";
import { buildModernizationArtifacts } from "../framework/capabilities/modernization/generators/modernization-artifact.generator.js";
import { validateModernizationArchitecture } from "../framework/capabilities/modernization/validators/modernization.validator.js";
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

async function generateModernization(markdown: string) {
  const context = await makeContext(markdown);
  const workflows = await generateWorkflows(context);
  const integrations = await generateIntegrations(context, workflows);
  const agents = await generateAgents(context, workflows, integrations);
  const { security, governance } = generateSecurityGovernance(context, workflows, integrations, agents);
  const observability: ObservabilityArchitecture = buildObservabilityArchitecture(context.discoveryResult!, workflows, integrations, agents, security, governance);
  const cloudAssessment = assessCloud(context);
  const cloud: CloudArchitecture | undefined =
    cloudAssessment.status === "recommended" || cloudAssessment.status === "needs-review"
      ? buildCloudArchitecture(context.discoveryResult!, workflows, integrations, agents, security, governance, observability)
      : undefined;
  const assessment = assessModernization(context);
  const architecture = buildModernizationArchitecture(context.discoveryResult!, integrations, security, observability, cloud);
  return { context, workflows, integrations, agents, security, governance, observability, cloud, assessment, architecture };
}

const appointmentMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/appointment-business.md"), "utf-8");
const invoiceApprovalMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/invoice-approval.md"), "utf-8");
const apiIntegrationMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/api-integration.md"), "utf-8");
const customerSupportMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/customer-support-agent.md"), "utf-8");
const cloudOrderPlatformMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/cloud-order-platform.md"), "utf-8");
const operationalMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/operational-order-processing.md"), "utf-8");
const javaModernizationMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/legacy-java-modernization.md"), "utf-8");
const operationsAssessmentMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/legacy-operations-assessment.md"), "utf-8");

const RESTRAINT_EXAMPLES = [appointmentMarkdown, invoiceApprovalMarkdown, apiIntegrationMarkdown, customerSupportMarkdown, cloudOrderPlatformMarkdown, operationalMarkdown];

describe("Selection restraint", () => {
  test("pre-existing examples without modernization intent never select Modernization", async () => {
    for (const markdown of RESTRAINT_EXAMPLES) {
      const context = await makeContext(markdown);
      const assessment = assessModernization(context);
      assert.equal(assessment.status, "not-recommended", `unexpected status for example starting "${markdown.slice(0, 30)}"`);
    }
  });

  test("a plain static-website-only scenario does not select Modernization", async () => {
    const markdown = `# Project: Simple Co\n\n## Business\n- **Business Name:** Simple Co\n- **Industry:** Local services\n\n## Goals\n- Have an informational website\n\n## Users\n- Visitors\n`;
    const context = await makeContext(markdown);
    const assessment = assessModernization(context);
    assert.equal(assessment.status, "not-recommended");
  });
});

describe("Legacy-category-alone restraint", () => {
  test("an explicitly legacy-classified system alone reaches needs-review, never recommended, and selects no strategy", async () => {
    const markdown = `# Project: Fixture Co\n\n## Business\n- **Business Name:** Fixture Co\n- **Industry:** Software\n\n## Goals\n- Keep the lights on\n\n## Users\n- Staff\n\n## Existing Systems\n- **Legacy Billing System:** Handles billing.\n`;
    const context = await makeContext(markdown);
    const assessment = assessModernization(context);
    assert.equal(assessment.status, "needs-review");
    assert.equal(assessment.confidence, "low");
  });
});

describe("Explicit strategy classification", () => {
  test("an explicit 'from A to B' statement classifies as replatform with target technology preserved verbatim", async () => {
    const { architecture } = await generateModernization(javaModernizationMarkdown);
    const candidate = architecture.migrationCandidates.find((c) => c.strategyOptions.some((o) => o.strategy === "replatform" && o.status === "explicit"));
    assert.ok(candidate);
    const delta = architecture.modernizationDeltas.find((d) => d.systemId === candidate!.systemId);
    assert.ok(delta);
    assert.match(delta!.targetState, /Tomcat/);
    assert.match(delta!.currentState, /WebSphere/);
  });

  test("no cloud provider, microservices, database technology, or specific infra platform is ever invented", async () => {
    const { architecture } = await generateModernization(javaModernizationMarkdown);
    const denylist = /\b(AWS|Azure|GCP|Kubernetes|k8s|Docker|microservice|serverless|Lambda|container|PostgreSQL|MySQL|MongoDB|DynamoDB)\b/i;
    assert.ok(!denylist.test(JSON.stringify(architecture)));
  });
});

describe("Unknown-strategy restraint", () => {
  test("modernization intent without a target produces exactly one needs-review/unknown strategy option per candidate, never a fabricated strategy", async () => {
    const { architecture } = await generateModernization(operationsAssessmentMarkdown);
    assert.ok(architecture.migrationCandidates.length > 0);
    for (const candidate of architecture.migrationCandidates) {
      assert.equal(candidate.status, "needs-review");
      assert.equal(candidate.strategyOptions.length, 1);
      assert.equal(candidate.strategyOptions[0].strategy, "unknown");
      assert.equal(candidate.strategyOptions[0].status, "needs-review");
    }
  });
});

describe("Retain detection", () => {
  test("explicit retain language marks a candidate retain, not a migration candidate", async () => {
    const markdown = `# Project: Retain Co\n\n## Business\n- **Business Name:** Retain Co\n- **Industry:** Software\n\n## Goals\n- Keep systems stable\n\n## Users\n- Staff\n\n## Existing Systems\n- **Billing System:** Handles billing.\n\n## Modernization Requirements\n- The Billing System will be retained with no migration planned.\n`;
    const { architecture } = await generateModernization(markdown);
    const candidate = architecture.migrationCandidates[0];
    assert.ok(candidate);
    assert.equal(candidate.status, "retain");
    assert.ok(!architecture.roadmap.workstreams.some((w) => w.candidateIds.includes(candidate.id)));
  });
});

describe("Dependency derivation", () => {
  test("a real IntegrationDefinition with both systems resolved produces a SystemDependency, protocol/direction reused verbatim", async () => {
    const { architecture, integrations } = await generateModernization(javaModernizationMarkdown);
    assert.ok(integrations.length > 0);
    const dep = architecture.dependencies.find((d) => d.integrationId === integrations[0].id);
    assert.ok(dep);
    assert.equal(dep!.direction, integrations[0].direction);
  });

  test("no source-code/module-level dependency is ever invented for a non-integration example", async () => {
    const { architecture } = await generateModernization(operationsAssessmentMarkdown);
    assert.deepEqual(architecture.dependencies, []);
  });

  test("a system mentioned only in a preservation bullet is not promoted into modernization scope (item 66 generalized)", async () => {
    const { architecture, context } = await generateModernization(javaModernizationMarkdown);
    const gatewaySystem = context.discoveryResult!.systems.find((s) => s.name === "Integration Gateway");
    assert.ok(gatewaySystem);
    assert.ok(!architecture.migrationCandidates.some((c) => c.systemId === gatewaySystem!.id));
  });
});

describe("Coexistence", () => {
  test("explicit coexistence language produces a coexistence approach and a corresponding risk, no cutover date invented", async () => {
    const { architecture } = await generateModernization(javaModernizationMarkdown);
    const candidate = architecture.migrationCandidates.find((c) => c.approach === "coexistence");
    assert.ok(candidate);
    assert.ok(architecture.risks.some((r) => r.description.includes("coexistence window")));
    assert.ok(!/\bweek\s+\d|\bmonth\s+\d|\bq[1-4]\b/i.test(JSON.stringify(architecture)));
  });
});

describe("Database restraint", () => {
  test("explicit 'database technology must remain unchanged' produces a preservation requirement, never a database migration", async () => {
    const { architecture } = await generateModernization(javaModernizationMarkdown);
    assert.ok(architecture.preservationRequirements.some((p) => /database technology must not change/i.test(p.description)));
    assert.ok(!/\bschema migration\b|\bETL\b|\bCDC\b|\bdual.write\b|\breplication\b/i.test(JSON.stringify(architecture)));
  });
});

describe("Shared-database risk", () => {
  test("two dependencies targeting the same database system produce a modernization risk with unknown likelihood/impact", () => {
    let counter = 0;
    const nextId = () => `MODRISK-${++counter}`;
    const evidenceRefs = [{ entityType: "integration" as const, entityId: "INT-001" }];
    const dependencies = [
      { id: "DEPEND-001", sourceSystemId: "SYS-001", targetSystemId: "SYS-003", type: "database" as const, direction: "unknown" as const, integrationId: "INT-001", description: "App A uses Shared DB", evidenceRefs },
      { id: "DEPEND-002", sourceSystemId: "SYS-002", targetSystemId: "SYS-003", type: "database" as const, direction: "unknown" as const, integrationId: "INT-002", description: "App B uses Shared DB", evidenceRefs },
    ];
    const risks = buildModernizationRisks(dependencies, [], nextId);
    const risk = risks.find((r) => /same database/i.test(r.description));
    assert.ok(risk);
    assert.equal(risk!.likelihood, "unknown");
    assert.equal(risk!.impact, "unknown");
    assert.equal(risk!.category, "modernization");
    assert.ok(risk!.evidenceRefs.length > 0);
  });

  test("a single dependency targeting a database never produces a shared-database risk", () => {
    let counter = 0;
    const nextId = () => `MODRISK-${++counter}`;
    const dependencies = [
      { id: "DEPEND-001", sourceSystemId: "SYS-001", targetSystemId: "SYS-003", type: "database" as const, direction: "unknown" as const, description: "App A uses DB", evidenceRefs: [] },
    ];
    const risks = buildModernizationRisks(dependencies, [], nextId);
    assert.deepEqual(risks, []);
  });
});

describe("Rewrite-bias regression", () => {
  test("'legacy application' language alone does not produce replace/rewrite/rearchitect", async () => {
    const { architecture } = await generateModernization(operationsAssessmentMarkdown);
    for (const candidate of architecture.migrationCandidates) {
      assert.ok(!candidate.strategyOptions.some((o) => ["replace", "rearchitect"].includes(o.strategy)));
    }
  });
});

describe("Microservices-bias regression", () => {
  test("a monolithic legacy application never produces multiple candidates or a microservices/rearchitect strategy", async () => {
    const { architecture } = await generateModernization(javaModernizationMarkdown);
    assert.equal(architecture.migrationCandidates.length, 1);
    for (const candidate of architecture.migrationCandidates) {
      assert.ok(!candidate.strategyOptions.some((o) => o.strategy === "rearchitect"));
    }
  });
});

describe("Cloud-bias regression", () => {
  test("a modernization example without cloud requirements never selects a provider or hosting model", async () => {
    const { architecture, cloud } = await generateModernization(javaModernizationMarkdown);
    if (cloud) {
      assert.equal(cloud.providerRequirement.explicit, false);
      assert.equal(cloud.hostingModel, "unknown");
    }
    assert.ok(!/\bAWS\b|\bAzure\b|\bGCP\b/i.test(JSON.stringify(architecture)));
  });
});

describe("Referential integrity", () => {
  test("all architecture references resolve for every example", async () => {
    for (const markdown of [...RESTRAINT_EXAMPLES, javaModernizationMarkdown, operationsAssessmentMarkdown]) {
      const { architecture, context, integrations } = await generateModernization(markdown);
      const result = validateModernizationArchitecture(architecture, context.discoveryResult!, integrations);
      assert.deepEqual(result.issues.filter((i) => i.severity === "error"), [], JSON.stringify(result.issues));
    }
  });
});

describe("Artifact consistency", () => {
  test("JSON and Markdown render from identical structured objects", async () => {
    const { architecture } = await generateModernization(javaModernizationMarkdown);
    const artifacts = buildModernizationArtifacts(architecture);
    const json = artifacts.find((a) => a.path?.endsWith("modernization-architecture.json"));
    const md = artifacts.find((a) => a.path?.endsWith("modernization-architecture.md"));
    assert.ok(json && md);
    const parsed = JSON.parse(json!.content as string);
    assert.equal(parsed.version, architecture.version);
    const mdContent = md!.content as string;
    for (const heading of [
      "Scope", "Systems in Scope", "Modernization Drivers", "System Profiles", "Current-State Dependencies",
      "Technical Debt", "Preservation Requirements", "Modernization Seams", "Migration Candidates", "Strategy Options",
      "Target-State Requirements", "Migration Risks", "Validation Requirements", "Information Gaps", "Traceability",
    ]) {
      assert.ok(mdContent.includes(`## ${heading}`), `missing section: ${heading}`);
    }
  });
});

describe("Backward compatibility", () => {
  test("website capability is unaffected by modernization generation changes", async () => {
    const context = await makeContext(appointmentMarkdown);
    assert.equal(websiteCapability.assess, undefined);
    assert.equal(websiteCapability.supports(context), true);
  });
});

describe("Capability id", () => {
  test("MODERNIZATION_CAPABILITY_ID is stable", () => {
    assert.equal(MODERNIZATION_CAPABILITY_ID, "modernization");
  });
});
