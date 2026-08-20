/**
 * Builds CloudArchitecture from the already-generated solution
 * (DiscoveryResult + WorkflowDefinition[] + IntegrationDefinition[] +
 * AIAgentDefinition[] + SecurityArchitecture + GovernancePlan +
 * ObservabilityArchitecture). Every requirement cites real evidence;
 * nothing here selects a provider/service/database engine/network
 * implementation unless the source explicitly states one — see
 * docs/architecture/ARCHITECTURE.md "Vendor-Neutral Cloud and Deployment
 * Architecture" for the full reasoning behind each rule below.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { DeploymentNeed } from "../../../discovery/cloud/deployment-need.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { AIAgentDefinition, AIAgentInteractionMode } from "../../ai-agents/schemas/ai-agents.types.js";
import type { SecurityArchitecture, GovernancePlan } from "../../security-governance/schemas/security-governance.types.js";
import type { ObservabilityArchitecture } from "../../observability/schemas/observability.types.js";
import { makeIdGenerator } from "../../../discovery/shared/section-lookup.js";
import type {
  CloudArchitecture,
  HostingModel,
  CloudProviderRequirement,
  CloudProviderName,
  LocationRequirement,
  DeploymentUnit,
  DeploymentUnitKind,
  WorkloadProfile,
  RuntimeRequirement,
  RuntimeExecutionModel,
  StateRequirement,
  PersistenceRequirement,
  ConnectivityRequirement,
  CloudEndpointReference,
  EnvironmentRequirement,
  EnvironmentPurpose,
  ScalabilityRequirement,
  ResilienceRequirement,
  DeploymentStrategyRequirement,
  DeploymentStrategyName,
  CloudSecurityMapping,
  CloudObservabilityMapping,
} from "../schemas/cloud.types.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";

function needEvidence(need: DeploymentNeed): EvidenceReference {
  return { entityType: "deployment-need", entityId: need.id, description: need.description };
}
function unitRef(id: string): ArchitectureReference {
  return { entityType: "deployment-unit", entityId: id };
}
function workflowRef(id: string): ArchitectureReference {
  return { entityType: "workflow", entityId: id };
}
function agentRef(id: string): ArchitectureReference {
  return { entityType: "ai-agent", entityId: id };
}
function integrationRef(id: string): ArchitectureReference {
  return { entityType: "integration", entityId: id };
}

// ─── Hosting model / provider / location — explicit-only (task items 8/14/42) ──

const CLOUD_HOSTING_PATTERN = /\bruns? in (the )?cloud\b|\bcloud.?hosted\b|\bcloud environment\b|\bpublic cloud\b/i;
const ON_PREM_HOSTING_PATTERN = /\bon.?premises?\b/i;
const HYBRID_HOSTING_PATTERN = /\bhybrid\b/i;

function resolveHostingModel(needs: DeploymentNeed[]): HostingModel {
  const text = needs.map((n) => n.description).join(" ");
  if (HYBRID_HOSTING_PATTERN.test(text)) return "hybrid";
  if (ON_PREM_HOSTING_PATTERN.test(text)) return "on-premises";
  if (CLOUD_HOSTING_PATTERN.test(text)) return "cloud";
  return "unknown";
}

const PROVIDER_PATTERNS: Array<{ pattern: RegExp; provider: CloudProviderName }> = [
  { pattern: /\bAWS\b|Amazon Web Services/i, provider: "aws" },
  { pattern: /\bAzure\b/i, provider: "azure" },
  { pattern: /\bGCP\b|Google Cloud/i, provider: "gcp" },
];

function resolveProviderRequirement(needs: DeploymentNeed[]): CloudProviderRequirement {
  for (const need of needs) {
    const match = PROVIDER_PATTERNS.find((p) => p.pattern.test(need.description));
    if (match) {
      return { provider: match.provider, explicit: true, evidenceRefs: [needEvidence(need)] };
    }
  }
  return { provider: "unspecified", explicit: false, evidenceRefs: [] };
}

const REGION_PATTERN = /\bregion\b[:\s]+([a-zA-Z0-9-]+)/i;

function resolveLocationRequirement(needs: DeploymentNeed[]): LocationRequirement | undefined {
  for (const need of needs) {
    const match = need.description.match(REGION_PATTERN);
    if (match) {
      return { location: match[1], type: "region", explicit: true, evidenceRefs: [needEvidence(need)] };
    }
  }
  return undefined;
}

// ─── Deployment units — only from explicit "solution-managed <Name>" language (task item 17) ──

const SOLUTION_MANAGED_PATTERN = /solution-managed\s+([A-Za-z0-9][A-Za-z0-9 ]*?)(?:\s+(?:that|which)\b|[.,])/i;
const UNIT_KIND_PATTERNS: Array<{ pattern: RegExp; kind: DeploymentUnitKind }> = [
  { pattern: /\bAPI\b/i, kind: "api" },
  { pattern: /\bprocessor\b|\bworker\b|\bbackground\b/i, kind: "worker" },
  { pattern: /\bfrontend\b|\bweb\b/i, kind: "web-frontend" },
];
function classifyUnitKind(text: string): DeploymentUnitKind {
  return UNIT_KIND_PATTERNS.find((p) => p.pattern.test(text))?.kind ?? "service";
}

const WORKLOAD_PATTERNS: Array<{ pattern: RegExp; profile: WorkloadProfile }> = [
  { pattern: /\bbackground\b/i, profile: "background" },
  { pattern: /\bscheduled?\b/i, profile: "scheduled" },
  { pattern: /\bevent/i, profile: "event-driven" },
  { pattern: /\breceives?\b|\brequests?\b|\binteract/i, profile: "request-driven" },
];
function classifyWorkload(text: string): WorkloadProfile {
  return WORKLOAD_PATTERNS.find((p) => p.pattern.test(text))?.profile ?? "unknown";
}

function buildDeploymentUnits(needs: DeploymentNeed[], nextId: () => string): DeploymentUnit[] {
  const units: DeploymentUnit[] = [];
  const seenNames = new Set<string>();

  for (const need of needs) {
    const match = need.description.match(SOLUTION_MANAGED_PATTERN);
    if (!match) continue;
    const name = match[1].trim();
    if (seenNames.has(name.toLowerCase())) continue;
    seenNames.add(name.toLowerCase());

    units.push({
      id: nextId(),
      name,
      kind: classifyUnitKind(need.description),
      responsibility: "solution-managed",
      workloadProfile: classifyWorkload(need.description),
      sourceArchitectureRefs: [],
      runtimeRequirementIds: [],
      stateRequirementIds: [],
      connectivityRequirementIds: [],
      securityRequirementIds: [],
      observabilityRequirementIds: [],
      evidenceRefs: [needEvidence(need)],
    });
  }

  return units;
}

// ─── Runtime requirements (task items 19/20) ───────────────────────────────

const WORKLOAD_TO_EXECUTION_MODEL: Record<WorkloadProfile, RuntimeExecutionModel> = {
  interactive: "interactive",
  "request-driven": "request-driven",
  background: "background",
  "event-driven": "event-driven",
  scheduled: "scheduled",
  static: "static",
  unknown: "unknown",
};

const INTERACTION_MODE_TO_EXECUTION_MODEL: Record<AIAgentInteractionMode, RuntimeExecutionModel> = {
  conversational: "interactive",
  task: "request-driven",
  "decision-support": "request-driven",
  classification: "request-driven",
  summarization: "request-driven",
  generation: "request-driven",
  orchestration: "event-driven",
  unknown: "unknown",
};

function buildRuntimeRequirements(units: DeploymentUnit[], agents: AIAgentDefinition[], nextId: () => string): RuntimeRequirement[] {
  const requirements: RuntimeRequirement[] = [];

  for (const unit of units) {
    const id = nextId();
    requirements.push({
      id,
      executionModel: WORKLOAD_TO_EXECUTION_MODEL[unit.workloadProfile],
      description: `Runtime for solution-managed component "${unit.name}".`,
      appliesTo: [unitRef(unit.id)],
      evidenceRefs: unit.evidenceRefs,
    });
    unit.runtimeRequirementIds.push(id);
  }

  // Every AI agent gets a runtime requirement unconditionally — its
  // orchestration logic is solution-owned execution even before anything is
  // known about where model inference runs (deliberate asymmetry vs.
  // workflows/integrations — see ARCHITECTURE.md).
  for (const agent of agents) {
    requirements.push({
      id: nextId(),
      executionModel: INTERACTION_MODE_TO_EXECUTION_MODEL[agent.interactionMode],
      description: `Runtime for AI agent "${agent.name}" — model/provider execution location is a separate, unresolved concern.`,
      appliesTo: [agentRef(agent.id)],
      evidenceRefs: agent.evidenceRefs,
    });
  }

  return requirements;
}

// ─── State / persistence (task items 23-27) ────────────────────────────────

const RESTART_SURVIVAL_PATTERN = /\bsurvive\b.*\brestarts?\b|\brestarts?\b.*\bsurvive\b|\bdurable\b/i;

function buildStateAndPersistence(
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  agents: AIAgentDefinition[],
  nextStateId: () => string,
  nextPersistId: () => string
): { states: StateRequirement[]; persistence: PersistenceRequirement[] } {
  const states: StateRequirement[] = [];
  const persistence: PersistenceRequirement[] = [];

  for (const workflow of workflows) {
    if (workflow.approvals.length === 0) continue;
    const approval = workflow.approvals[0];
    states.push({
      id: nextStateId(),
      mode: "durable",
      purpose: `Workflow "${workflow.name}" state must survive the wait between an approval being requested and resolved.`,
      appliesTo: [workflowRef(workflow.id)],
      dataEntityIds: [],
      evidenceRefs: approval.evidenceRefs,
    });
  }

  for (const agent of agents) {
    if (agent.memory.mode === "session") {
      states.push({
        id: nextStateId(),
        mode: "session",
        purpose: `Agent "${agent.name}" requires session-scoped state.`,
        appliesTo: [agentRef(agent.id)],
        dataEntityIds: agent.memory.dataEntityIds,
        evidenceRefs: agent.memory.evidenceRefs,
      });
    } else if (agent.memory.mode === "persistent") {
      states.push({
        id: nextStateId(),
        mode: "persistent",
        purpose: `Agent "${agent.name}" requires persistent state.`,
        appliesTo: [agentRef(agent.id)],
        dataEntityIds: agent.memory.dataEntityIds,
        evidenceRefs: agent.memory.evidenceRefs,
      });
      persistence.push({
        id: nextPersistId(),
        purpose: `Persistent memory for agent "${agent.name}".`,
        durability: "persistent",
        dataEntityIds: agent.memory.dataEntityIds,
        consistency: "unknown",
        technology: "unspecified",
        evidenceRefs: agent.memory.evidenceRefs,
      });
    }
  }

  for (const need of discovery.deploymentNeeds) {
    if (need.category !== "persistence") continue;
    if (!RESTART_SURVIVAL_PATTERN.test(need.description)) continue;
    states.push({
      id: nextStateId(),
      mode: "durable",
      purpose: need.description,
      appliesTo: [],
      dataEntityIds: [],
      evidenceRefs: [needEvidence(need)],
    });
    persistence.push({
      id: nextPersistId(),
      purpose: need.description,
      durability: "durable",
      dataEntityIds: [],
      consistency: "unknown",
      technology: "unspecified",
      evidenceRefs: [needEvidence(need)],
    });
  }

  return { states, persistence };
}

// ─── Connectivity (task items 29-32) ───────────────────────────────────────

const PUBLIC_EXPOSURE_PATTERN = /\bpublicly reachable\b|\bpublic endpoint\b|\bpublic(ly)? access(ible)?\b/i;
const NON_PUBLIC_EXPOSURE_PATTERN = /\bmust not expose\b|\bnon-public\b|\bnot publicly\b|\bnot expose\b/i;
const EXPLICIT_HTTPS_PATTERN = /\bhttps\b/i;

function findOwningUnit(text: string, units: DeploymentUnit[]): DeploymentUnit | undefined {
  return units.find((u) => text.toLowerCase().includes(u.name.toLowerCase()));
}

function buildConnectivity(
  discovery: DiscoveryResult,
  integrations: IntegrationDefinition[],
  units: DeploymentUnit[],
  nextId: () => string
): ConnectivityRequirement[] {
  const connectivity: ConnectivityRequirement[] = [];

  for (const integration of integrations) {
    const owningUnit = findOwningUnit(integration.purpose, units);
    const source: CloudEndpointReference = owningUnit
      ? { kind: "deployment-unit", entityId: owningUnit.id, label: owningUnit.name }
      : { kind: "unknown", label: "unknown" };
    const targetSystem = integration.targetSystemId ? discovery.systems.find((s) => s.id === integration.targetSystemId) : undefined;
    const target: CloudEndpointReference = targetSystem
      ? { kind: "external-system", entityId: targetSystem.id, label: targetSystem.name }
      : { kind: "unknown", label: integration.name };

    const id = nextId();
    connectivity.push({
      id,
      source,
      target,
      direction: owningUnit ? "outbound" : "unknown",
      exposure: "external",
      protocol: integration.protocol,
      integrationId: integration.id,
      evidenceRefs: integration.evidenceRefs,
    });
    if (owningUnit) owningUnit.connectivityRequirementIds.push(id);
  }

  for (const need of discovery.deploymentNeeds) {
    const owningUnit = findOwningUnit(need.description, units);
    if (!owningUnit) continue;
    if (!PUBLIC_EXPOSURE_PATTERN.test(need.description) && !NON_PUBLIC_EXPOSURE_PATTERN.test(need.description)) continue;

    const isPublic = PUBLIC_EXPOSURE_PATTERN.test(need.description) && !NON_PUBLIC_EXPOSURE_PATTERN.test(need.description);
    const id = nextId();
    connectivity.push({
      id,
      source: { kind: "actor", label: "Customer" },
      target: { kind: "deployment-unit", entityId: owningUnit.id, label: owningUnit.name },
      direction: "inbound",
      exposure: isPublic ? "public" : "internal",
      protocol: EXPLICIT_HTTPS_PATTERN.test(need.description) ? "https" : "unknown",
      evidenceRefs: [needEvidence(need)],
    });
    owningUnit.connectivityRequirementIds.push(id);
  }

  return connectivity;
}

// ─── Environments (task items 40/41) ───────────────────────────────────────

const ENVIRONMENT_NAMES_PATTERN = /\b((?:[A-Z][a-zA-Z]*(?:\s*,\s*|\s+and\s+))*[A-Z][a-zA-Z]*)\s+environments?\b/;
const SEPARATE_PATTERN = /\bseparate\b|\bisolated\b/i;

const ENVIRONMENT_PURPOSE_PATTERNS: Array<{ pattern: RegExp; purpose: EnvironmentPurpose }> = [
  { pattern: /prod/i, purpose: "production" },
  { pattern: /stag/i, purpose: "staging" },
  { pattern: /qa|uat/i, purpose: "qa" },
  { pattern: /test/i, purpose: "test" },
  { pattern: /dr\b|disaster/i, purpose: "disaster-recovery" },
  { pattern: /dev/i, purpose: "development" },
];
function classifyEnvironmentPurpose(name: string): EnvironmentPurpose {
  return ENVIRONMENT_PURPOSE_PATTERNS.find((p) => p.pattern.test(name))?.purpose ?? "unknown";
}

function buildEnvironments(needs: DeploymentNeed[], nextId: () => string): EnvironmentRequirement[] {
  const environments: EnvironmentRequirement[] = [];

  for (const need of needs) {
    if (need.category !== "environment") continue;
    const match = need.description.match(ENVIRONMENT_NAMES_PATTERN);
    if (!match) continue;
    const names = match[1].split(/\s*,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
    const isolated = SEPARATE_PATTERN.test(need.description) ? true : "unknown";

    for (const name of names) {
      environments.push({
        id: nextId(),
        name,
        purpose: classifyEnvironmentPurpose(name),
        isolated,
        evidenceRefs: [needEvidence(need)],
      });
    }
  }

  return environments;
}

// ─── Scalability / resilience (task items 43-49) ───────────────────────────

const CONCURRENCY_PATTERN = /\b\d+\s+concurrent[a-z ]*/i;
const PERCENT_PATTERN = /\b\d{1,3}(\.\d+)?\s?%/;

