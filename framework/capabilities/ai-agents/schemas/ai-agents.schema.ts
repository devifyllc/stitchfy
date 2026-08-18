import { z } from "zod";

const AIAgentToolSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
});

const HumanApprovalRequestSchema = z.object({
  id: z.string().min(1),
  approvalRequired: z.boolean(),
  approverRole: z.string().min(1),
  reason: z.string(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  decision: z.enum(["pending", "approved", "rejected"]),
  timestamp: z.string().min(1),
  comments: z.string().optional(),
});

const AIAgentDefinitionSchema = z.object({
  id: z.string().min(1),
  purpose: z.string().min(1),
  modelProvider: z.string(),
  model: z.string(),
  tools: z.array(AIAgentToolSchema),
  inputContract: z.string(),
  outputContract: z.string(),
  memory: z.enum(["none", "session", "persistent"]),
  permissions: z.array(z.string()),
  guardrails: z.array(z.string()),
  humanApproval: HumanApprovalRequestSchema.optional(),
  escalationPolicy: z.string(),
  confidenceThreshold: z.number().min(0).max(1),
  riskThreshold: z.string(),
});

export const AIAgentsSectionSchema = z.object({
  implemented: z.boolean(),
  agents: z.array(AIAgentDefinitionSchema),
  notes: z.array(z.string()),
});
