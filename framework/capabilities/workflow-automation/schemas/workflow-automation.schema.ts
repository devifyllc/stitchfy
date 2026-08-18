import { z } from "zod";

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
  triggers: z.array(WorkflowTriggerSchema),
  steps: z.array(WorkflowStepSchema),
  decisions: z.array(WorkflowDecisionSchema),
  approvals: z.array(WorkflowApprovalSchema),
  notifications: z.array(z.string()),
  externalSystems: z.array(z.string()),
  notes: z.array(z.string()),
});
