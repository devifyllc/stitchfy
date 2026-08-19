/**
 * Deterministic coverage for Phase 5 security/governance/risk generation.
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
import type { WorkflowDefinition, WorkflowAutomationSection } from "../framework/capabilities/workflow-automation/schemas/workflow-automation.types.js";

import { assessIntegrations } from "../framework/capabilities/integrations/integrations.assessor.js";
import { buildIntegrationPlan } from "../framework/capabilities/integrations/integrations.planner.js";
import { buildIntegrationDefinitions } from "../framework/capabilities/integrations/generators/integration-definition.generator.js";
import type { IntegrationDefinition, IntegrationsSection } from "../framework/capabilities/integrations/schemas/integrations.types.js";

import { assessSecurityGovernance, SECURITY_GOVERNANCE_CAPABILITY_ID } from "../framework/capabilities/security-governance/security-governance.assessor.js";
import { buildSecurityArchitecture } from "../framework/capabilities/security-governance/generators/security-architecture.generator.js";
import { buildGovernancePlan } from "../framework/capabilities/security-governance/generators/governance-plan.generator.js";
import { buildSecurityGovernanceArtifacts } from "../framework/capabilities/security-governance/generators/security-artifact.generator.js";
import { validateSecurityArchitecture, validateGovernancePlan } from "../framework/capabilities/security-governance/validators/security-architecture.validator.js";
import { securityGovernanceCapability } from "../framework/capabilities/security-governance/security-governance.capability.js";
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

async function generateSecurityGovernance(markdown: string) {
  const context = await makeContext(markdown);
  const workflows = await generateWorkflows(context);
  const integrations = await generateIntegrations(context, workflows);
  const security = buildSecurityArchitecture(context.discoveryResult!, workflows, integrations);
  const governance = buildGovernancePlan(context.discoveryResult!, workflows, security);
  return { context, workflows, integrations, security, governance };
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
const customerDataMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/customer-data-workflow.md"), "utf-8");
const allExamples = [appointmentMarkdown, invoiceMarkdown, apiMarkdown, customerDataMarkdown];

describe("Structured capability selection", () => {
  test("selects based on structured evidence, not the words 'security'/'governance'/'cybersecurity'", async () => {
    assert.ok(!/\bsecurity\b|\bgovernance\b|\bcybersecurity\b/i.test(customerDataMarkdown));
    const context = await makeContext(customerDataMarkdown);
    const assessment = assessSecurityGovernance(context);
    assert.equal(assessment.method, "structured");
    assert.ok(assessment.status === "recommended" || assessment.status === "needs-review");
  });
});

describe("Sensitive data risk", () => {
  test("integration crossing an external/third-party boundary with sensitive/unresolved data produces a privacy risk", async () => {
    const { security } = await generateSecurityGovernance(appointmentMarkdown);
    const privacyRisks = security.risks.filter((r) => r.category === "privacy");
    assert.ok(privacyRisks.length > 0);
    for (const risk of privacyRisks) {
      assert.equal(risk.likelihood, "unknown");
      assert.equal(risk.impact, "unknown");
      assert.ok(risk.evidenceRefs.length > 0);
    }
  });
});

describe("Unknown data classification", () => {
  test("data protection requirements never invent a classification when Discovery didn't classify the data", async () => {
    const { security } = await generateSecurityGovernance(customerDataMarkdown);
    for (const req of security.dataProtection) {
      assert.ok(["confidential", "unknown"].includes(req.classification));
      assert.equal(req.encryptionInTransit, "unknown");
      assert.equal(req.encryptionAtRest, "unknown");
    }
  });
});

describe("Authentication preservation", () => {
  test("the explicit api-key mechanism from Integrations is preserved verbatim, not converted", async () => {
    const { integrations, security } = await generateSecurityGovernance(apiMarkdown);
    assert.equal(integrations[0].authentication?.mechanism, "api-key");
    const secretsReq = security.requirements.find((r) => r.domain === "secrets");
    assert.ok(secretsReq);
    assert.ok(secretsReq!.description.includes("api-key"));
    assert.ok(!/oauth|jwt|saml/i.test(secretsReq!.description));
  });
});

describe("Unknown authentication", () => {
  test("an integration with an unknown auth mechanism produces no secrets requirement for it", async () => {
    const { integrations, security } = await generateSecurityGovernance(appointmentMarkdown);
    const calendarIntegration = integrations.find((i) => i.purpose.toLowerCase().includes("calendar"));
    assert.ok(calendarIntegration);
    assert.equal(calendarIntegration!.authentication?.mechanism, "unknown");
    const secretsForCalendar = security.requirements.filter(
      (r) => r.domain === "secrets" && r.appliesTo.some((ref) => ref.entityId === calendarIntegration!.id)
    );
    assert.deepEqual(secretsForCalendar, []);
  });
});

describe("Identity/authorization separation", () => {
  const identityOnlyMarkdown = `# Project: Test Co

## Business Processes

Request Review

Actors:
Employee

Steps:
1. Employee signs in before reviewing any request

## Business Rules
- Employees must sign in before reviewing requests
`;

  const authorizationOnlyMarkdown = `# Project: Test Co

## Business Processes

Payment Review

Actors:
Manager

Steps:
1. Manager reviews payment requests

## Business Rules
- Only managers may approve payments above the stated threshold
`;

  test("identity-only language never produces an authorization requirement", async () => {
    const { security } = await generateSecurityGovernance(identityOnlyMarkdown);
    assert.ok(security.identityAccess.some((r) => r.kind === "identity"));
    assert.ok(!security.identityAccess.some((r) => r.kind === "authorization"));
  });

  test("authorization-only language never produces an identity requirement", async () => {
    const { security } = await generateSecurityGovernance(authorizationOnlyMarkdown);
    assert.ok(security.identityAccess.some((r) => r.kind === "authorization"));
    assert.ok(!security.identityAccess.some((r) => r.kind === "identity"));
  });
});

describe("Secrets requirement stays vendor-neutral", () => {
  test("no specific secrets-manager product is named in generated requirements", async () => {
    const { security } = await generateSecurityGovernance(apiMarkdown);
    const secretsReq = security.requirements.find((r) => r.domain === "secrets");
    assert.ok(secretsReq);
    assert.ok(!/AWS Secrets Manager|Vault|Key Vault|Secrets Manager/i.test(secretsReq!.description));
  });
});

describe("Trust boundary classification", () => {
  test("only external/third-party/unknown classifications ever appear — never invented network topology", async () => {
    for (const markdown of allExamples) {
      const { security } = await generateSecurityGovernance(markdown);
      for (const boundary of security.trustBoundaries) {
        assert.ok(["external", "third-party", "unknown"].includes(boundary.classification));
      }
      const serialized = JSON.stringify(security);
      assert.ok(!/\bDMZ\b|\bVPC\b|\bpublic subnet\b|\bprivate subnet\b/i.test(serialized));
    }
  });
});

describe("Human oversight", () => {
  test("every WorkflowApproval produces a human-oversight SecurityRequirement and a GovernanceApprovalControl", async () => {
    const { workflows, security, governance } = await generateSecurityGovernance(invoiceMarkdown);
    const totalApprovals = workflows.reduce((sum, w) => sum + w.approvals.length, 0);
    assert.ok(totalApprovals > 0);
    const oversightRequirements = security.requirements.filter((r) => r.domain === "human-oversight");
    assert.equal(oversightRequirements.length, totalApprovals);
    assert.equal(governance.humanOversight.length, totalApprovals);
  });
});

describe("Audit requirements", () => {
  test("audit requirements are generated per approval and reused (not duplicated) by the governance plan", async () => {
    const { security, governance } = await generateSecurityGovernance(invoiceMarkdown);
    assert.ok(security.auditRequirements.length > 0);
    assert.deepEqual(governance.auditRequirements, security.auditRequirements);
  });
});

describe("Compliance restraint", () => {
  test("no compliance framework is asserted for any of the 4 examples without an explicit statement", async () => {
    for (const markdown of allExamples) {
      const { governance } = await generateSecurityGovernance(markdown);
      const explicit = governance.complianceConsiderations.filter((c) => c.status === "explicit");
      assert.deepEqual(explicit, []);
    }
  });

  test("generated artifacts never claim the system is secure/compliant/certified", async () => {
    const { context, workflows, security, governance } = await generateSecurityGovernance(appointmentMarkdown);
    const artifacts = buildSecurityGovernanceArtifacts(security, governance, context.discoveryResult!, workflows);
    // Excludes the standing IMPLEMENTED_NOTE disclaimer, which deliberately
    // says "does not mean the resulting system is secure/compliant/..." —
    // the negation is the point of that sentence, not a violation of it.
    const affirmativeClaimPattern = /\bthe system is secure\b|\bthe system is compliant\b|\bthe system is certified\b|HIPAA-compliant|SOC2-ready|PCI-compliant|production-secure/i;
    for (const artifact of artifacts) {
      if (typeof artifact.content !== "string") continue;
      const withoutDisclaimer = artifact.content.split("\n").filter((line) => !line.startsWith("> `implemented: true`")).join("\n");
      assert.ok(!affirmativeClaimPattern.test(withoutDisclaimer), `${artifact.path} contains an affirmative security/compliance claim`);
    }
  });
});

describe("Explicit compliance", () => {
  const hipaaMarkdown = `# Project: Community Health Co

## Business Processes

Patient Intake

Actors:
Nurse

Steps:
1. Nurse records patient contact information

## Constraints
- This process must remain HIPAA compliant at all times

## Data
Patient contact information
`;

  test("an exact framework-name match produces an explicit ComplianceConsideration citing its source", async () => {
    const { governance } = await generateSecurityGovernance(hipaaMarkdown);
    const explicit = governance.complianceConsiderations.filter((c) => c.status === "explicit");
    assert.ok(explicit.length > 0);
    assert.equal(explicit[0].framework, "HIPAA");
    assert.ok(explicit[0].evidenceRefs.length > 0);
  });
});

describe("Risk without a fabricated score", () => {
  test("RiskAssessment never carries a numeric score/likelihood-times-impact field", async () => {
    const { security } = await generateSecurityGovernance(appointmentMarkdown);
    assert.ok(security.risks.length > 0);
    for (const risk of security.risks) {
      assert.equal((risk as unknown as Record<string, unknown>).score, undefined);
      assert.equal((risk as unknown as Record<string, unknown>).riskScore, undefined);
    }
  });

  test("likelihood/impact stay 'unknown' rather than being guessed", async () => {
    const { security } = await generateSecurityGovernance(apiMarkdown);
    for (const risk of security.risks) {
      assert.equal(risk.likelihood, "unknown");
      assert.equal(risk.impact, "unknown");
    }
  });
});

describe("Risk vs. information gap distinction", () => {
  test("an unresolved fact alone (no adverse condition) stays a gap, not a risk", async () => {
    const { security } = await generateSecurityGovernance(customerDataMarkdown);
    assert.ok(security.informationGaps.some((g) => g.topic === "Authentication provider"));
    assert.equal(security.risks.length, 0);
  });
});

describe("Referential integrity", () => {
  test("SecurityArchitecture and GovernancePlan validate cleanly for all 4 examples", async () => {
    for (const markdown of allExamples) {
      const { context, workflows, integrations, security, governance } = await generateSecurityGovernance(markdown);
      const securityResult = validateSecurityArchitecture(security, context.discoveryResult!, workflows, integrations);
      assert.deepEqual(securityResult.issues.filter((i) => i.severity === "error"), [], JSON.stringify(securityResult.issues));
      const governanceResult = validateGovernancePlan(governance, workflows);
      assert.deepEqual(governanceResult.issues.filter((i) => i.severity === "error"), [], JSON.stringify(governanceResult.issues));
    }
  });

  test("validator rejects a trust boundary with identical known source and target", async () => {
    const { context, workflows, integrations, security } = await generateSecurityGovernance(apiMarkdown);
    const original = security.trustBoundaries[0];
    const mutated = { ...security, trustBoundaries: [{ ...original, targetSystemId: original.sourceSystemId }] };
    const result = validateSecurityArchitecture(mutated, context.discoveryResult!, workflows, integrations);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "same-system-boundary"));
  });

  test("validator rejects a SecurityRequirement with no evidence", async () => {
    const { context, workflows, integrations, security } = await generateSecurityGovernance(apiMarkdown);
    const mutated = { ...security, requirements: [{ ...security.requirements[0], evidenceRefs: [] }] };
    const result = validateSecurityArchitecture(mutated, context.discoveryResult!, workflows, integrations);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.code === "no-evidence"));
  });
});

describe("Cross-capability dependency", () => {
  test("execute() reads workflow-automation and integrations sibling output via context.capabilityResults", async () => {
    const context = await makeContext(invoiceMarkdown);
    const workflows = await generateWorkflows(context);
    const integrations = await generateIntegrations(context, workflows);

    context.capabilityResults.push(
      {
        capabilityId: "workflow-automation",
        capabilityName: "Workflow Automation",
        status: "executed",
        success: true,
        output: { implemented: true, workflows, artifacts: [], notes: [] } satisfies WorkflowAutomationSection,
      },
      {
        capabilityId: "integrations",
        capabilityName: "Integrations",
        status: "executed",
        success: true,
        output: { implemented: true, integrations, artifacts: [], notes: [] } satisfies IntegrationsSection,
      }
    );

    const assessment = assessSecurityGovernance(context);
    const output = await securityGovernanceCapability.execute(assessment, context);
    assert.equal(output.implemented, true);
    assert.ok(output.security.requirements.length > 0);
    assert.ok(output.notes.some((n) => n.includes("Workflow Automation")));
    assert.ok(output.notes.some((n) => n.includes("Integration")));
  });

  test("execute() still produces a valid (draft) output when no sibling capability ran", async () => {
    const context = await makeContext(invoiceMarkdown);
    const assessment = assessSecurityGovernance(context);
    const output = await securityGovernanceCapability.execute(assessment, context);
    assert.equal(output.implemented, true);
    assert.deepEqual(output.security.risks, []);
  });
});

describe("Artifacts", () => {
  test("6 artifacts (3 JSON+Markdown pairs) are produced with expected sections", async () => {
    const { context, workflows, security, governance } = await generateSecurityGovernance(invoiceMarkdown);
    const artifacts = buildSecurityGovernanceArtifacts(security, governance, context.discoveryResult!, workflows);
    assert.equal(artifacts.length, 6);

    const paths = artifacts.map((a) => a.path);
    for (const expected of [
      "artifacts/security-governance/security-architecture.json",
      "artifacts/security-governance/security-architecture.md",
      "artifacts/security-governance/risk-register.json",
      "artifacts/security-governance/risk-register.md",
      "artifacts/security-governance/governance-plan.json",
      "artifacts/security-governance/governance-plan.md",
    ]) {
      assert.ok(paths.includes(expected), `missing artifact: ${expected}`);
    }

    const securityMd = artifacts.find((a) => a.path === "artifacts/security-governance/security-architecture.md")!.content as string;
    for (const heading of ["Scope", "Systems and Trust Boundaries", "Identity and Authentication", "Authorization", "Data Protection", "Integration Security", "Secrets", "Privacy Considerations", "Auditability", "Human Oversight", "Open Security Questions", "Traceability"]) {
      assert.ok(securityMd.includes(`## ${heading}`), `security-architecture.md missing section: ${heading}`);
    }

    const governanceMd = artifacts.find((a) => a.path === "artifacts/security-governance/governance-plan.md")!.content as string;
    for (const heading of ["Human Approval Controls", "Decision Controls", "Audit Requirements", "Privacy Considerations", "Compliance Considerations", "Unresolved Governance Questions", "Policies"]) {
      assert.ok(governanceMd.includes(`## ${heading}`), `governance-plan.md missing section: ${heading}`);
    }

    const securityJson = JSON.parse(artifacts.find((a) => a.path === "artifacts/security-governance/security-architecture.json")!.content as string);
    assert.equal(securityJson.version, security.version);
  });
});

describe("Traceability", () => {
  test("every evidence ref points to a real Discovery/workflow/integration entity", async () => {
    for (const markdown of allExamples) {
      const { context, workflows, integrations, security } = await generateSecurityGovernance(markdown);
      const knownIds = collectAllEntityIds(context.discoveryResult!);
      for (const w of workflows) knownIds.add(w.id);
      for (const w of workflows) for (const a of w.approvals) knownIds.add(a.id);
      for (const i of integrations) knownIds.add(i.id);
      for (const i of integrations) for (const c of i.dataContracts) knownIds.add(c.id);

      const allRefs = [
        ...security.requirements.flatMap((r) => r.evidenceRefs),
        ...security.trustBoundaries.flatMap((b) => b.evidenceRefs),
        ...security.risks.flatMap((r) => r.evidenceRefs),
      ];
      for (const ref of allRefs) {
        assert.ok(knownIds.has(ref.entityId), `${ref.entityType}/${ref.entityId} not found`);
      }
    }
  });
});

describe("Backward compatibility", () => {
  test("website capability is unaffected by security/governance generation changes", async () => {
    const context = await makeContext(appointmentMarkdown);
    assert.equal(websiteCapability.assess, undefined);
    assert.equal(websiteCapability.supports(context), true);
  });
});
