import { z } from "zod";
import { EvidenceReferenceSchema, ArchitectureReferenceSchema } from "../../../schemas/planning/planning.schema.js";
import { InformationGapSchema } from "../../../schemas/discovery/discovery-result.schema.js";

const unknownOrBoolean = z.union([z.boolean(), z.literal("unknown")]);
const SensitivitySchema = z.enum(["public", "internal", "confidential", "restricted", "unknown"]);
const ProvenanceSchema = z.enum(["explicit", "derived"]);

// ─── Planning ────────────────────────────────────────────────────────────────

const TelemetryCandidateSchema = z.object({
  id: z.string().min(1),
  sourceKind: z.enum(["workflow", "integration", "ai-agent", "security"]),
  sourceId: z.string().min(1),
  rationale: z.string().min(1),
});

const ObservabilityPlanSchema = z.object({
  workflowIds: z.array(z.string()),
  integrationIds: z.array(z.string()),
  agentIds: z.array(z.string()),
  securityRequirementIds: z.array(z.string()),
  auditRequirementIds: z.array(z.string()),
  telemetryCandidates: z.array(TelemetryCandidateSchema),
  explicitOperationalRequirementIds: z.array(z.string()),
  informationGapIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

// ─── Shared ─────────────────────────────────────────────────────────────────

const ObservabilityAttributeSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  sensitivity: SensitivitySchema,
  required: unknownOrBoolean,
});

const TelemetryRequirementSchema = z.object({
  id: z.string().min(1),
  purpose: z.enum(["operational", "diagnostic", "audit", "security", "business", "performance", "reliability"]),
  appliesTo: z.array(ArchitectureReferenceSchema),
  requiredSignals: z.array(z.string()),
  description: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema).min(1, "TelemetryRequirement must have at least one evidence reference"),
  status: z.enum(["defined", "needs-information"]),
});

const ObservabilitySignalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["log", "metric", "trace", "event", "audit-event"]),
  description: z.string().min(1),
  source: ArchitectureReferenceSchema,
  attributes: z.array(ObservabilityAttributeSchema),
  sensitivity: SensitivitySchema,
  provenance: ProvenanceSchema,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const LogRequirementSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  level: z.enum(["debug", "info", "warning", "error", "unknown"]),
  source: ArchitectureReferenceSchema,
  fields: z.array(ObservabilityAttributeSchema),
  prohibitedData: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const MetricRequirementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["counter", "gauge", "histogram", "timer", "unknown"]),
  description: z.string().min(1),
  unit: z.string().optional(),
  source: ArchitectureReferenceSchema,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const CorrelationRequirementSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  architecturePath: z.array(ArchitectureReferenceSchema),
  correlationRequired: unknownOrBoolean,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const HealthRequirementSchema = z.object({
  id: z.string().min(1),
  target: ArchitectureReferenceSchema,
  type: z.enum(["availability", "dependency", "readiness", "liveness", "business-process", "unknown"]),
  description: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AlertRequirementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceSignalIds: z.array(z.string()),
  condition: z.string().min(1),
  threshold: z.string().optional(),
  destination: z.string().optional(),
  severity: z.enum(["info", "warning", "critical", "unknown"]),
  provenance: ProvenanceSchema,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const DashboardSpecificationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  signalIds: z.array(z.string()),
  audienceRoles: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AuditTelemetryMappingSchema = z.object({
  id: z.string().min(1),
  auditRequirementId: z.string().min(1),
  signalIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const OperationalObjectiveSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  target: z.array(ArchitectureReferenceSchema),
  objectiveType: z.enum(["availability", "latency", "error-rate", "throughput", "completion-time", "unknown"]),
  targetValue: z.string().optional(),
  explicit: z.boolean(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

export const ObservabilityArchitectureSchema = z.object({
  version: z.string().min(1),
  telemetryRequirements: z.array(TelemetryRequirementSchema),
  signals: z.array(ObservabilitySignalSchema),
  logRequirements: z.array(LogRequirementSchema),
  metricRequirements: z.array(MetricRequirementSchema),
  correlationRequirements: z.array(CorrelationRequirementSchema),
  healthRequirements: z.array(HealthRequirementSchema),
  alertRequirements: z.array(AlertRequirementSchema),
  dashboardSpecifications: z.array(DashboardSpecificationSchema),
  auditMappings: z.array(AuditTelemetryMappingSchema),
  operationalObjectives: z.array(OperationalObjectiveSchema),
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

export const ObservabilitySectionSchema = z.object({
  implemented: z.boolean(),
  plan: ObservabilityPlanSchema.optional(),
  architecture: ObservabilityArchitectureSchema,
  artifacts: z.array(ImplementationArtifactSchema),
  notes: z.array(z.string()),
});
