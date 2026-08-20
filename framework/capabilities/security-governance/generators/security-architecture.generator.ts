/**
 * Builds SecurityArchitecture from the already-generated solution
 * (DiscoveryResult + WorkflowDefinition[] + IntegrationDefinition[]).
 * Every requirement/boundary/risk cites real evidence; nothing here
 * outputs a generic checklist item (task item 2) — see
 * docs/architecture/ARCHITECTURE.md "Security, Governance and Risk
 * Architecture" for the full reasoning behind each rule below.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { RiskAssessment } from "../../../planning/risk-assessment/risk-assessment.types.js";
import { makeIdGenerator } from "../../../discovery/shared/section-lookup.js";
import type {
  SecurityArchitecture,
  SecurityRequirement,
  TrustBoundary,
  TrustBoundaryClassification,
  DataProtectionRequirement,
  IdentityAccessRequirement,
  IntegrationSecurityRequirement,
  AuditRequirement,
  InformationGapReference,
} from "../schemas/security-governance.types.js";

// ─── Identity / authorization language — scoped to already-structured
// business-rule/constraint text, never raw Markdown. Positive statements
// ("employees must sign in") become IdentityAccessRequirements; sources
// that say something is *unresolved* ("provider has not been selected")
// are routed to buildUnresolvedRequirements() instead, so we never phrase
// an admitted unknown as if it were a settled requirement. ───────────────

const IDENTITY_PATTERN = /\bsign[- ]?in\b|\blog[- ]?in\b|\bauthenticat|\bcredential\b/i;
const AUTHORIZATION_PATTERN = /\bonly\b[^.]*\bmay\b|\bauthoriz|\bpermission\b|\brole\b|\bmust not be visible\b/i;
const UNRESOLVED_PATTERN = /not (yet )?(been )?(selected|chosen|determined|decided|specified)|\bunknown\b|\bnot specified\b/i;

interface TextSource {
  id: string;
  description: string;
  entityType: "business-rule" | "constraint";
}

function collectTextSources(discovery: DiscoveryResult): TextSource[] {
  return [
    ...discovery.businessRules.map((r): TextSource => ({ id: r.id, description: r.description, entityType: "business-rule" })),
    ...discovery.constraints.map((c): TextSource => ({ id: c.id, description: c.description, entityType: "constraint" })),
  ];
}

function buildIdentityAccess(discovery: DiscoveryResult, nextId: () => string): IdentityAccessRequirement[] {
  const requirements: IdentityAccessRequirement[] = [];

  for (const source of collectTextSources(discovery)) {
    if (UNRESOLVED_PATTERN.test(source.description)) continue;

    const evidenceRefs: EvidenceReference[] = [{ entityType: source.entityType, entityId: source.id, description: source.description }];
    if (IDENTITY_PATTERN.test(source.description)) {
      requirements.push({ id: nextId(), kind: "identity", description: source.description, appliesTo: [], evidenceRefs });
    }
    if (AUTHORIZATION_PATTERN.test(source.description)) {
      requirements.push({ id: nextId(), kind: "authorization", description: source.description, appliesTo: [], evidenceRefs });
    }
  }

  return requirements;
}

const SECURITY_TEXT_PATTERN = /\bsecur|\bauthenticat|\bencrypt|\baccess\b|\bcredential\b|\bpassword\b/i;

/** Constraints that are both security-relevant AND explicitly unresolved become a review-priority SecurityRequirement + a fresh gap, rather than a settled requirement. */
function buildUnresolvedRequirements(
  discovery: DiscoveryResult,
  nextRequirementId: () => string,
  nextGapId: () => string
): { requirements: SecurityRequirement[]; newGaps: InformationGapReference[] } {
  const requirements: SecurityRequirement[] = [];
  const newGaps: InformationGapReference[] = [];

  const unresolvedSources = discovery.constraints.filter(
    (c) => UNRESOLVED_PATTERN.test(c.description) && SECURITY_TEXT_PATTERN.test(c.description)
  );

  for (const source of unresolvedSources) {
    const evidenceRefs: EvidenceReference[] = [{ entityType: "constraint", entityId: source.id, description: source.description }];
    const domain = IDENTITY_PATTERN.test(source.description) ? "identity" : "unknown";

    requirements.push({
      id: nextRequirementId(),
      domain,
      description: source.description,
      priority: "review",
      appliesTo: [],
      evidenceRefs,
      status: "needs-information",
    });

    const gapId = nextGapId();
    newGaps.push({
      gapId,
      topic: "Authentication provider",
      question: `What authentication provider or mechanism will be used? (source: "${source.description}")`,
      isNew: true,
    });
  }

  return { requirements, newGaps };
}

