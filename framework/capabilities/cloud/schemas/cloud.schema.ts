import { z } from "zod";
import { EvidenceReferenceSchema, ArchitectureReferenceSchema } from "../../../schemas/planning/planning.schema.js";
import { InformationGapSchema } from "../../../schemas/discovery/discovery-result.schema.js";

const unknownOrBoolean = z.union([z.boolean(), z.literal("unknown")]);

// ─── Planning ────────────────────────────────────────────────────────────────

const RuntimeCandidateSchema = z.object({
  id: z.string().min(1),
  sourceKind: z.enum(["deployment-need", "ai-agent"]),
  sourceId: z.string().min(1),
  rationale: z.string().min(1),
});

const CloudPlanSchema = z.object({
  deploymentNeedIds: z.array(z.string()),
  relatedWorkflowIds: z.array(z.string()),
  relatedIntegrationIds: z.array(z.string()),
  relatedAgentIds: z.array(z.string()),
  runtimeCandidates: z.array(RuntimeCandidateSchema),
  explicitEnvironmentRequirements: z.array(z.string()),
  securityRequirementIds: z.array(z.string()),
  observabilityRequirementIds: z.array(z.string()),
  informationGapIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

// ─── Hosting / provider / location ─────────────────────────────────────────

const CloudProviderRequirementSchema = z.object({
  provider: z.enum(["aws", "azure", "gcp", "other", "unspecified"]),
  explicit: z.boolean(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const LocationRequirementSchema = z.object({
  location: z.string().optional(),
  type: z.enum(["region", "country", "data-residency", "unknown"]),
  explicit: z.boolean(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Deployment units ───────────────────────────────────────────────────────

const DeploymentUnitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["web-frontend", "api", "service", "worker", "workflow-runtime", "ai-agent-runtime", "static-content", "unknown"]),
  responsibility: z.enum(["solution-managed", "external", "shared", "unknown"]),
  workloadProfile: z.enum(["interactive", "request-driven", "background", "event-driven", "scheduled", "static", "unknown"]),
  sourceArchitectureRefs: z.array(ArchitectureReferenceSchema),
  runtimeRequirementIds: z.array(z.string()),
  stateRequirementIds: z.array(z.string()),
  connectivityRequirementIds: z.array(z.string()),
  securityRequirementIds: z.array(z.string()),
  observabilityRequirementIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Runtime ────────────────────────────────────────────────────────────────

const RuntimeRequirementSchema = z.object({
  id: z.string().min(1),
  executionModel: z.enum(["interactive", "request-driven", "background", "event-driven", "scheduled", "long-running", "static", "unknown"]),
  description: z.string().min(1),
  appliesTo: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── State / persistence ────────────────────────────────────────────────────

const StateRequirementSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(["none", "ephemeral", "session", "durable", "persistent", "unknown"]),
  purpose: z.string().min(1),
  appliesTo: z.array(ArchitectureReferenceSchema),
  dataEntityIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const PersistenceRequirementSchema = z.object({
  id: z.string().min(1),
  purpose: z.string().min(1),
  durability: z.enum(["ephemeral", "session", "durable", "persistent", "unknown"]),
  dataEntityIds: z.array(z.string()),
  retention: z.string().optional(),
  consistency: z.enum(["strong", "eventual", "unknown"]),
  technology: z.literal("unspecified"),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Connectivity ────────────────────────────────────────────────────────────

const CloudEndpointReferenceSchema = z.object({
  kind: z.enum(["deployment-unit", "external-system", "actor", "unknown"]),
  entityId: z.string().optional(),
  label: z.string().min(1),
});

const ConnectivityRequirementSchema = z.object({
  id: z.string().min(1),
  source: CloudEndpointReferenceSchema,
  target: CloudEndpointReferenceSchema,
  direction: z.enum(["inbound", "outbound", "bidirectional", "unknown"]),
  exposure: z.enum(["public", "internal", "external", "private", "unknown"]),
  protocol: z.enum(["http", "https", "websocket", "sftp", "jdbc", "messaging", "database", "unknown"]),
  integrationId: z.string().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Environments ────────────────────────────────────────────────────────────

const EnvironmentRequirementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.enum(["development", "test", "qa", "staging", "production", "disaster-recovery", "unknown"]),
  isolated: unknownOrBoolean,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Scalability / resilience ───────────────────────────────────────────────

const ScalabilityRequirementSchema = z.object({
  id: z.string().min(1),
  target: z.array(ArchitectureReferenceSchema),
  dimension: z.enum(["requests", "concurrency", "users", "jobs", "data-volume", "unknown"]),
  requirement: z.string().optional(),
  explicit: z.boolean(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const ResilienceRequirementSchema = z.object({
  id: z.string().min(1),
  target: z.array(ArchitectureReferenceSchema),
  concern: z.enum(["dependency-failure", "process-recovery", "data-durability", "availability", "retry", "continuity", "unknown"]),
  description: z.string().min(1),
  strategy: z.enum(["unspecified", "explicit"]),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const DeploymentStrategyRequirementSchema = z.object({
  strategy: z.enum(["rolling", "blue-green", "canary", "recreate", "immutable", "unknown"]),
  explicit: z.boolean(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Security / observability mapping ──────────────────────────────────────

const CloudSecurityMappingSchema = z.object({
  id: z.string().min(1),
  securityRequirementId: z.string().min(1),
  deploymentUnitIds: z.array(z.string()),
  connectivityRequirementIds: z.array(z.string()),
  stateRequirementIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const CloudObservabilityMappingSchema = z.object({
  id: z.string().min(1),
  deploymentUnitId: z.string().min(1),
  telemetryRequirementIds: z.array(z.string()),
  healthRequirementIds: z.array(z.string()),
  operationalObjectiveIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── CloudArchitecture ──────────────────────────────────────────────────────

export const CloudArchitectureSchema = z.object({
  version: z.string().min(1),
  hostingModel: z.enum(["cloud", "on-premises", "hybrid", "managed-platform", "unknown"]),
  providerRequirement: CloudProviderRequirementSchema,
  locationRequirement: LocationRequirementSchema.optional(),
  deploymentUnits: z.array(DeploymentUnitSchema),
  runtimeRequirements: z.array(RuntimeRequirementSchema),
  stateRequirements: z.array(StateRequirementSchema),
  persistenceRequirements: z.array(PersistenceRequirementSchema),
  connectivityRequirements: z.array(ConnectivityRequirementSchema),
  environmentRequirements: z.array(EnvironmentRequirementSchema),
  scalabilityRequirements: z.array(ScalabilityRequirementSchema),
  resilienceRequirements: z.array(ResilienceRequirementSchema),
  deploymentStrategy: DeploymentStrategyRequirementSchema.optional(),
  securityMappings: z.array(CloudSecurityMappingSchema),
  observabilityMappings: z.array(CloudObservabilityMappingSchema),
  informationGaps: z.array(InformationGapSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
  status: z.enum(["draft", "needs-review", "complete"]),
  statusReasons: z.array(z.string()),
});

const ImplementationArtifactSchema = z.object({
  id: z.string().min(1),
  capabilityId: z.string().min(1),
  type: z.enum(["blueprint", "business-context", "code", "config", "document", "report"]),
  path: z.string().optional(),
  content: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  generatedAt: z.string().min(1),
});

export const CloudArchitectureSectionSchema = z.object({
  implemented: z.boolean(),
  plan: CloudPlanSchema.optional(),
  architecture: CloudArchitectureSchema,
  artifacts: z.array(ImplementationArtifactSchema),
  notes: z.array(z.string()),
});
