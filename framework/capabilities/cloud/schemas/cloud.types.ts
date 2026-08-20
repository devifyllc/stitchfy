/**
 * Phase 7B — replaces the Phase 0 model (mandatory provider, NetworkingConfig
 * {vpcNeeded, publicEndpoints}, DatabaseResource{engine}, free-form
 * deploymentStrategy: string) with a vendor-neutral, requirement-oriented
 * CloudArchitecture. Cloud Architecture answers "what deployment/runtime
 * characteristics does this solution require," never "which AWS/Azure/GCP
 * service should we use" — see docs/architecture/ARCHITECTURE.md
 * "Vendor-Neutral Cloud and Deployment Architecture".
 *
 * `implemented: true` means Stitchfy generated and validated a vendor-
 * neutral cloud/deployment architecture based on the currently known
 * solution — it does NOT mean infrastructure was provisioned, an
 * application was deployed, a cloud account/credentials exist, a region was
 * selected (unless explicit), networking was configured, a database was
 * created, or the architecture is production-ready.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";

// ─── Planning (cloud.planner.ts) ───────────────────────────────────────────

export type RuntimeCandidateSourceKind = "deployment-need" | "ai-agent";

export interface RuntimeCandidate {
  id: string;
  sourceKind: RuntimeCandidateSourceKind;
  sourceId: string;
  rationale: string;
}

export interface CloudPlan {
  deploymentNeedIds: string[];
  relatedWorkflowIds: string[];
  relatedIntegrationIds: string[];
  relatedAgentIds: string[];
  runtimeCandidates: RuntimeCandidate[];
  explicitEnvironmentRequirements: string[];
  securityRequirementIds: string[];
  observabilityRequirementIds: string[];
  informationGapIds: string[];
  assumptions: string[];
}

// ─── Hosting / provider / location ─────────────────────────────────────────

export type HostingModel = "cloud" | "on-premises" | "hybrid" | "managed-platform" | "unknown";

export type CloudProviderName = "aws" | "azure" | "gcp" | "other" | "unspecified";

/** Provider is a requirement to preserve, never a default the architecture assumes (task item 14). */
export interface CloudProviderRequirement {
  provider: CloudProviderName;
  explicit: boolean;
  evidenceRefs: EvidenceReference[];
}

export type LocationRequirementType = "region" | "country" | "data-residency" | "unknown";

export interface LocationRequirement {
  location?: string;
  type: LocationRequirementType;
  explicit: boolean;
  evidenceRefs: EvidenceReference[];
}

// ─── Deployment units ───────────────────────────────────────────────────────

export type DeploymentUnitKind =
  | "web-frontend"
  | "api"
  | "service"
  | "worker"
  | "workflow-runtime"
  | "ai-agent-runtime"
  | "static-content"
  | "unknown";

export type DeploymentUnitResponsibility = "solution-managed" | "external" | "shared" | "unknown";

export type WorkloadProfile = "interactive" | "request-driven" | "background" | "event-driven" | "scheduled" | "static" | "unknown";

/** Only ever created from explicit solution-managed language — never one per WorkflowDefinition/IntegrationDefinition/AIAgentDefinition (task item 17). */
export interface DeploymentUnit {
  id: string;
  name: string;
  kind: DeploymentUnitKind;
  responsibility: DeploymentUnitResponsibility;
  workloadProfile: WorkloadProfile;
  sourceArchitectureRefs: ArchitectureReference[];
  runtimeRequirementIds: string[];
  stateRequirementIds: string[];
  connectivityRequirementIds: string[];
  securityRequirementIds: string[];
  observabilityRequirementIds: string[];
  evidenceRefs: EvidenceReference[];
}

// ─── Runtime ────────────────────────────────────────────────────────────────

export type RuntimeExecutionModel =
  | "interactive"
  | "request-driven"
  | "background"
  | "event-driven"
  | "scheduled"
  | "long-running"
  | "static"
  | "unknown";

/** Never translated into serverless/container/VM/Kubernetes — that's a later implementation decision (task item 19). */
export interface RuntimeRequirement {
  id: string;
  executionModel: RuntimeExecutionModel;
  description: string;
  appliesTo: ArchitectureReference[];
  evidenceRefs: EvidenceReference[];
}

// ─── State / persistence ────────────────────────────────────────────────────

export type StateMode = "none" | "ephemeral" | "session" | "durable" | "persistent" | "unknown";

/** Answers "what must survive and for how long conceptually" — never a database selection (task item 25). */
export interface StateRequirement {
  id: string;
  mode: StateMode;
  purpose: string;
  appliesTo: ArchitectureReference[];
  dataEntityIds: string[];
  evidenceRefs: EvidenceReference[];
}

export type PersistenceDurability = "ephemeral" | "session" | "durable" | "persistent" | "unknown";
export type PersistenceConsistency = "strong" | "eventual" | "unknown";

