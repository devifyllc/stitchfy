/**
 * Builds GovernancePlan from the same solution inputs as
 * security-architecture.generator.ts. Human oversight and decision
 * controls reuse the existing HITL model (WorkflowApproval/WorkflowDecision)
 * rather than a competing approval domain (task item 19). Compliance stays
 * restrained: "explicit" only on an exact framework-name match against
 * already-structured text; "potential" only when sensitive/unresolved data
 * meets an external boundary (task items 14/15).
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import { makeIdGenerator } from "../../../discovery/shared/section-lookup.js";
import type {
  GovernancePlan,
  GovernanceApprovalControl,
  DecisionControl,
  GovernancePolicy,
  ComplianceConsideration,
  SecurityArchitecture,
} from "../schemas/security-governance.types.js";

const FRAMEWORK_PATTERNS: Array<{ pattern: RegExp; framework: string }> = [
  { pattern: /\bPCI[ -]?DSS\b/i, framework: "PCI DSS" },
  { pattern: /\bHIPAA\b/i, framework: "HIPAA" },
  { pattern: /\bSOC ?2\b/i, framework: "SOC 2" },
  { pattern: /\bGDPR\b/i, framework: "GDPR" },
  { pattern: /\bCCPA\b/i, framework: "CCPA" },
  { pattern: /\bCOPPA\b/i, framework: "COPPA" },
  { pattern: /\bPIPEDA\b/i, framework: "PIPEDA" },
  { pattern: /\bISO ?27001\b/i, framework: "ISO 27001" },
  { pattern: /\bHITECH\b/i, framework: "HITECH" },
];

function findExplicitCompliance(discovery: DiscoveryResult, nextId: () => string): ComplianceConsideration[] {
  const sources: Array<{ text: string; ref: EvidenceReference }> = [
    ...discovery.businessRules.map((r) => ({ text: r.description, ref: { entityType: "business-rule" as const, entityId: r.id, description: r.description } })),
    ...discovery.constraints.map((c) => ({ text: c.description, ref: { entityType: "constraint" as const, entityId: c.id, description: c.description } })),
    ...discovery.requirements.map((r) => ({ text: r.description, ref: { entityType: "requirement" as const, entityId: r.id, description: r.description } })),
    ...discovery.desiredOutcomes.map((o) => ({ text: o.description, ref: { entityType: "outcome" as const, entityId: o.id, description: o.description } })),
  ];

  const byFramework = new Map<string, ComplianceConsideration>();
  for (const source of sources) {
    for (const { pattern, framework } of FRAMEWORK_PATTERNS) {
      if (!pattern.test(source.text)) continue;
      const existing = byFramework.get(framework);
      if (existing) {
        existing.evidenceRefs.push(source.ref);
      } else {
        byFramework.set(framework, {
          id: nextId(),
          framework,
          status: "explicit",
          rationale: `Explicitly stated: "${source.text}"`,
          evidenceRefs: [source.ref],
        });
      }
    }
  }

  return [...byFramework.values()];
}

/** Never assigns a specific framework — a generic privacy-review flag only (task item 15's own worked example). */
function findPotentialCompliance(
  discovery: DiscoveryResult,
  securityArchitecture: SecurityArchitecture,
  nextId: () => string
): ComplianceConsideration[] {
  const customerDataGap = discovery.informationGaps.find((g) => g.topic === "Customer data");
  const hasSensitiveData = discovery.dataEntities.some((d) => d.sensitive) || Boolean(customerDataGap);
  const matchingBoundaries = securityArchitecture.trustBoundaries.filter(
    (b) => b.classification === "external" || b.classification === "third-party"
  );

  if (!hasSensitiveData || matchingBoundaries.length === 0) return [];

  const evidenceRefs: EvidenceReference[] = [];
  if (customerDataGap) evidenceRefs.push({ entityType: "information-gap", entityId: customerDataGap.id, description: customerDataGap.topic });
  for (const entity of discovery.dataEntities.filter((d) => d.sensitive)) {
    evidenceRefs.push({ entityType: "data-entity", entityId: entity.id, description: entity.name });
  }

  const classifications = new Set(matchingBoundaries.map((b) => b.classification));
  const soleClassification = [...classifications][0];
  const boundaryPhrase =
    classifications.size > 1
      ? "an external or third-party boundary"
      : `${soleClassification === "external" ? "an" : "a"} ${soleClassification} boundary`;

  return [
    {
      id: nextId(),
      status: "potential",
      rationale: `Customer or business data may cross ${boundaryPhrase}; privacy requirements should be reviewed.`,
      evidenceRefs,
    },
  ];
}

