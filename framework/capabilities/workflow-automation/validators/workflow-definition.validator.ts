/**
 * Deterministic validation beyond the Zod shape check (task item 17):
 * referential integrity, structural integrity, reachability, and cycle
 * detection. workflow-definition.generator.ts builds a well-formed graph by
 * construction, so a failure here almost always means a generator bug —
 * that's the point: this is a real, independent check, not a rubber stamp.
 */

import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { WorkflowDefinition, WorkflowStep } from "../schemas/workflow-automation.types.js";

export interface WorkflowValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface WorkflowValidationResult {
  ok: boolean;
  issues: WorkflowValidationIssue[];
}

function checkReferentialIntegrity(workflow: WorkflowDefinition, discovery: DiscoveryResult): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const stepIds = new Set(workflow.steps.map((s) => s.id));
  const actorIds = new Set(discovery.actors.map((a) => a.id));
  const systemIds = new Set(discovery.systems.map((s) => s.id));

  if (!discovery.processes.some((p) => p.id === workflow.processId)) {
    issues.push({ code: "unknown-process", message: `processId "${workflow.processId}" not found in DiscoveryResult`, severity: "error" });
  }

  for (const step of workflow.steps) {
    for (const id of step.actorIds ?? []) {
      if (!actorIds.has(id)) issues.push({ code: "unknown-actor", message: `step "${step.id}" references unknown actor "${id}"`, severity: "error" });
    }
    for (const id of step.systemIds ?? []) {
      if (!systemIds.has(id)) issues.push({ code: "unknown-system", message: `step "${step.id}" references unknown system "${id}"`, severity: "error" });
    }
  }

  for (const t of workflow.transitions) {
    if (!stepIds.has(t.fromStepId)) issues.push({ code: "broken-transition", message: `transition "${t.id}" fromStepId "${t.fromStepId}" does not exist`, severity: "error" });
    if (!stepIds.has(t.toStepId)) issues.push({ code: "broken-transition", message: `transition "${t.id}" toStepId "${t.toStepId}" does not exist`, severity: "error" });
  }

  for (const d of workflow.decisions) {
    if (!stepIds.has(d.stepId)) issues.push({ code: "broken-decision", message: `decision "${d.id}" stepId "${d.stepId}" does not exist`, severity: "error" });
    for (const b of d.branches) {
      if (!stepIds.has(b.toStepId)) issues.push({ code: "broken-decision-branch", message: `decision "${d.id}" branch "${b.label}" targets missing step "${b.toStepId}"`, severity: "error" });
    }
  }

  for (const a of workflow.approvals) {
    if (!stepIds.has(a.stepId)) issues.push({ code: "broken-approval", message: `approval "${a.id}" stepId "${a.stepId}" does not exist`, severity: "error" });
  }

  for (const es of workflow.externalSystems) {
    if (!systemIds.has(es.systemId)) issues.push({ code: "unknown-system", message: `externalSystems entry references unknown system "${es.systemId}"`, severity: "error" });
  }

  for (const n of workflow.notifications) {
    for (const id of n.recipientActorIds ?? []) {
      if (!actorIds.has(id)) issues.push({ code: "unknown-actor", message: `notification "${n.id}" references unknown actor "${id}"`, severity: "error" });
    }
  }

  return issues;
}

