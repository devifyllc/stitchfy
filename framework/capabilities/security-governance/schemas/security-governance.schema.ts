import { z } from "zod";
import { EvidenceReferenceSchema, ArchitectureReferenceSchema } from "../../../schemas/planning/planning.schema.js";
import { RiskAssessmentSchema } from "../../../planning/risk-assessment/risk-assessment.schema.js";

const InformationGapReferenceSchema = z.object({
  gapId: z.string().min(1),
  topic: z.string().min(1),
  question: z.string().min(1),
  isNew: z.boolean(),
});

const SecurityRequirementSchema = z.object({
  id: z.string().min(1),
  domain: z.enum([
    "identity",
    "authorization",
    "data-protection",
    "secrets",
    "integration",
    "audit",
    "privacy",
    "availability",
    "input-validation",
    "human-oversight",
    "unknown",
  ]),
  description: z.string().min(1),
  priority: z.enum(["required", "recommended", "review"]),
  appliesTo: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema).min(1, "SecurityRequirement must have at least one evidence reference"),
  status: z.enum(["defined", "needs-information"]),
});

const TrustBoundarySchema = z.object({
  id: z.string().min(1),
  sourceSystemId: z.string().optional(),
  targetSystemId: z.string().optional(),
  integrationId: z.string().optional(),
  classification: z.enum(["internal", "external", "third-party", "unknown"]),
  dataContractIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const unknownOrBoolean = z.union([z.boolean(), z.literal("unknown")]);

const DataProtectionRequirementSchema = z.object({
  id: z.string().min(1),
  dataEntityIds: z.array(z.string()),
  dataContractIds: z.array(z.string()),
  classification: z.enum(["public", "internal", "confidential", "restricted", "unknown"]),
  encryptionInTransit: unknownOrBoolean,
  encryptionAtRest: unknownOrBoolean,
  retentionRequirement: z.string().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const IdentityAccessRequirementSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["identity", "authorization"]),
  description: z.string().min(1),
  appliesTo: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const IntegrationSecurityRequirementSchema = z.object({
  integrationId: z.string().min(1),
  relatedSecurityRequirementIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AuditRequirementSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  appliesTo: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

export const SecurityArchitectureSchema = z.object({
  version: z.string().min(1),
  requirements: z.array(SecurityRequirementSchema),
  trustBoundaries: z.array(TrustBoundarySchema),
  dataProtection: z.array(DataProtectionRequirementSchema),
  identityAccess: z.array(IdentityAccessRequirementSchema),
  integrationSecurity: z.array(IntegrationSecurityRequirementSchema),
  auditRequirements: z.array(AuditRequirementSchema),
  risks: z.array(RiskAssessmentSchema),
  informationGaps: z.array(InformationGapReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
  status: z.enum(["draft", "needs-review", "complete"]),
  statusReasons: z.array(z.string()),
});

const GovernanceApprovalControlSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  workflowId: z.string().optional(),
  approvalId: z.string().optional(),
  appliesTo: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const DecisionControlSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  decisionId: z.string().optional(),
  appliesTo: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const GovernancePolicySchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  appliesTo: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const ComplianceConsiderationSchema = z.object({
  id: z.string().min(1),
  framework: z.string().optional(),
  status: z.enum(["explicit", "potential", "unknown"]),
  rationale: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentGovernanceControlSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  type: z.enum(["tool-invocation", "human-approval", "decision", "memory", "output-review", "scope"]),
  description: z.string().min(1),
  appliesTo: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

export const GovernancePlanSchema = z.object({
  policies: z.array(GovernancePolicySchema),
  humanOversight: z.array(GovernanceApprovalControlSchema),
  auditRequirements: z.array(AuditRequirementSchema),
  decisionControls: z.array(DecisionControlSchema),
  complianceConsiderations: z.array(ComplianceConsiderationSchema),
  informationGaps: z.array(z.string()),
  aiAgentControls: z.array(AIAgentGovernanceControlSchema).optional(),
  status: z.enum(["draft", "needs-review", "complete"]),
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

export const SecurityGovernanceOutputSchema = z.object({
  implemented: z.boolean(),
  security: SecurityArchitectureSchema,
  governance: GovernancePlanSchema,
  artifacts: z.array(ImplementationArtifactSchema),
  notes: z.array(z.string()),
});
