import { z } from "zod";
import { EvidenceReferenceSchema, ArchitectureReferenceSchema } from "../../../schemas/planning/planning.schema.js";
import { InformationGapSchema } from "../../../schemas/discovery/discovery-result.schema.js";

const IntegrationCandidateSchema = z.object({
  id: z.string().min(1),
  sourceSystemId: z.string().optional(),
  targetSystemId: z.string().optional(),
  purpose: z.string().min(1),
  relatedWorkflowIds: z.array(z.string()),
  relatedProcessIds: z.array(z.string()),
  relatedRequirementIds: z.array(z.string()),
  sourceIntegrationNeedIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const IntegrationPlanSchema = z.object({
  integrationNeedIds: z.array(z.string()),
  workflowIds: z.array(z.string()),
  processIds: z.array(z.string()),
  requirementIds: z.array(z.string()),
  systemIds: z.array(z.string()),
  candidates: z.array(IntegrationCandidateSchema),
  informationGaps: z.array(z.string()),
  assumptions: z.array(z.string()),
});

const IntegrationOperationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  type: z.enum(["read", "create", "update", "delete", "notify", "synchronize", "submit", "unknown"]),
  requestContractId: z.string().optional(),
  responseContractId: z.string().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const DataContractFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  required: z.boolean().optional(),
  source: z.string().optional(),
});

const DataContractSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  direction: z.enum(["request", "response", "event", "file", "unknown"]),
  fields: z.array(DataContractFieldSchema),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted", "unknown"]),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const unknownOrBoolean = z.union([z.boolean(), z.literal("unknown")]);

const AuthenticationPlacementSchema = z.object({
  location: z.enum(["header", "query", "cookie", "unknown"]),
  name: z.string().optional(),
});

const AuthenticationRequirementSchema = z.object({
  mechanism: z.enum(["api-key", "oauth2", "basic", "mtls", "service-account", "none", "unknown"]),
  placement: AuthenticationPlacementSchema.optional(),
  notes: z.array(z.string()).optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema).optional(),
});

const ReliabilityRequirementsSchema = z.object({
  retryRequired: unknownOrBoolean,
  idempotencyRequired: unknownOrBoolean,
  timeoutRequired: unknownOrBoolean,
  orderingRequired: unknownOrBoolean.optional(),
  notes: z.array(z.string()),
});

const IntegrationFailureScenarioSchema = z.object({
  id: z.string().min(1),
  condition: z.string().min(1),
  handling: z.enum(["retry", "human-review", "fail", "ignore", "unknown"]),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const IntegrationSecurityRequirementsSchema = z.object({
  encryptionInTransit: unknownOrBoolean,
  containsSensitiveData: unknownOrBoolean,
  secretsRequired: unknownOrBoolean,
  auditRequired: unknownOrBoolean,
});

const RestOperationSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z.string().optional(),
  description: z.string().optional(),
  integrationOperationId: z.string().optional(),
});

const RestContractSchema = z.object({
  baseUrl: z.string().optional(),
  operations: z.array(RestOperationSchema),
});

const WebhookContractSchema = z.object({
  eventName: z.string().optional(),
  direction: z.enum(["incoming", "outgoing", "unknown"]),
  targetUrl: z.string().optional(),
  payloadContractId: z.string().optional(),
});

const IntegrationDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  sourceSystemId: z.string().optional(),
  targetSystemId: z.string().optional(),
  purpose: z.string().min(1),
  direction: z.enum(["inbound", "outbound", "bidirectional", "unknown"]),
  interactionPattern: z.enum([
    "request-response",
    "webhook",
    "event",
    "batch",
    "file-transfer",
    "database",
    "manual",
    "unknown",
  ]),
  protocol: z.enum(["http", "https", "websocket", "sftp", "jdbc", "messaging", "unknown"]),
  operations: z.array(IntegrationOperationSchema),
  dataContracts: z.array(DataContractSchema),
  authentication: AuthenticationRequirementSchema.optional(),
  reliability: ReliabilityRequirementsSchema,
  failureScenarios: z.array(IntegrationFailureScenarioSchema),
  security: IntegrationSecurityRequirementsSchema,
  restContract: RestContractSchema.optional(),
  webhookContract: WebhookContractSchema.optional(),
  relatedWorkflowIds: z.array(z.string()),
  relatedProcessIds: z.array(z.string()),
  relatedRequirementIds: z.array(z.string()),
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

// ─── Export bundles (Phase 5.5A) ────────────────────────────────────────────

const ExportReadinessReasonSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["info", "warning", "blocking"]),
  architectureRefs: z.array(ArchitectureReferenceSchema),
});

const ExportReadinessSchema = z.object({
  integrationId: z.string().min(1),
  exporterId: z.string().min(1),
  status: z.enum(["ready", "needs-review", "blocked", "unsupported"]),
  reasons: z.array(ExportReadinessReasonSchema),
  informationGapIds: z.array(z.string()),
  securityRequirementIds: z.array(z.string()),
  riskIds: z.array(z.string()),
});

const GeneratedSourceFileSchema = z.object({
  path: z.string().min(1),
  language: z.enum(["typescript", "json", "markdown", "yaml", "text"]),
  role: z.enum(["client", "types", "configuration", "manifest", "documentation", "test"]),
});

const IntegrationExportBundleSchema = z.object({
  id: z.string().min(1),
  integrationId: z.string().min(1),
  exporterId: z.string().min(1),
  readiness: ExportReadinessSchema,
  files: z.array(GeneratedSourceFileSchema),
  artifacts: z.array(ImplementationArtifactSchema),
  notes: z.array(z.string()),
});

export const IntegrationsSectionSchema = z.object({
  implemented: z.boolean(),
  plan: IntegrationPlanSchema.optional(),
  integrations: z.array(IntegrationDefinitionSchema),
  exports: z.array(IntegrationExportBundleSchema),
  artifacts: z.array(ImplementationArtifactSchema),
  notes: z.array(z.string()),
});