/** `technology` is always "unspecified" in this phase — no engine is ever selected (task item 27). */
export interface PersistenceRequirement {
  id: string;
  purpose: string;
  durability: PersistenceDurability;
  dataEntityIds: string[];
  retention?: string;
  consistency: PersistenceConsistency;
  technology: "unspecified";
  evidenceRefs: EvidenceReference[];
}

// ─── Connectivity ────────────────────────────────────────────────────────────

export type CloudEndpointKind = "deployment-unit" | "external-system" | "actor" | "unknown";

/** A clean endpoint model — neither a customer/actor nor an external SaaS system fits ArchitectureReference's existing vocabulary cleanly. */
export interface CloudEndpointReference {
  kind: CloudEndpointKind;
  entityId?: string;
  label: string;
}

export type ConnectivityDirection = "inbound" | "outbound" | "bidirectional" | "unknown";
export type ConnectivityExposure = "public" | "internal" | "external" | "private" | "unknown";
export type ConnectivityProtocol = "http" | "https" | "websocket" | "sftp" | "jdbc" | "messaging" | "database" | "unknown";

export interface ConnectivityRequirement {
  id: string;
  source: CloudEndpointReference;
  target: CloudEndpointReference;
  direction: ConnectivityDirection;
  exposure: ConnectivityExposure;
  protocol: ConnectivityProtocol;
  integrationId?: string;
  evidenceRefs: EvidenceReference[];
}

// ─── Environments ────────────────────────────────────────────────────────────

export type EnvironmentPurpose = "development" | "test" | "qa" | "staging" | "production" | "disaster-recovery" | "unknown";

/** Only ever created from an explicitly named environment — the source name is preserved verbatim, never normalized to dev/qa/stage/prod (task items 40/41). */
export interface EnvironmentRequirement {
  id: string;
  name: string;
  purpose: EnvironmentPurpose;
  isolated: true | false | "unknown";
  evidenceRefs: EvidenceReference[];
}

// ─── Scalability / resilience ───────────────────────────────────────────────

export type ScalabilityDimension = "requests" | "concurrency" | "users" | "jobs" | "data-volume" | "unknown";

export interface ScalabilityRequirement {
  id: string;
  target: ArchitectureReference[];
  dimension: ScalabilityDimension;
  requirement?: string;
  explicit: boolean;
  evidenceRefs: EvidenceReference[];
}

export type ResilienceConcern = "dependency-failure" | "process-recovery" | "data-durability" | "availability" | "retry" | "continuity" | "unknown";
export type ResilienceStrategy = "unspecified" | "explicit";

export interface ResilienceRequirement {
  id: string;
  target: ArchitectureReference[];
  concern: ResilienceConcern;
  description: string;
  strategy: ResilienceStrategy;
  evidenceRefs: EvidenceReference[];
}

export type DeploymentStrategyName = "rolling" | "blue-green" | "canary" | "recreate" | "immutable" | "unknown";

export interface DeploymentStrategyRequirement {
  strategy: DeploymentStrategyName;
  explicit: boolean;
  evidenceRefs: EvidenceReference[];
}

// ─── Security / observability mapping — pure reference layers, no new policy ──

/** No new security policy is inferred here — a pure reference layer onto Phase 5's own SecurityRequirement (task item 34). */
export interface CloudSecurityMapping {
  id: string;
  securityRequirementId: string;
  deploymentUnitIds: string[];
  connectivityRequirementIds: string[];
  stateRequirementIds: string[];
  evidenceRefs: EvidenceReference[];
}

/** References existing Phase 7A ids verbatim — never recomputes a threshold (task item 63). */
export interface CloudObservabilityMapping {
  id: string;
  deploymentUnitId: string;
  telemetryRequirementIds: string[];
  healthRequirementIds: string[];
  operationalObjectiveIds: string[];
  evidenceRefs: EvidenceReference[];
}

// ─── CloudArchitecture ──────────────────────────────────────────────────────

export type CloudArchitectureStatus = "draft" | "needs-review" | "complete";

export interface CloudArchitecture {
  version: string;
  hostingModel: HostingModel;
  providerRequirement: CloudProviderRequirement;
  locationRequirement?: LocationRequirement;
  deploymentUnits: DeploymentUnit[];
  runtimeRequirements: RuntimeRequirement[];
  stateRequirements: StateRequirement[];
  persistenceRequirements: PersistenceRequirement[];
  connectivityRequirements: ConnectivityRequirement[];
  environmentRequirements: EnvironmentRequirement[];
  scalabilityRequirements: ScalabilityRequirement[];
  resilienceRequirements: ResilienceRequirement[];
  deploymentStrategy?: DeploymentStrategyRequirement;
  securityMappings: CloudSecurityMapping[];
  observabilityMappings: CloudObservabilityMapping[];
  informationGaps: InformationGap[];
  evidenceRefs: EvidenceReference[];
  status: CloudArchitectureStatus;
  statusReasons: string[];
}

// ─── Capability output ──────────────────────────────────────────────────────

export interface CloudArchitectureSection {
  implemented: boolean;
  plan?: CloudPlan;
  architecture: CloudArchitecture;
  artifacts: ImplementationArtifact[];
  notes: string[];
}