function checkStructuralIntegrity(workflow: WorkflowDefinition, discovery: DiscoveryResult): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const stepById = new Map(workflow.steps.map((s) => [s.id, s] as [string, WorkflowStep]));

  const stepIdCounts = new Map<string, number>();
  for (const s of workflow.steps) stepIdCounts.set(s.id, (stepIdCounts.get(s.id) ?? 0) + 1);
  for (const [id, count] of stepIdCounts) {
    if (count > 1) issues.push({ code: "duplicate-step-id", message: `step id "${id}" is used ${count} times`, severity: "error" });
  }

  const transitionIdCounts = new Map<string, number>();
  for (const t of workflow.transitions) transitionIdCounts.set(t.id, (transitionIdCounts.get(t.id) ?? 0) + 1);
  for (const [id, count] of transitionIdCounts) {
    if (count > 1) issues.push({ code: "duplicate-transition-id", message: `transition id "${id}" is used ${count} times`, severity: "error" });
  }

  if (workflow.steps.length === 0) {
    issues.push({ code: "no-steps", message: "workflow has no steps", severity: "error" });
  }

  const process = discovery.processes.find((p) => p.id === workflow.processId);
  if (process && process.trigger.trim().length > 0 && workflow.triggers.length === 0) {
    issues.push({ code: "missing-trigger", message: "source process has an explicit trigger but none was generated", severity: "error" });
  }

  for (const a of workflow.approvals) {
    const step = stepById.get(a.stepId);
    if (step && step.type !== "human-task") {
      issues.push({ code: "invalid-approval-target", message: `approval "${a.id}" targets step "${a.stepId}" of type "${step.type}", expected "human-task"`, severity: "error" });
    }
  }

  for (const d of workflow.decisions) {
    const step = stepById.get(d.stepId);
    if (step && step.type !== "decision") {
      issues.push({ code: "invalid-decision-target", message: `decision "${d.id}" targets step "${d.stepId}" of type "${step.type}", expected "decision"`, severity: "error" });
    }
    if (d.branches.length === 0) {
      issues.push({ code: "decision-without-branches", message: `decision "${d.id}" has no branches`, severity: "error" });
    }
  }

  return issues;
}

function checkReachability(workflow: WorkflowDefinition): WorkflowValidationIssue[] {
  if (workflow.steps.length === 0) return [];

  const adjacency = new Map<string, string[]>();
  for (const t of workflow.transitions) {
    const list = adjacency.get(t.fromStepId) ?? [];
    list.push(t.toStepId);
    adjacency.set(t.fromStepId, list);
  }

  const entry = workflow.steps[0].id;
  const visited = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return workflow.steps
    .filter((s) => !visited.has(s.id))
    .map((s): WorkflowValidationIssue => ({
      code: "orphan-step",
      message: `step "${s.id}" ("${s.name}") is not reachable from the workflow's entry step`,
      severity: "warning",
    }));
}

/**
 * The generator never intentionally creates a back-edge (branches always
 * converge forward or terminate) — so any cycle found here is, by
 * construction, a generator bug rather than a legitimate discovered loop.
 * A future phase that adds evidence-driven looping should relax this to
 * only error on cycles that aren't traceable to explicit source evidence.
 */
function checkCycles(workflow: WorkflowDefinition): WorkflowValidationIssue[] {
  const adjacency = new Map<string, string[]>();
  for (const t of workflow.transitions) {
    const list = adjacency.get(t.fromStepId) ?? [];
    list.push(t.toStepId);
    adjacency.set(t.fromStepId, list);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>(workflow.steps.map((s) => [s.id, WHITE]));
  const issues: WorkflowValidationIssue[] = [];

  function visit(nodeId: string, path: string[]): void {
    color.set(nodeId, GRAY);
    for (const next of adjacency.get(nodeId) ?? []) {
      const state = color.get(next);
      if (state === GRAY) {
        issues.push({
          code: "unexpected-cycle",
          message: `cycle detected: ${[...path, nodeId, next].join(" -> ")}`,
          severity: "error",
        });
      } else if (state === WHITE) {
        visit(next, [...path, nodeId]);
      }
    }
    color.set(nodeId, BLACK);
  }

  for (const step of workflow.steps) {
    if (color.get(step.id) === WHITE) visit(step.id, []);
  }

  return issues;
}

export function validateWorkflowDefinition(
  workflow: WorkflowDefinition,
  discovery: DiscoveryResult
): WorkflowValidationResult {
  const issues = [
    ...checkReferentialIntegrity(workflow, discovery),
    ...checkStructuralIntegrity(workflow, discovery),
    ...checkReachability(workflow),
    ...checkCycles(workflow),
  ];

  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
