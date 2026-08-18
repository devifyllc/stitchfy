import type { HumanApprovalRequest } from "../../../governance/approvals/human-approval.types.js";

export interface AIAgentTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export type AIAgentMemory = "none" | "session" | "persistent";

export interface AIAgentDefinition {
  id: string;
  purpose: string;
  modelProvider: string;
  model: string;
  tools: AIAgentTool[];
  inputContract: string;
  outputContract: string;
  memory: AIAgentMemory;
  permissions: string[];
  guardrails: string[];
  humanApproval?: HumanApprovalRequest;
  escalationPolicy: string;
  confidenceThreshold: number;
  riskThreshold: string;
}

export interface AIAgentsSection {
  implemented: boolean;
  agents: AIAgentDefinition[];
  notes: string[];
}
