/**
 * Zod mirror of framework/governance/approvals/human-approval.types.ts.
 * Shared by ai-agents.schema.ts and workflow-automation.schema.ts so the
 * shape is defined once instead of duplicated per capability.
 */

import { z } from "zod";

export const HumanApprovalRequestSchema = z.object({
  id: z.string().min(1),
  approvalRequired: z.boolean(),
  approverRole: z.string().min(1),
  reason: z.string(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  decision: z.enum(["pending", "approved", "rejected"]),
  timestamp: z.string().min(1),
  comments: z.string().optional(),
});
