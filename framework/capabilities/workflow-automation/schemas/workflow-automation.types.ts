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
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  decisions: WorkflowDecision[];
  approvals: WorkflowApproval[];
  notifications: string[];
  externalSystems: string[];
  notes: string[];
}
