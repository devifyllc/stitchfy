import { z } from "zod";
import { EvidenceReferenceSchema } from "../../../schemas/planning/planning.schema.js";
import { HumanApprovalRequestSchema } from "../../../schemas/common/human-approval.schema.js";

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
  type: z.string().min(1),
  description: z.string(),
});

const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["automated-task", "human-task", "decision", "notification"]),
  description: z.string(),
});

const WorkflowDecisionSchema = z.object({
  id: z.string().min(1),
  condition: z.string(),
  branches: z.array(z.string()),
});

const WorkflowApprovalSchema = z.object({
  id: z.string().min(1),
  approverRole: z.string().min(1),
  stepId: z.string().min(1),
});

export const WorkflowAutomationSectionSchema = z.object({
  implemented: z.boolean(),
  plan: WorkflowAutomationPlanSchema.optional(),
  triggers: z.array(WorkflowTriggerSchema),
  steps: z.array(WorkflowStepSchema),
  decisions: z.array(WorkflowDecisionSchema),
  approvals: z.array(WorkflowApprovalSchema),
  notifications: z.array(z.string()),
  externalSystems: z.array(z.string()),
  notes: z.array(z.string()),
});