function classifyBoundary(targetSystem: DiscoveryResult["systems"][number] | undefined): TrustBoundaryClassification {
  if (!targetSystem) return "unknown";
  if (targetSystem.category === "saas" || targetSystem.category === "cloud-service") return "third-party";
  return "external";
}

function buildTrustBoundaries(
  integrations: IntegrationDefinition[],
  discovery: DiscoveryResult,
  nextId: () => string
): TrustBoundary[] {
  return integrations.map((integration) => {
    const targetSystem = integration.targetSystemId ? discovery.systems.find((s) => s.id === integration.targetSystemId) : undefined;
    return {
      id: nextId(),
      sourceSystemId: integration.sourceSystemId,
      targetSystemId: integration.targetSystemId,
      integrationId: integration.id,
      classification: classifyBoundary(targetSystem),
      dataContractIds: integration.dataContracts.map((c) => c.id),
      evidenceRefs: integration.evidenceRefs,
    };
  });
}

function buildDataProtection(
  discovery: DiscoveryResult,
  integrations: IntegrationDefinition[],
  nextId: () => string
): DataProtectionRequirement[] {
  const fromEntities: DataProtectionRequirement[] = discovery.dataEntities.map((entity) => ({
    id: nextId(),
    dataEntityIds: [entity.id],
    dataContractIds: [],
    classification: entity.sensitive ? "confidential" : "unknown",
    encryptionInTransit: "unknown",
    encryptionAtRest: "unknown",
    evidenceRefs: [{ entityType: "data-entity", entityId: entity.id, description: entity.name }],
  }));

  const fromContracts: DataProtectionRequirement[] = integrations.flatMap((integration) =>
    integration.dataContracts.map((contract) => ({
      id: nextId(),
      dataEntityIds: [] as string[],
      dataContractIds: [contract.id],
      classification: contract.sensitivity,
      encryptionInTransit: integration.security.encryptionInTransit,
      encryptionAtRest: "unknown" as const,
      evidenceRefs: contract.evidenceRefs,
    }))
  );

  return [...fromEntities, ...fromContracts];
}

/** Secrets + authorization-review requirements derived from each integration's own authentication/operations — task items 11/25. */
function buildIntegrationDerivedRequirements(
  integrations: IntegrationDefinition[],
  nextId: () => string
): SecurityRequirement[] {
  const requirements: SecurityRequirement[] = [];

  for (const integration of integrations) {
    const mechanism = integration.authentication?.mechanism;
    if (mechanism && mechanism !== "unknown" && mechanism !== "none") {
      requirements.push({
        id: nextId(),
        domain: "secrets",
        description: `Credentials for "${integration.purpose}" (mechanism: ${mechanism}) must not be embedded directly in generated application code or static configuration committed to source control.`,
        priority: "required",
        appliesTo: [{ entityType: "integration", entityId: integration.id }],
        evidenceRefs: integration.authentication?.evidenceRefs?.length ? integration.authentication.evidenceRefs : integration.evidenceRefs,
        status: "defined",
      });
    }

    const changesExternalState = integration.operations.some((op) =>
      op.type === "create" || op.type === "update" || op.type === "delete" || op.type === "submit"
    );
    if (changesExternalState) {
      requirements.push({
        id: nextId(),
        domain: "authorization",
        description: `Authorization for who may trigger "${integration.purpose}" operations should be defined before implementation.`,
        priority: "review",
        appliesTo: [{ entityType: "integration", entityId: integration.id }],
        evidenceRefs: integration.evidenceRefs,
        status: "needs-information",
      });
    }

    if (integration.targetSystemId) {
      requirements.push({
        id: nextId(),
        domain: "integration",
        description: `Interaction with the system behind "${integration.purpose}" crosses a trust boundary; requests and responses should be validated and protection requirements confirmed before implementation.`,
        priority: "review",
        appliesTo: [{ entityType: "integration", entityId: integration.id }, { entityType: "system", entityId: integration.targetSystemId }],
        evidenceRefs: integration.evidenceRefs,
        status: "defined",
      });
    }
  }

  return requirements;
}

