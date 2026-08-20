/**
 * Future-state half of the Modernization generator: MigrationConstraint,
 * strategy classification (MigrationCandidate/ModernizationStrategyOption),
 * TargetStateRequirement, ModernizationDelta, MigrationApproach,
 * MigrationValidationRequirement, and modernization risks. Every strategy
 * value is reachable only through an explicit keyword/pattern match —
 * nothing is ever chosen from "legacy"/"monolith"/"old" language alone.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { ModernizationNeed } from "../../../discovery/modernization/modernization-need.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { SecurityArchitecture } from "../../security-governance/schemas/security-governance.types.js";
import type { ObservabilityArchitecture } from "../../observability/schemas/observability.types.js";
import type { CloudArchitecture } from "../../cloud/schemas/cloud.types.js";
import type { RiskAssessment } from "../../../planning/risk-assessment/risk-assessment.types.js";
import type {
  MigrationConstraint,
  MigrationConstraintCategory,
  ModernizationStrategy,
  ModernizationStrategyOption,
  MigrationApproach,
  ModernizationDelta,
  MigrationCandidate,
  TargetStateRequirement,
  MigrationValidationRequirement,
  PreservationRequirement,
  SystemDependency,
} from "../schemas/modernization.types.js";

function needEvidence(need: ModernizationNeed, text?: string): EvidenceReference {
  return { entityType: "modernization-need", entityId: need.id, description: text };
}
function systemRef(id: string): ArchitectureReference {
  return { entityType: "system", entityId: id };
}
function deploymentUnitRef(id: string): ArchitectureReference {
  return { entityType: "deployment-unit", entityId: id };
}

// ─── Migration constraints (item 36) ────────────────────────────────────────

const CONSTRAINT_CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: MigrationConstraintCategory }> = [
  { pattern: /\bdowntime\b/i, category: "downtime" },
  { pattern: /\bcompatib/i, category: "compatibility" },
  { pattern: /\bdata migrat/i, category: "data-migration" },
  { pattern: /\brelease window\b|\bcutover\b/i, category: "release-window" },
  { pattern: /\bbudget\b|\bcost\b/i, category: "budget" },
  { pattern: /\bcontinuity\b/i, category: "business-continuity" },
  { pattern: /\bregulat|\bcomplian/i, category: "regulatory" },
  { pattern: /\bexternal\b/i, category: "external-dependency" },
  { pattern: /\btarget platform\b|\btechnology must\b/i, category: "target-platform" },
];

function classifyConstraintCategory(text: string): MigrationConstraintCategory {
  return CONSTRAINT_CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(text))?.category ?? "unknown";
}

export function buildMigrationConstraints(need: ModernizationNeed, discovery: DiscoveryResult, nextId: () => string): MigrationConstraint[] {
  return need.constraints.map((description) => {
    const relatedConstraint = discovery.constraints.find((c) => c.description === description);
    return {
      id: nextId(),
      category: classifyConstraintCategory(description),
      description,
      ...(relatedConstraint ? { relatedConstraintId: relatedConstraint.id } : {}),
      evidenceRefs: relatedConstraint ? [{ entityType: "constraint" as const, entityId: relatedConstraint.id, description }] : [needEvidence(need, description)],
    };
  });
}

// ─── Strategy classification — every enum value reachable only via an explicit pattern (items 26/28/29/30/31/80/81/82) ──

const FROM_TO_PATTERN = /\b(?:move|moving|migrat\w*)\s+(?:the\s+)?(?:application|system|\S+)?\s*from\s+([A-Za-z0-9][A-Za-z0-9.\s]*?)\s+to\s+([A-Za-z0-9][A-Za-z0-9.\s]*?)(?:\s+while|\s*[.,]|$)/i;
const REWRITE_PATTERN = /\brewrit(e|ten)\b|\bfrom scratch\b/i;
const RETIRE_PATTERN = /\bretir(e|ed|ement)\b|\bdecommission/i;
const REHOST_PATTERN = /\brehost/i;
const REFACTOR_PATTERN = /\brefactor/i;
const REARCHITECT_PATTERN = /\brearchitect/i;
const ENCAPSULATE_PATTERN = /\bencapsulat/i;
const REPLATFORM_KEYWORD_PATTERN = /\breplatform/i;
const RETAIN_PATTERN = /\b(?:will\s+be\s+)?retained?\b|\bno\s+(?:migration|modernization)\s+(?:is\s+)?(?:planned|needed|required)\b|\bkeep(?:ing)?\s+.*\bas.?is\b/i;

interface StrategyMatch {
  strategy: ModernizationStrategy;
  rationale: string;
  targetTechnology?: string;
  currentTechnology?: string;
}

function findStrategyMatches(text: string): StrategyMatch[] {
  const matches: StrategyMatch[] = [];

  const fromTo = text.match(FROM_TO_PATTERN);
  if (fromTo) {
    matches.push({ strategy: "replatform", rationale: text, currentTechnology: fromTo[1].trim(), targetTechnology: fromTo[2].trim() });
  }
  if (RETAIN_PATTERN.test(text)) matches.push({ strategy: "retain", rationale: text });
  if (REWRITE_PATTERN.test(text)) matches.push({ strategy: "replace", rationale: text });
  if (RETIRE_PATTERN.test(text)) matches.push({ strategy: "retire", rationale: text });
  if (REHOST_PATTERN.test(text)) matches.push({ strategy: "rehost", rationale: text });
  if (REFACTOR_PATTERN.test(text)) matches.push({ strategy: "refactor", rationale: text });
  if (REARCHITECT_PATTERN.test(text)) matches.push({ strategy: "rearchitect", rationale: text });
  if (ENCAPSULATE_PATTERN.test(text)) matches.push({ strategy: "encapsulate", rationale: text });
  if (!fromTo && REPLATFORM_KEYWORD_PATTERN.test(text)) matches.push({ strategy: "replatform", rationale: text });

  return matches;
}

const COEXIST_PATTERN = /\bcoexist/i;
const INCREMENTAL_PATTERN = /\bincremental\b/i;
const PARALLEL_PATTERN = /\bparallel run\b|\bparallel migration\b/i;
const BIG_BANG_PATTERN = /\bbig.bang\b/i;

function classifyApproach(text: string): MigrationApproach {
  if (COEXIST_PATTERN.test(text)) return "coexistence";
  if (INCREMENTAL_PATTERN.test(text)) return "incremental";
  if (PARALLEL_PATTERN.test(text)) return "parallel";
  if (BIG_BANG_PATTERN.test(text)) return "big-bang";
  return "unknown";
}

export function buildStrategyAndCandidates(
  need: ModernizationNeed,
  systemId: string,
  dependencies: SystemDependency[],
  preservationRequirements: PreservationRequirement[],
  nextCandidateId: () => string,
  nextDeltaId: () => string
): { candidate: MigrationCandidate; deltas: ModernizationDelta[] } {
  const allText = need.desiredOutcomes.join(" ");
  const strategyMatches = findStrategyMatches(allText);
  const evidenceRefs = [needEvidence(need, allText)];

  const deltas: ModernizationDelta[] = [];
  const strategyOptions: ModernizationStrategyOption[] = strategyMatches.map((m) => {
    if (m.targetTechnology && m.currentTechnology) {
      deltas.push({
        id: nextDeltaId(),
        systemId,
        category: "runtime",
        currentState: m.currentTechnology,
        targetState: m.targetTechnology,
        evidenceRefs,
      });
    }
    return {
      strategy: m.strategy,
      status: "explicit" as const,
      rationale: m.rationale,
      evidenceRefs,
      prerequisiteIds: [],
      riskIds: [],
    };
  });

  if (strategyOptions.length === 0 && need.desiredOutcomes.length > 0) {
    strategyOptions.push({
      strategy: "unknown",
      status: "needs-review",
      rationale: "Modernization intent is established but no specific strategy is evidenced.",
      evidenceRefs,
      prerequisiteIds: [],
      riskIds: [],
    });
  }

  const isRetained = strategyOptions.some((o) => o.strategy === "retain" && o.status === "explicit");
  const hasExplicitStrategy = strategyOptions.some((o) => o.status === "explicit" && o.strategy !== "retain");

  const status: MigrationCandidate["status"] = isRetained ? "retain" : hasExplicitStrategy ? "candidate" : strategyOptions.length > 0 ? "needs-review" : "needs-review";

  const dependencyIds = dependencies.filter((d) => d.sourceSystemId === systemId || d.targetSystemId === systemId).map((d) => d.id);
  const preservationIds = preservationRequirements.filter((p) => p.systemId === systemId).map((p) => p.id);

  return {
    candidate: {
      id: nextCandidateId(),
      systemId,
      status,
      driverIds: [],
      strategyOptions,
      approach: classifyApproach(allText),
      dependencyIds,
      preservationRequirementIds: preservationIds,
      riskIds: [],
      informationGapIds: [],
      evidenceRefs,
    },
    deltas,
  };
}

// ─── Target-state requirements — references Cloud/Security/Observability, never duplicates them (items 32/37/38/39/40) ──

export function buildTargetStateRequirements(
  deltas: ModernizationDelta[],
  systemId: string,
  systemName: string,
  dependencies: SystemDependency[],
  security: SecurityArchitecture,
  observability: ObservabilityArchitecture,
  cloud: CloudArchitecture | undefined,
  nextId: () => string
): TargetStateRequirement[] {
  const requirements: TargetStateRequirement[] = [];

  for (const delta of deltas) {
    requirements.push({
      id: nextId(),
      category: delta.category,
      description: `Target runtime: ${delta.targetState}.`,
      explicit: true,
      relatedSystemIds: [systemId],
      architectureRefs: [systemRef(systemId)],
      evidenceRefs: delta.evidenceRefs,
    });
  }

  if (cloud) {
    const matchingUnit = cloud.deploymentUnits.find((u) => u.name.toLowerCase().includes(systemName.toLowerCase()) || systemName.toLowerCase().includes(u.name.toLowerCase()));
    if (matchingUnit) {
      requirements.push({
        id: nextId(),
        category: "deployment",
        description: `Target deployment unit "${matchingUnit.name}" applies to this system per the generated Cloud architecture.`,
        explicit: cloud.status !== "draft",
        relatedSystemIds: [systemId],
        architectureRefs: [deploymentUnitRef(matchingUnit.id)],
        evidenceRefs: matchingUnit.evidenceRefs,
      });
    }
  }

  const relatedIntegrationIds = new Set(dependencies.filter((d) => d.sourceSystemId === systemId || d.targetSystemId === systemId).map((d) => d.integrationId).filter((id): id is string => Boolean(id)));

  for (const secReq of security.requirements) {
    const applies = secReq.appliesTo.some((a) => a.entityType === "integration" && relatedIntegrationIds.has(a.entityId));
    if (!applies) continue;
    requirements.push({
      id: nextId(),
      category: "security",
      description: `Security requirement must remain enforced after modernization: ${secReq.description}`,
      explicit: true,
      relatedSystemIds: [systemId],
      architectureRefs: secReq.appliesTo,
      evidenceRefs: secReq.evidenceRefs,
    });
  }

  for (const objective of observability.operationalObjectives) {
    if (!objective.explicit) continue;
    const applies = objective.target.some((t) => t.entityType === "integration" && relatedIntegrationIds.has(t.entityId));
    if (!applies) continue;
    requirements.push({
      id: nextId(),
      category: "observability",
      description: `Operational objective must remain satisfied after modernization: ${objective.name} (${objective.targetValue ?? "target unresolved"}).`,
      explicit: true,
      relatedSystemIds: [systemId],
      architectureRefs: objective.target,
      evidenceRefs: objective.evidenceRefs,
    });
  }

  return requirements;
}

// ─── Validation requirements — one per preservation obligation, no fabricated criteria (item 46/105) ──

const VALIDATION_TYPE_MAP: Record<PreservationRequirement["type"], MigrationValidationRequirement["type"]> = {
  "business-behavior": "behavior",
  "business-rule": "behavior",
  "integration-contract": "integration",
  data: "data",
  security: "security",
  operational: "operational",
  "user-experience": "unknown",
  compatibility: "compatibility",
  unknown: "unknown",
};

export function buildValidationRequirements(preservationRequirements: PreservationRequirement[], nextId: () => string): MigrationValidationRequirement[] {
  return preservationRequirements.map((p) => ({
    id: nextId(),
    type: VALIDATION_TYPE_MAP[p.type],
    description: `Validate that: ${p.description}`,
    preservationRequirementIds: [p.id],
    evidenceRefs: p.evidenceRefs,
  }));
}

// ─── Risks — exactly two deterministic, evidence-required rules, not a checklist (items 42-45) ──

export function buildModernizationRisks(dependencies: SystemDependency[], candidates: MigrationCandidate[], nextId: () => string): RiskAssessment[] {
  const risks: RiskAssessment[] = [];

  const databaseTargets = new Map<string, SystemDependency[]>();
  for (const dep of dependencies) {
    if (dep.type !== "database") continue;
    databaseTargets.set(dep.targetSystemId, [...(databaseTargets.get(dep.targetSystemId) ?? []), dep]);
  }
  for (const [targetSystemId, deps] of databaseTargets) {
    if (deps.length < 2) continue;
    risks.push({
      id: nextId(),
      category: "modernization",
      description: `Multiple systems directly depend on the same database (system "${targetSystemId}"); decomposition or migration could affect shared consumers.`,
      likelihood: "unknown",
      impact: "unknown",
      treatment: "review",
      relatedArchitectureRefs: [systemRef(targetSystemId), ...deps.map((d) => systemRef(d.sourceSystemId))],
      evidenceRefs: deps.flatMap((d) => d.evidenceRefs),
      status: "needs-review",
    });
  }

  for (const candidate of candidates) {
    if (candidate.approach !== "coexistence") continue;
    risks.push({
      id: nextId(),
      category: "modernization",
      description: `Running current and modernized versions of system "${candidate.systemId}" concurrently introduces state/data-consistency risk during the coexistence window.`,
      likelihood: "unknown",
      impact: "unknown",
      treatment: "review",
      relatedArchitectureRefs: [systemRef(candidate.systemId)],
      evidenceRefs: candidate.evidenceRefs,
      status: "needs-review",
    });
  }

  return risks;
}
