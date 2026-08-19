import { z } from "zod";
import { EvidenceReferenceSchema } from "../../../schemas/planning/planning.schema.js";
import { HumanApprovalRequestSchema } from "../../../schemas/common/human-approval.schema.js";
import { InformationGapSchema } from "../../../schemas/discovery/discovery-result.schema.js";

const AutomationCandidateSchema = z.object({
  description: z.string().min(1),
  processId: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const HumanTouchpointSchema = z.object({
  id: z.string().min(1),
  trigger: z.string().min(1),
  reason: z.string().min(1),
  approval: HumanApprovalRequestSchema,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const WorkflowAutomationPlanSchema = z.object({
  processIds: z.array(z.string()),
  requirementIds: z.array(z.string()),
  systemIds: z.array(z.string()),
  automationCandidates: z.array(AutomationCandidateSchema),
  humanTouchpoints: z.array(HumanTouchpointSchema),
  integrationNeeds: z.array(z.string()),
  informationGaps: z.array(z.string()),
  assumptions: z.array(z.string()),
});

const WorkflowTriggerSchema = z.object({
  id: z.string().min(1),
  type: z.literal("business-event"),
  description: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["automated-task", "human-task", "external-task", "decision", "notification"]),
  description: z.string(),
  actorIds: z.array(z.string()).optional(),
  systemIds: z.array(z.string()).optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const WorkflowTransitionSchema = z.object({
  id: z.string().min(1),
  fromStepId: z.string().min(1),
  toStepId: z.string().min(1),
  condition: z.string().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema).optional(),
});

const WorkflowDecisionBranchSchema = z.object({
  label: z.string().min(1),
  toStepId: z.string().min(1),
});

const WorkflowDecisionSchema = z.object({
  id: z.string().min(1),
  stepId: z.string().min(1),
  condition: z.string().min(1),
  branches: z.array(WorkflowDecisionBranchSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const WorkflowApprovalSchema = z.object({
  id: z.string().min(1),
  stepId: z.string().min(1),
  approval: HumanApprovalRequestSchema,
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const WorkflowNotificationSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  recipientActorIds: z.array(z.string()).optional(),
  channel: z.enum(["email", "sms", "whatsapp", "push", "unknown"]),
  timing: z.string().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const WorkflowExternalSystemSchema = z.object({
  systemId: z.string().min(1),
  role: z.string(),
  interactionType: z.string().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const WorkflowDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  processId: z.string().min(1),
  triggers: z.array(WorkflowTriggerSchema),
  steps: z.array(WorkflowStepSchema),
  transitions: z.array(WorkflowTransitionSchema),
  decisions: z.array(WorkflowDecisionSchema),
  approvals: z.array(WorkflowApprovalSchema),
  notifications: z.array(WorkflowNotificationSchema),
  externalSystems: z.array(WorkflowExternalSystemSchema),
  informationGaps: z.array(InformationGapSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
  status: z.enum(["draft", "complete", "needs-review"]),
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

export const WorkflowAutomationSectionSchema = z.object({
  implemented: z.boolean(),
  plan: WorkflowAutomationPlanSchema.optional(),
  workflows: z.array(WorkflowDefinitionSchema),
  artifacts: z.array(ImplementationArtifactSchema),
  notes: z.array(z.string()),
});
