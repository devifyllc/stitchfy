/**
 * Orchestrates the profile/strategy/roadmap generators into a full
 * ModernizationArchitecture, computes materially-gated information gaps
 * (item 71 — not a blanket checklist), and the draft/needs-review/complete
 * status.
 */

import { makeIdGenerator } from "../../../discovery/shared/section-lookup.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { SecurityArchitecture } from "../../security-governance/schemas/security-governance.types.js";
import type { ObservabilityArchitecture } from "../../observability/schemas/observability.types.js";
import type { CloudArchitecture } from "../../cloud/schemas/cloud.types.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import type { ModernizationArchitecture, MigrationCandidate, SystemDependency, PreservationRequirement } from "../schemas/modernization.types.js";
import { buildSystemProfiles, buildSystemDependencies, buildTechnicalDebt, buildPreservationRequirements, buildModernizationSeams } from "./modernization-profile.generator.js";
import { buildMigrationConstraints, buildStrategyAndCandidates, buildTargetStateRequirements, buildValidationRequirements, buildModernizationRisks } from "./migration-strategy.generator.js";
import { buildModernizationRoadmap } from "./modernization-roadmap.generator.js";

const ROLLBACK_PATTERN = /\brollback\b/i;

function buildInformationGaps(
  discovery: DiscoveryResult,
  candidates: MigrationCandidate[],
  dependencies: SystemDependency[],
  preservationRequirements: PreservationRequirement[],
  hasIntegrationBoundary: (systemId: string) => boolean,
  allText: string,
  nextId: () => string
): InformationGap[] {
  const gaps: InformationGap[] = [];
  const inScopeCandidates = candidates.filter((c) => c.status !== "retain" && c.status !== "blocked");

  for (const candidate of inScopeCandidates) {
    const system = discovery.systems.find((s) => s.id === candidate.systemId);
    if (!system) continue;

    if (!discovery.processes.some((p) => p.systemIds.includes(system.id))) {
      gaps.push({ id: nextId(), topic: "Process dependency", question: `Which business processes depend on system "${system.name}"?`, importance: "medium", blocking: false, relatedCapabilityIds: ["modernization"] });
    }
    if (!system.owner) {
      gaps.push({ id: nextId(), topic: "System ownership", question: `Who owns system "${system.name}"?`, importance: "medium", blocking: false, relatedCapabilityIds: ["modernization"] });
    }
    if (!candidate.strategyOptions.some((o) => o.status === "explicit" && o.strategy !== "retain")) {
      gaps.push({ id: nextId(), topic: "Target runtime", question: `Is the target runtime already selected for system "${system.name}"?`, importance: "high", blocking: false, relatedCapabilityIds: ["modernization"] });
    }
    if (hasIntegrationBoundary(system.id) && !preservationRequirements.some((p) => p.systemId === system.id && p.type === "integration-contract")) {
      gaps.push({ id: nextId(), topic: "External contract compatibility", question: `Which external contracts must remain backward compatible for system "${system.name}"?`, importance: "high", blocking: false, relatedCapabilityIds: ["modernization"] });
    }
    const dbDependency = dependencies.find((d) => (d.sourceSystemId === system.id || d.targetSystemId === system.id) && d.type === "database");
    if (dbDependency && !preservationRequirements.some((p) => p.systemId === system.id && p.type === "data")) {
      gaps.push({ id: nextId(), topic: "Data migration", question: `Does persistent data for system "${system.name}" need to migrate?`, importance: "high", blocking: false, relatedCapabilityIds: ["modernization"] });
    }
    if (candidate.approach === "unknown") {
      gaps.push({ id: nextId(), topic: "Migration approach", question: `Can old and new versions of system "${system.name}" coexist, or is a different approach required?`, importance: "medium", blocking: false, relatedCapabilityIds: ["modernization"] });
    }
    if (!ROLLBACK_PATTERN.test(allText)) {
      gaps.push({ id: nextId(), topic: "Rollback requirement", question: `What rollback requirement applies to system "${system.name}"'s migration?`, importance: "medium", blocking: false, relatedCapabilityIds: ["modernization"] });
    }
    if (candidate.status === "candidate") {
      gaps.push({ id: nextId(), topic: "Validation criteria", question: `What validation criteria define behavioral equivalence for system "${system.name}" after migration?`, importance: "high", blocking: false, relatedCapabilityIds: ["modernization"] });
    }
  }

  // Shared-database dependency with unclear ownership, when it doesn't already qualify as a risk (item 44).
  const dbTargets = new Map<string, SystemDependency[]>();
  for (const dep of dependencies) {
    if (dep.type !== "database") continue;
    dbTargets.set(dep.targetSystemId, [...(dbTargets.get(dep.targetSystemId) ?? []), dep]);
  }
  for (const [targetSystemId, deps] of dbTargets) {
    if (deps.length !== 1) continue; // >=2 becomes a risk instead, see migration-strategy.generator.ts
    const targetSystem = discovery.systems.find((s) => s.id === targetSystemId);
    gaps.push({ id: nextId(), topic: "Data ownership", question: `Which system is authoritative for the data in "${targetSystem?.name ?? targetSystemId}"?`, importance: "low", blocking: false, relatedCapabilityIds: ["modernization"] });
  }

  return gaps;
}