/** Human-oversight requirement (SecurityArchitecture's own view of a WorkflowApproval — the GovernancePlan holds the complementary governance-control view of the same evidence). */
function buildHumanOversightRequirements(workflows: WorkflowDefinition[], nextId: () => string): SecurityRequirement[] {
  return workflows.flatMap((workflow) =>
    workflow.approvals.map((approval) => ({
      id: nextId(),
      domain: "human-oversight" as const,
      description: approval.approval.reason,
      priority: "required" as const,
      appliesTo: [{ entityType: "workflow" as const, entityId: workflow.id }, { entityType: "approval" as const, entityId: approval.id }],
      evidenceRefs: approval.evidenceRefs,
      status: "defined" as const,
    }))
  );
}

function buildIntegrationSecurityRollup(
  integrations: IntegrationDefinition[],
  requirements: SecurityRequirement[]
): IntegrationSecurityRequirement[] {
  return integrations
    .map((integration) => ({
      integrationId: integration.id,
      relatedSecurityRequirementIds: requirements
        .filter((r) => r.appliesTo.some((ref) => ref.entityType === "integration" && ref.entityId === integration.id))
        .map((r) => r.id),
      evidenceRefs: integration.evidenceRefs,
    }))
    .filter((rollup) => rollup.relatedSecurityRequirementIds.length > 0);
}

function buildAuditRequirements(workflows: WorkflowDefinition[], nextId: () => string): AuditRequirement[] {
  return workflows.flatMap((workflow) =>
    workflow.approvals.map((approval) => ({
      id: nextId(),
      description: `Approval decisions for "${approval.approval.reason}" should be auditable.`,
      appliesTo: [{ entityType: "workflow" as const, entityId: workflow.id }, { entityType: "approval" as const, entityId: approval.id }],
      evidenceRefs: approval.evidenceRefs,
    }))
  );
}

function buildRisks(
  discovery: DiscoveryResult,
  integrations: IntegrationDefinition[],
  trustBoundaries: TrustBoundary[],
  nextId: () => string
): RiskAssessment[] {
  const risks: RiskAssessment[] = [];
  const customerDataGap = discovery.informationGaps.find((g) => g.topic === "Customer data");
  const hasSensitiveData = discovery.dataEntities.some((d) => d.sensitive) || Boolean(customerDataGap);

  for (const integration of integrations) {
    const mechanism = integration.authentication?.mechanism;
    if (mechanism && mechanism !== "unknown" && mechanism !== "none") {
      risks.push({
        id: nextId(),
        category: "security",
        description: `Credential material for "${integration.purpose}" requires protection; improper handling could expose access to the target system.`,
        likelihood: "unknown",
        impact: "unknown",
        treatment: "mitigate",
        relatedArchitectureRefs: [{ entityType: "integration", entityId: integration.id }],
        evidenceRefs: integration.evidenceRefs,
        status: "open",
      });
    }

    const boundary = trustBoundaries.find((b) => b.integrationId === integration.id);
    if (boundary && (boundary.classification === "external" || boundary.classification === "third-party") && hasSensitiveData) {
      const evidenceRefs = [...integration.evidenceRefs];
      if (customerDataGap) evidenceRefs.push({ entityType: "information-gap", entityId: customerDataGap.id, description: customerDataGap.topic });

      risks.push({
        id: nextId(),
        category: "privacy",
        description: `Data associated with "${integration.purpose}" may cross a ${boundary.classification} boundary while its classification remains unresolved; exposure could result in a privacy issue.`,
        likelihood: "unknown",
        impact: "unknown",
        treatment: "review",
        relatedArchitectureRefs: [
          { entityType: "integration", entityId: integration.id },
          ...(integration.targetSystemId ? [{ entityType: "system" as const, entityId: integration.targetSystemId }] : []),
        ],
        evidenceRefs,
        status: "needs-review",
      });
    }
  }

  return risks;
}

