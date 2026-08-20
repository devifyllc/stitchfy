/**
 * Current-state half of the Modernization generator: SystemModernizationProfile,
 * SystemDependency, TechnicalDebtItem, PreservationRequirement, ModernizationSeam.
 * Every fact here is either reused from a real Phase 1/4/5/7A object or
 * derived from an explicit ModernizationNeed bullet — nothing is inferred
 * from technology "looking old" (no lifecycle/vulnerability invention).
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { ModernizationNeed } from "../../../discovery/modernization/modernization-need.types.js";
import type { SystemInventoryItem } from "../../../discovery/systems/system-inventory.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { SecurityArchitecture } from "../../security-governance/schemas/security-governance.types.js";
import type { ObservabilityArchitecture } from "../../observability/schemas/observability.types.js";
import type {
  SystemModernizationProfile,
  SystemLifecycleStatus,
  SystemDependency,
  SystemDependencyType,
  TechnicalDebtItem,
  TechnicalDebtCategory,
  PreservationRequirement,
} from "../schemas/modernization.types.js";

function needEvidence(need: ModernizationNeed, text?: string): EvidenceReference {
  return { entityType: "modernization-need", entityId: need.id, description: text };
}
function systemRef(id: string): ArchitectureReference {
  return { entityType: "system", entityId: id };
}
function integrationRef(id: string): ArchitectureReference {
  return { entityType: "integration", entityId: id };
}

// ─── Lifecycle — explicit language only, never a version string (item 12) ──

const UNSUPPORTED_PATTERN = /\bno longer supported\b|\bunsupported\b|\bout of support\b/i;
const END_OF_LIFE_PATTERN = /\bend.of.life\b|\bEOL\b/i;
const SUPPORTED_PATTERN = /\bcurrently supported\b|\bsupported by the vendor\b|\bin support\b/i;

function classifyLifecycle(text: string): SystemLifecycleStatus {
  if (END_OF_LIFE_PATTERN.test(text)) return "end-of-life";
  if (UNSUPPORTED_PATTERN.test(text)) return "unsupported";
  if (SUPPORTED_PATTERN.test(text)) return "supported";
  return "unknown";
}

export function buildSystemProfiles(need: ModernizationNeed, systems: SystemInventoryItem[], nextId: () => string): SystemModernizationProfile[] {
  return need.systemIds.map((systemId) => {
    const system = systems.find((s) => s.id === systemId);
    return {
      id: nextId(),
      systemId,
      modernizationNeedIds: [need.id],
      role: system?.purpose || system?.category || "",
      lifecycleStatus: system ? classifyLifecycle(system.purpose) : "unknown",
      modernizationDrivers: need.drivers,
      technicalDebtIds: [],
      dependencyIds: [],
      preservationRequirementIds: [],
      constraintIds: [],
      evidenceRefs: [needEvidence(need)],
      status: "needs-review",
    };
  });
}

// ─── Dependencies — only from real IntegrationDefinitions (items 15/16/17/18/19) ──

function classifyDependencyType(integration: IntegrationDefinition): SystemDependencyType {
  if (integration.interactionPattern === "database" || integration.protocol === "jdbc") return "database";
  if (integration.interactionPattern === "file-transfer") return "file";
  if (integration.interactionPattern === "webhook" || integration.interactionPattern === "event") return "messaging";
  if (integration.interactionPattern === "manual") return "manual";
  if (integration.interactionPattern === "request-response") return "api";
  return "unknown";
}

export function buildSystemDependencies(integrations: IntegrationDefinition[], inScopeSystemIds: Set<string>, nextId: () => string): SystemDependency[] {
  const dependencies: SystemDependency[] = [];

  for (const integration of integrations) {
    if (!integration.sourceSystemId || !integration.targetSystemId) continue;
    if (!inScopeSystemIds.has(integration.sourceSystemId) && !inScopeSystemIds.has(integration.targetSystemId)) continue;

    dependencies.push({
      id: nextId(),
      sourceSystemId: integration.sourceSystemId,
      targetSystemId: integration.targetSystemId,
      type: classifyDependencyType(integration),
      direction: integration.direction,
      integrationId: integration.id,
      description: integration.purpose,
      evidenceRefs: integration.evidenceRefs,
    });
  }

  return dependencies;
}

// ─── Technical debt — explicit bullets only, systemId resolved only when unambiguous (item 13) ──

const DEBT_CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: TechnicalDebtCategory }> = [
  { pattern: /\btest(ing)?\b|\bno automated tests?\b/i, category: "testing" },
  { pattern: /\bdeploy/i, category: "deployment" },
  { pattern: /\bobservab|\bmonitor|\blogging\b/i, category: "observability" },
  { pattern: /\bsecur/i, category: "security" },
  { pattern: /\bintegrat/i, category: "integration" },
  { pattern: /\bdata\b/i, category: "data" },
  { pattern: /\bdependenc/i, category: "dependencies" },
  { pattern: /\bplatform\b|\bapplication.server\b|\bruntime\b/i, category: "platform" },
  { pattern: /\bmanual\b/i, category: "manual-process" },
  { pattern: /\barchitectur|\bmonolith/i, category: "architecture" },
  { pattern: /\bmaintain/i, category: "maintainability" },
];

const HIGH_IMPACT_PATTERN = /\bcritical\b|\bsevere\b|\bsignificant\b/i;
const LOW_IMPACT_PATTERN = /\bminor\b|\bsmall\b|\blow.impact\b/i;

function classifyDebtCategory(text: string): TechnicalDebtCategory {
  return DEBT_CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(text))?.category ?? "unknown";
}

export function buildTechnicalDebt(need: ModernizationNeed, systems: SystemInventoryItem[], nextId: () => string): TechnicalDebtItem[] {
  if (need.technicalDebtSignals.length === 0) return [];

  const inScopeSystems = systems.filter((s) => need.systemIds.includes(s.id));

  const items: TechnicalDebtItem[] = [];
  for (const bullet of need.technicalDebtSignals) {
    const mentioned = inScopeSystems.filter((s) => bullet.toLowerCase().includes(s.name.toLowerCase()));
    const systemId = mentioned.length === 1 ? mentioned[0].id : inScopeSystems.length === 1 ? inScopeSystems[0].id : undefined;
    if (!systemId) continue; // ambiguous system scope — surfaced as an information gap instead of guessed

    items.push({
      id: nextId(),
      systemId,
      category: classifyDebtCategory(bullet),
      description: bullet,
      impact: HIGH_IMPACT_PATTERN.test(bullet) ? "high" : LOW_IMPACT_PATTERN.test(bullet) ? "low" : "unknown",
      evidenceRefs: [needEvidence(need, bullet)],
    });
  }
  return items;
}

// ─── Preservation — explicit preservation-language bullets + real cross-capability references (items 21/22/39/40/41) ──

const BEHAVIOR_PATTERN = /\bbusiness behavior\b|\bbehavior\b/i;
const COMPATIBILITY_PATTERN = /\bcompatible\b|\bcompatibility\b/i;
const DATA_PATTERN = /\bdatabase\b|\bdata\b/i;
const SECURITY_PATTERN = /\bsecur|\bauthenticat|\bauthoriz|\bencrypt/i;
const OPERATIONAL_PATTERN = /\bavailab|\bperformance\b|\buptime\b|\bmonitor|\bobservab/i;

function classifyPreservationType(text: string, relatedIntegration: boolean): PreservationRequirement["type"] {
  if (SECURITY_PATTERN.test(text)) return "security";
  if (OPERATIONAL_PATTERN.test(text)) return "operational";
  if (relatedIntegration || (COMPATIBILITY_PATTERN.test(text) && /\bintegrat/i.test(text))) return "integration-contract";
  if (DATA_PATTERN.test(text)) return "data";
  if (BEHAVIOR_PATTERN.test(text)) return "business-behavior";
  if (COMPATIBILITY_PATTERN.test(text)) return "compatibility";
  return "unknown";
}

export function buildPreservationRequirements(
  need: ModernizationNeed,
  systems: SystemInventoryItem[],
  dependencies: SystemDependency[],
  security: SecurityArchitecture,
  observability: ObservabilityArchitecture,
  nextId: () => string
): PreservationRequirement[] {
  const inScopeSystems = systems.filter((s) => need.systemIds.includes(s.id));
  const requirements: PreservationRequirement[] = [];

  for (const bullet of need.preservationNeeds) {
    const mentionedDependency = dependencies.find((d) => bullet.toLowerCase().includes((systems.find((s) => s.id === d.targetSystemId)?.name ?? "___").toLowerCase()));
    const mentionedSystems = inScopeSystems.filter((s) => bullet.toLowerCase().includes(s.name.toLowerCase()));
    const systemId = mentionedSystems.length >= 1 ? mentionedSystems[0].id : inScopeSystems.length === 1 ? inScopeSystems[0].id : undefined;
    if (!systemId) continue; // ambiguous system scope — never guessed

    const sourceArchitectureRefs: ArchitectureReference[] = [systemRef(systemId)];
    if (mentionedDependency?.integrationId) sourceArchitectureRefs.push(integrationRef(mentionedDependency.integrationId));

    const type = classifyPreservationType(bullet, Boolean(mentionedDependency));

    const relatedSecurityRequirementIds =
      type === "security" && mentionedDependency?.integrationId
        ? security.requirements.filter((r) => r.appliesTo.some((a) => a.entityType === "integration" && a.entityId === mentionedDependency.integrationId)).map((r) => r.id)
        : undefined;
    const relatedObservabilityObjectiveIds =
      type === "operational" && mentionedDependency?.integrationId
        ? observability.operationalObjectives.filter((o) => o.target.some((t) => t.entityType === "integration" && t.entityId === mentionedDependency.integrationId)).map((o) => o.id)
        : undefined;

    requirements.push({
      id: nextId(),
      systemId,
      type,
      description: bullet,
      sourceArchitectureRefs,
      evidenceRefs: [needEvidence(need, bullet)],
      ...(relatedSecurityRequirementIds?.length ? { relatedSecurityRequirementIds } : {}),
      ...(relatedObservabilityObjectiveIds?.length ? { relatedObservabilityObjectiveIds } : {}),
    });
  }

  return requirements;
}

// ─── Seams — one per real integration touching an in-scope system (items 23/24/54) ──

export function buildModernizationSeams(dependencies: SystemDependency[], integrations: IntegrationDefinition[], nextId: () => string) {
  const seams = [];
  for (const dependency of dependencies) {
    if (!dependency.integrationId) continue;
    const integration = integrations.find((i) => i.id === dependency.integrationId);
    if (!integration) continue;

    seams.push({
      id: nextId(),
      type: "integration-boundary" as const,
      description: `The "${integration.purpose}" integration is a real, known boundary that may support incremental modernization of the systems it connects.`,
      architectureRefs: [integrationRef(integration.id)],
      evidenceRefs: integration.evidenceRefs,
    });
  }
  return seams;
}