export function buildModernizationArchitecture(
  discovery: DiscoveryResult,
  integrations: IntegrationDefinition[],
  security: SecurityArchitecture,
  observability: ObservabilityArchitecture,
  cloud: CloudArchitecture | undefined
): ModernizationArchitecture {
  const ids = {
    profile: makeIdGenerator("MODPROFILE"),
    dependency: makeIdGenerator("DEPEND"),
    debt: makeIdGenerator("DEBT"),
    preservation: makeIdGenerator("PRESERVE"),
    seam: makeIdGenerator("SEAM"),
    constraint: makeIdGenerator("MIGCONSTRAINT"),
    candidate: makeIdGenerator("CANDIDATE"),
    delta: makeIdGenerator("DELTA"),
    target: makeIdGenerator("TARGETSTATE"),
    validation: makeIdGenerator("VALIDATE"),
    risk: makeIdGenerator("MODRISK"),
    workstream: makeIdGenerator("WORKSTREAM"),
    gap: makeIdGenerator("MODGAP"),
  };

  const need = discovery.modernizationNeeds[0];

  if (!need) {
    return {
      version: "1.0",
      profiles: [],
      dependencies: [],
      technicalDebt: [],
      preservationRequirements: [],
      seams: [],
      migrationConstraints: [],
      migrationCandidates: [],
      modernizationDeltas: [],
      targetStateRequirements: [],
      validationRequirements: [],
      risks: [],
      roadmap: { candidateIds: [], workstreams: [], dependencies: [], validationRequirementIds: [], informationGapIds: [], status: "draft" },
      informationGaps: [],
      evidenceRefs: [],
      codebaseEvidenceConflicts: [],
      status: "draft",
      statusReasons: ["no modernization need identified"],
    };
  }

  const inScopeSystemIds = new Set(need.systemIds);

  const profiles = buildSystemProfiles(need, discovery.systems, ids.profile);
  const dependencies = buildSystemDependencies(integrations, inScopeSystemIds, ids.dependency);
  const technicalDebt = buildTechnicalDebt(need, discovery.systems, ids.debt);
  const preservationRequirements = buildPreservationRequirements(need, discovery.systems, dependencies, security, observability, ids.preservation);
  const seams = buildModernizationSeams(dependencies, integrations, ids.seam);
  const migrationConstraints = buildMigrationConstraints(need, discovery, ids.constraint);

  const migrationCandidates: MigrationCandidate[] = [];
  const modernizationDeltas = [];
  const targetStateRequirements = [];

  for (const systemId of need.systemIds) {
    const system = discovery.systems.find((s) => s.id === systemId);
    const { candidate, deltas } = buildStrategyAndCandidates(need, systemId, dependencies, preservationRequirements, ids.candidate, ids.delta);
    migrationCandidates.push(candidate);
    modernizationDeltas.push(...deltas);
    targetStateRequirements.push(...buildTargetStateRequirements(deltas, systemId, system?.name ?? "", dependencies, security, observability, cloud, ids.target));
  }

  const validationRequirements = buildValidationRequirements(preservationRequirements, ids.validation);
  const risks = buildModernizationRisks(dependencies, migrationCandidates, ids.risk);

  // Wire risk ids back onto their originating candidate (system-scoped only).
  for (const candidate of migrationCandidates) {
    candidate.riskIds = risks.filter((r) => r.relatedArchitectureRefs.some((ref) => ref.entityType === "system" && ref.entityId === candidate.systemId)).map((r) => r.id);
  }

  for (const profile of profiles) {
    profile.technicalDebtIds = technicalDebt.filter((t) => t.systemId === profile.systemId).map((t) => t.id);
    profile.dependencyIds = dependencies.filter((d) => d.sourceSystemId === profile.systemId || d.targetSystemId === profile.systemId).map((d) => d.id);
    profile.preservationRequirementIds = preservationRequirements.filter((p) => p.systemId === profile.systemId).map((p) => p.id);
    profile.constraintIds = migrationConstraints.map((c) => c.id);
    const candidate = migrationCandidates.find((c) => c.systemId === profile.systemId);
    profile.status = candidate ? (candidate.status as typeof profile.status) : "needs-review";
  }

  const hasIntegrationBoundary = (systemId: string) => dependencies.some((d) => d.sourceSystemId === systemId || d.targetSystemId === systemId);
  const allText = [...need.desiredOutcomes, ...need.preservationNeeds, ...need.constraints].join(" ");

  const informationGaps = buildInformationGaps(discovery, migrationCandidates, dependencies, preservationRequirements, hasIntegrationBoundary, allText, ids.gap);

  const roadmap = buildModernizationRoadmap(migrationCandidates, validationRequirements, informationGaps, ids.workstream);

  const statusReasons: string[] = [];
  if (informationGaps.length > 0) statusReasons.push(`${informationGaps.length} unresolved information gap(s)`);
  if (migrationCandidates.some((c) => c.status === "needs-review")) statusReasons.push("one or more candidates have no evidenced strategy");

  const hasAnyArchitecture = profiles.length > 0;
  const status: ModernizationArchitecture["status"] = !hasAnyArchitecture ? "draft" : statusReasons.length > 0 ? "needs-review" : "complete";

  const evidenceRefs = [{ entityType: "modernization-need" as const, entityId: need.id, description: need.desiredOutcomes[0] }];

  return {
    version: "1.0",
    profiles,
    dependencies,
    technicalDebt,
    preservationRequirements,
    seams,
    migrationConstraints,
    migrationCandidates,
    modernizationDeltas,
    targetStateRequirements,
    validationRequirements,
    risks,
    roadmap,
    informationGaps,
    evidenceRefs,
    codebaseEvidenceConflicts: [],
    status,
    statusReasons,
  };
}