function collectGapReferences(
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[],
  newGaps: InformationGapReference[]
): InformationGapReference[] {
  const referenced: InformationGapReference[] = [
    ...discovery.informationGaps
      .filter((g) => g.relatedCapabilityIds.includes("security-governance"))
      .map((g): InformationGapReference => ({ gapId: g.id, topic: g.topic, question: g.question, isNew: false })),
    ...workflows.flatMap((w) => w.informationGaps.map((g): InformationGapReference => ({ gapId: g.id, topic: g.topic, question: g.question, isNew: false }))),
    ...integrations.flatMap((i) => i.informationGaps.map((g): InformationGapReference => ({ gapId: g.id, topic: g.topic, question: g.question, isNew: false }))),
  ];

  const seen = new Set<string>();
  return [...referenced, ...newGaps].filter((ref) => (seen.has(ref.gapId) ? false : (seen.add(ref.gapId), true)));
}

export function buildSecurityArchitecture(
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[]
): SecurityArchitecture {
  const ids = {
    requirement: makeIdGenerator("SECREQ"),
    boundary: makeIdGenerator("BOUNDARY"),
    dataProtection: makeIdGenerator("DATAPROT"),
    identityAccess: makeIdGenerator("IAREQ"),
    audit: makeIdGenerator("AUDIT"),
    risk: makeIdGenerator("RISK"),
    gap: makeIdGenerator("SECGAP"),
  };

  const trustBoundaries = buildTrustBoundaries(integrations, discovery, ids.boundary);
  const dataProtection = buildDataProtection(discovery, integrations, ids.dataProtection);
  const identityAccess = buildIdentityAccess(discovery, ids.identityAccess);
  const { requirements: unresolvedRequirements, newGaps } = buildUnresolvedRequirements(discovery, ids.requirement, ids.gap);
  const integrationRequirements = buildIntegrationDerivedRequirements(integrations, ids.requirement);
  const oversightRequirements = buildHumanOversightRequirements(workflows, ids.requirement);
  const requirements = [...unresolvedRequirements, ...integrationRequirements, ...oversightRequirements];
  const integrationSecurity = buildIntegrationSecurityRollup(integrations, requirements);
  const auditRequirements = buildAuditRequirements(workflows, ids.audit);
  const risks = buildRisks(discovery, integrations, trustBoundaries, ids.risk);
  const informationGaps = collectGapReferences(discovery, workflows, integrations, newGaps);

  const statusReasons: string[] = [];
  if (requirements.some((r) => r.status === "needs-information")) statusReasons.push("some security requirements need more information");
  if (informationGaps.length > 0) statusReasons.push(`${informationGaps.length} unresolved information gap(s)`);
  if (trustBoundaries.some((b) => b.classification === "unknown")) statusReasons.push("some trust boundaries have unknown classification");

  const hasAnyArchitecture = trustBoundaries.length > 0 || dataProtection.length > 0 || identityAccess.length > 0 || requirements.length > 0;
  const status = !hasAnyArchitecture ? "draft" : statusReasons.length > 0 ? "needs-review" : "complete";

  return {
    version: "1.0",
    requirements,
    trustBoundaries,
    dataProtection,
    identityAccess,
    integrationSecurity,
    auditRequirements,
    risks,
    informationGaps,
    evidenceRefs: [...trustBoundaries.flatMap((b) => b.evidenceRefs), ...requirements.flatMap((r) => r.evidenceRefs)],
    status,
    statusReasons,
  };
}
