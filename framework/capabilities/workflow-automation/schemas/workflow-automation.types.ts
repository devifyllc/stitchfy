import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { HumanApprovalRequest } from "../../../governance/approvals/human-approval.types.js";

/**
 * Phase 1.5 — the real, structured output of
 * workflow-automation.planner.ts. Architectural plan only: no external
 * system is actually integrated (see AutomationCandidate.processId /
 * evidenceRefs — always DiscoveryResult entities, never a live API call).
 */
export interface AutomationCandidate {
  description: string;
  processId: string;
  evidenceRefs: EvidenceReference[];
}

export interface HumanTouchpoint {
  id: string;
  trigger: string;
  reason: string;
  approval: HumanApprovalRequest;
  evidenceRefs: EvidenceReference[];
}

export interface WorkflowAutomationPlan {
  processIds: string[];
  requirementIds: string[];
  systemIds: string[];
  automationCandidates: AutomationCandidate[];
  humanTouchpoints: HumanTouchpoint[];
  integrationNeeds: string[];
  informationGaps: string[];
  assumptions: string[];
}

export interface WorkflowTrigger {
  id: string;
  type: string;
  description: string;
}

export type WorkflowStepType = "automated-task" | "human-task" | "decision" | "notification";

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  description: string;
}

export interface WorkflowDecision {
  id: string;
  condition: string;
  branches: string[];
}

export interface WorkflowApproval {
  id: string;
  approverRole: string;
  stepId: string;
}

export interface WorkflowAutomationSection {
  implemented: boolean;
  /** The Phase 1.5 structured plan — present once assess() recommends this capability. */
  plan?: WorkflowAutomationPlan;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  decisions: WorkflowDecision[];
  approvals: WorkflowApproval[];
  notifications: string[];
  externalSystems: string[];
  notes: string[];
}