function buildScalability(needs: DeploymentNeed[], nextId: () => string): ScalabilityRequirement[] {
  const requirements: ScalabilityRequirement[] = [];

  for (const need of needs) {
    const concurrency = need.description.match(CONCURRENCY_PATTERN);
    const percent = need.description.match(PERCENT_PATTERN);
    if (!concurrency && !percent) continue;

    requirements.push({
      id: nextId(),
      target: [],
      dimension: concurrency ? "concurrency" : "unknown",
      requirement: (concurrency?.[0] ?? percent?.[0])?.trim(),
      explicit: true,
      evidenceRefs: [needEvidence(need)],
    });
  }

  return requirements;
}

const RESILIENCE_TARGET_PATTERN = /\b(?:external\s+)?([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)\s+(?:API|integration|system)\b/;

function buildResilience(needs: DeploymentNeed[], integrations: IntegrationDefinition[], nextId: () => string): ResilienceRequirement[] {
  const requirements: ResilienceRequirement[] = [];

  for (const need of needs) {
    if (need.category !== "resilience") continue;

    const nameMatch = need.description.match(RESILIENCE_TARGET_PATTERN);
    const matchingIntegration = nameMatch ? integrations.find((i) => i.name.toLowerCase().includes(nameMatch[1].toLowerCase())) : undefined;

    requirements.push({
      id: nextId(),
      target: matchingIntegration ? [integrationRef(matchingIntegration.id)] : [],
      concern: /\bunavailab|\btemporar/i.test(need.description) ? "dependency-failure" : "continuity",
      description: need.description,
      strategy: "unspecified",
      evidenceRefs: [needEvidence(need)],
    });
  }

  return requirements;
}

const DEPLOYMENT_STRATEGY_PATTERNS: Array<{ pattern: RegExp; strategy: DeploymentStrategyName }> = [
  { pattern: /\brolling\b/i, strategy: "rolling" },
  { pattern: /\bblue.?green\b/i, strategy: "blue-green" },
  { pattern: /\bcanary\b/i, strategy: "canary" },
  { pattern: /\brecreate\b/i, strategy: "recreate" },
  { pattern: /\bimmutable\b/i, strategy: "immutable" },
];

function buildDeploymentStrategy(needs: DeploymentNeed[]): DeploymentStrategyRequirement | undefined {
  const mentioning = needs.find((n) => /\bdeployment strategy\b/i.test(n.description));
  if (!mentioning) return undefined;

  const match = DEPLOYMENT_STRATEGY_PATTERNS.find((p) => p.pattern.test(mentioning.description));
  return {
    strategy: match?.strategy ?? "unknown",
    explicit: Boolean(match),
    evidenceRefs: [needEvidence(mentioning)],
  };
}

// ─── Security / observability mapping — pure reference layers (task items 34/38) ──

function buildSecurityMappings(security: SecurityArchitecture, connectivity: ConnectivityRequirement[], nextId: () => string): CloudSecurityMapping[] {
  const mappings: CloudSecurityMapping[] = [];

  for (const req of security.requirements) {
    const matchingConnectivity = connectivity.filter((c) =>
      req.appliesTo.some((ref) => ref.entityType === "integration" && ref.entityId === c.integrationId)
    );
    if (matchingConnectivity.length === 0) continue;

    const deploymentUnitIds = [...new Set(matchingConnectivity.flatMap((c) => [c.source, c.target]).filter((e) => e.kind === "deployment-unit").map((e) => e.entityId!))];

    mappings.push({
      id: nextId(),
      securityRequirementId: req.id,
      deploymentUnitIds,
      connectivityRequirementIds: matchingConnectivity.map((c) => c.id),
      stateRequirementIds: [],
      evidenceRefs: req.evidenceRefs,
    });
  }

  return mappings;
}

function buildObservabilityMappings(observability: ObservabilityArchitecture, units: DeploymentUnit[], nextId: () => string): CloudObservabilityMapping[] {
  const mappings: CloudObservabilityMapping[] = [];

  for (const unit of units) {
    const unitRefs = unit.sourceArchitectureRefs;
    if (unitRefs.length === 0) continue;

    const telemetryIds = observability.signals.filter((s) => unitRefs.some((r) => r.entityType === s.source.entityType && r.entityId === s.source.entityId)).map((s) => s.id);
    const healthIds = observability.healthRequirements.filter((h) => unitRefs.some((r) => r.entityType === h.target.entityType && r.entityId === h.target.entityId)).map((h) => h.id);
    const objectiveIds = observability.operationalObjectives.filter((o) => o.target.some((t) => unitRefs.some((r) => r.entityType === t.entityType && r.entityId === t.entityId))).map((o) => o.id);

    if (telemetryIds.length === 0 && healthIds.length === 0 && objectiveIds.length === 0) continue;

    mappings.push({
      id: nextId(),
      deploymentUnitId: unit.id,
      telemetryRequirementIds: telemetryIds,
      healthRequirementIds: healthIds,
      operationalObjectiveIds: objectiveIds,
      evidenceRefs: unit.evidenceRefs,
    });
  }

  return mappings;
}

// ─── Main build ─────────────────────────────────────────────────────────

export function buildCloudArchitecture(
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[],
  agents: AIAgentDefinition[],
  security: SecurityArchitecture,
  _governance: GovernancePlan,
  observability: ObservabilityArchitecture
): CloudArchitecture {
  const ids = {
    unit: makeIdGenerator("DEPLOYUNIT"),
    runtime: makeIdGenerator("RUNTIME"),
    state: makeIdGenerator("STATE"),
    persist: makeIdGenerator("PERSIST"),
    connect: makeIdGenerator("CONNECT"),
    env: makeIdGenerator("ENV"),
    scale: makeIdGenerator("SCALE"),
    resilience: makeIdGenerator("RESILIENCE"),
    secMapping: makeIdGenerator("CLOUDSEC"),
    obsMapping: makeIdGenerator("CLOUDOBS"),
    gap: makeIdGenerator("CLOUDGAP"),
  };

  const needs = discovery.deploymentNeeds;

  const hostingModel = resolveHostingModel(needs);
  const providerRequirement = resolveProviderRequirement(needs);
  const locationRequirement = resolveLocationRequirement(needs);

  const deploymentUnits = buildDeploymentUnits(needs, ids.unit);
  const runtimeRequirements = buildRuntimeRequirements(deploymentUnits, agents, ids.runtime);
  const { states: stateRequirements, persistence: persistenceRequirements } = buildStateAndPersistence(discovery, workflows, agents, ids.state, ids.persist);
  const connectivityRequirements = buildConnectivity(discovery, integrations, deploymentUnits, ids.connect);
  const environmentRequirements = buildEnvironments(needs, ids.env);
  const scalabilityRequirements = buildScalability(needs, ids.scale);
  const resilienceRequirements = buildResilience(needs, integrations, ids.resilience);
  const deploymentStrategy = buildDeploymentStrategy(needs);
  const securityMappings = buildSecurityMappings(security, connectivityRequirements, ids.secMapping);
  const observabilityMappings = buildObservabilityMappings(observability, deploymentUnits, ids.obsMapping);

  const informationGaps: InformationGap[] = [];
  if (deploymentUnits.length === 0 && (runtimeRequirements.length > 0 || agents.length > 0)) {
    informationGaps.push({
      id: ids.gap(),
      topic: "Deployment boundary",
      question: "Should the identified runtime responsibilities deploy independently or share one application boundary?",
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: ["cloud"],
    });
  }
  if (!providerRequirement.explicit && (deploymentUnits.length > 0 || agents.length > 0)) {
    informationGaps.push({ id: ids.gap(), topic: "Cloud provider", question: "Which provider, if any, is required for hosting this solution?", importance: "low", blocking: false, relatedCapabilityIds: ["cloud"] });
  }
  if (persistenceRequirements.length > 0) {
    informationGaps.push({ id: ids.gap(), topic: "Persistence technology", question: "What persistence technology should satisfy the identified durable-state requirements?", importance: "medium", blocking: false, relatedCapabilityIds: ["cloud"] });
  }
  if (!deploymentStrategy && deploymentUnits.length > 0) {
    informationGaps.push({ id: ids.gap(), topic: "Deployment strategy", question: "What deployment strategy is required for solution-managed components?", importance: "low", blocking: false, relatedCapabilityIds: ["cloud"] });
  }

  const statusReasons: string[] = [];
  if (!providerRequirement.explicit) statusReasons.push("cloud provider is unresolved");
  if (persistenceRequirements.some((p) => p.durability !== "unknown") && persistenceRequirements.length > 0) statusReasons.push("persistence technology is unresolved");
  if (!deploymentStrategy && deploymentUnits.length > 0) statusReasons.push("deployment strategy is unresolved");
  if (informationGaps.length > 0) statusReasons.push(`${informationGaps.length} unresolved information gap(s)`);

  const hasAnyArchitecture = deploymentUnits.length > 0 || runtimeRequirements.length > 0;
  const status = !hasAnyArchitecture ? "draft" : statusReasons.length > 0 ? "needs-review" : "complete";

  const evidenceRefs: EvidenceReference[] = [
    ...deploymentUnits.flatMap((u) => u.evidenceRefs),
    ...runtimeRequirements.flatMap((r) => r.evidenceRefs),
  ];

  return {
    version: "1.0",
    hostingModel,
    providerRequirement,
    locationRequirement,
    deploymentUnits,
    runtimeRequirements,
    stateRequirements,
    persistenceRequirements,
    connectivityRequirements,
    environmentRequirements,
    scalabilityRequirements,
    resilienceRequirements,
    deploymentStrategy,
    securityMappings,
    observabilityMappings,
    informationGaps,
    evidenceRefs,
    status,
    statusReasons,
  };
}
