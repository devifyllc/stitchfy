/**
 * Human-in-the-loop approval contract. First-class domain model only — no
 * approval UI is implemented here. A capability that produces a high-risk
 * output (e.g. an AI agent with a low confidence threshold, a modernization
 * migration recommendation) attaches one of these to its output/risks so the
 * governance layer — and eventually a real approvals UI — has something
 * concrete to act on.
 */

import type { RiskLevel } from "../../schemas/common/risk-level.js";

export type ApprovalDecision = "pending" | "approved" | "rejected";

export interface HumanApprovalRequest {
  id: string;
  approvalRequired: boolean;
  approverRole: string;
  reason: string;
  riskLevel: RiskLevel;
  decision: ApprovalDecision;
  timestamp: string;
  comments?: string;
}

export function createApprovalRequest(input: {
  approverRole: string;
  reason: string;
  riskLevel: RiskLevel;
}): HumanApprovalRequest {
  return {
    id: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    approvalRequired: true,
    approverRole: input.approverRole,
    reason: input.reason,
    riskLevel: input.riskLevel,
    decision: "pending",
    timestamp: new Date().toISOString(),
  };
}
