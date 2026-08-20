import { z } from "zod";
import { EvidenceReferenceSchema, ArchitectureReferenceSchema } from "../../../schemas/planning/planning.schema.js";
import { HumanApprovalRequestSchema } from "../../../schemas/common/human-approval.schema.js";
import { InformationGapSchema } from "../../../schemas/discovery/discovery-result.schema.js";

const unknownOrBoolean = z.union([z.boolean(), z.literal("unknown")]);

// ─── Planning ────────────────────────────────────────────────────────────────

const AIAgentCandidateSchema = z.object({
  id: z.string().min(1),
  needId: z.string().min(1),
  name: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentPlanSchema = z.object({
  needIds: z.array(z.string()),
  processIds: z.array(z.string()),
  workflowIds: z.array(z.string()),
  integrationIds: z.array(z.string()),
  requirementIds: z.array(z.string()),
  agentCandidates: z.array(AIAgentCandidateSchema),
  informationGaps: z.array(z.string()),
  assumptions: z.array(z.string()),
});

// ─── AIAgentDefinition parts ────────────────────────────────────────────────

const AIModelRequirementsSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  capabilities: z.array(
    z.enum(["text-generation", "classification", "summarization", "structured-output", "tool-use", "retrieval", "unknown"])
  ),
  structuredOutputRequired: unknownOrBoolean,
  toolUseRequired: unknownOrBoolean,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentToolSpecificationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  kind: z.enum(["integration-operation", "workflow-action", "knowledge-retrieval", "human-escalation", "unknown"]),
  sideEffect: z.enum(["none", "read", "write", "notify", "unknown"]),
  integrationId: z.string().optional(),
  integrationOperationId: z.string().optional(),
  workflowId: z.string().optional(),
  workflowStepId: z.string().optional(),
  inputContractIds: z.array(z.string()),
  outputContractIds: z.array(z.string()),
  approvalRequired: unknownOrBoolean,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentDataContractSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  direction: z.enum(["input", "output"]),
  dataEntityIds: z.array(z.string()),
  integrationDataContractIds: z.array(z.string()),
  description: z.string().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentMemoryStrategySchema = z.object({
  mode: z.enum(["none", "session", "persistent", "unknown"]),
  purpose: z.string().optional(),
  dataEntityIds: z.array(z.string()),
  dataContractIds: z.array(z.string()),
  retention: z.string().optional(),
  containsSensitiveData: unknownOrBoolean,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentPermissionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["read", "write", "notify", "execute", "approve", "unknown"]),
  appliesTo: z.array(ArchitectureReferenceSchema),
  condition: z.string().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentGuardrailSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["scope", "tool-use", "data", "human-approval", "output", "prohibited-action", "unknown"]),
  description: z.string().min(1),
  appliesToToolIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIConfidencePolicySchema = z.object({
  mode: z.enum(["explicit-threshold", "human-review", "abstain", "not-specified"]),
  threshold: z.number().min(0).max(1).optional(),
  actionWhenUncertain: z.enum(["ask-user", "human-review", "abstain", "unknown"]).optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AgentRiskConditionSchema = z.object({
  description: z.string().min(1),
  toolIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentRiskPolicySchema = z.object({
  maximumAutonomousRisk: z.enum(["low", "medium", "high", "unknown"]).optional(),
  requireHumanReviewFor: z.array(AgentRiskConditionSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentEscalationRuleSchema = z.object({
  id: z.string().min(1),
  trigger: z.string().min(1),
  action: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentHumanOversightSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1),
  approval: HumanApprovalRequestSchema,
  appliesToToolIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const AIAgentDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  purpose: z.string().min(1),
  interactionMode: z.enum([
    "conversational",
    "task",
    "decision-support",
    "classification",
    "summarization",
    "generation",
    "orchestration",
    "unknown",
  ]),
  autonomy: z.enum(["assistive", "supervised", "semi-autonomous", "autonomous", "unknown"]),
  modelRequirements: AIModelRequirementsSchema,
  tools: z.array(AIAgentToolSpecificationSchema),
  inputContracts: z.array(AIAgentDataContractSchema),
  outputContracts: z.array(AIAgentDataContractSchema),
  memory: AIAgentMemoryStrategySchema,
  permissions: z.array(AIAgentPermissionSchema),
  guardrails: z.array(AIAgentGuardrailSchema),
  humanOversight: z.array(AIAgentHumanOversightSchema),
  confidencePolicy: AIConfidencePolicySchema,
  riskPolicy: AIAgentRiskPolicySchema,
  escalationPolicy: z.array(AIAgentEscalationRuleSchema),
  relatedNeedIds: z.array(z.string()),
  relatedProcessIds: z.array(z.string()),
  relatedWorkflowIds: z.array(z.string()),
  relatedIntegrationIds: z.array(z.string()),
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

export const AIAgentsSectionSchema = z.object({
  implemented: z.boolean(),
  plan: AIAgentPlanSchema.optional(),
  agents: z.array(AIAgentDefinitionSchema),
  toolCatalog: z.array(AIAgentToolSpecificationSchema),
  artifacts: z.array(ImplementationArtifactSchema),
  notes: z.array(z.string()),
});