function buildHumanOversight(workflows: WorkflowDefinition[], nextId: () => string): GovernanceApprovalControl[] {
  return workflows.flatMap((workflow) =>
    workflow.approvals.map((approval) => ({
      id: nextId(),
      description: approval.approval.reason,
      workflowId: workflow.id,
      approvalId: approval.id,
      appliesTo: [
        { entityType: "workflow" as const, entityId: workflow.id },
        { entityType: "approval" as const, entityId: approval.id },
      ],
      evidenceRefs: approval.evidenceRefs,
    }))
  );
}

function buildDecisionControls(workflows: WorkflowDefinition[], nextId: () => string): DecisionControl[] {
  return workflows.flatMap((workflow) =>
    workflow.decisions.map((decision) => ({
      id: nextId(),
      description: `The decision "${decision.condition}" must remain deterministic and traceable to its source evidence.`,
      decisionId: decision.id,
      appliesTo: [
        { entityType: "workflow-step" as const, entityId: decision.stepId },
        { entityType: "workflow" as const, entityId: workflow.id },
      ],
      evidenceRefs: decision.evidenceRefs,
    }))
  );
}

function buildPolicies(discovery: DiscoveryResult, nextId: () => string): GovernancePolicy[] {
  return discovery.businessRules.map((rule) => ({
    id: nextId(),
    description: rule.description,
    appliesTo: rule.relatedProcessIds.map((id) => ({ entityType: "process" as const, entityId: id })),
    evidenceRefs: [{ entityType: "business-rule" as const, entityId: rule.id, description: rule.description }],
  }));
}

export function buildGovernancePlan(
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  securityArchitecture: SecurityArchitecture
): GovernancePlan {
  const ids = {
    control: makeIdGenerator("GOVCTRL"),
    decision: makeIdGenerator("DECCTRL"),
    policy: makeIdGenerator("POLICY"),
    compliance: makeIdGenerator("COMPLY"),
  };

  const humanOversight = buildHumanOversight(workflows, ids.control);
  const decisionControls = buildDecisionControls(workflows, ids.decision);
  const policies = buildPolicies(discovery, ids.policy);
  const complianceConsiderations = [
    ...findExplicitCompliance(discovery, ids.compliance),
    ...findPotentialCompliance(discovery, securityArchitecture, ids.compliance),
  ];

  const informationGaps = securityArchitecture.informationGaps.map((g) => g.gapId);

  const hasGenericApprover = workflows.some((w) => w.approvals.some((a) => a.approval.approverRole === "designated approver"));
  const statusReasons: string[] = [];
  if (hasGenericApprover) statusReasons.push("some approvals have an unresolved approver role");
  if (complianceConsiderations.some((c) => c.status === "potential")) statusReasons.push("potential compliance considerations require review");
  if (informationGaps.length > 0) statusReasons.push(`${informationGaps.length} unresolved information gap(s)`);

  const hasAnyGovernance = humanOversight.length > 0 || decisionControls.length > 0 || policies.length > 0;
  const status = !hasAnyGovernance ? "draft" : statusReasons.length > 0 ? "needs-review" : "complete";

  return {
    policies,
    humanOversight,
    auditRequirements: securityArchitecture.auditRequirements,
    decisionControls,
    complianceConsiderations,
    informationGaps,
    status,
  };
}
