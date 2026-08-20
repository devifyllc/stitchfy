/**
 * Renders ImplementationArtifacts (task item 19) strictly from an
 * already-built WorkflowDefinition — no workflow logic is re-derived here,
 * including the Mermaid diagram (task item 20): it's a plain template
 * built from `steps`/`transitions`, no runtime dependency.
 */

import { createArtifact } from "../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { WorkflowDefinition, WorkflowStep } from "../schemas/workflow-automation.types.js";

const CAPABILITY_ID = "workflow-automation";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function describeId(id: string, lookup: Map<string, string>): string {
  return `${lookup.get(id) ?? id} (${id})`;
}

function buildLookup(discovery: DiscoveryResult): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const a of discovery.actors) lookup.set(a.id, a.role || a.description);
  for (const s of discovery.systems) lookup.set(s.id, s.name);
  for (const p of discovery.processes) lookup.set(p.id, p.name);
  return lookup;
}

function stepShape(step: WorkflowStep): [string, string] {
  if (step.type === "decision") return ["{", "}"];
  if (step.type === "notification") return ["([", "])"];
  return ["[", "]"];
}

function renderMermaid(workflow: WorkflowDefinition): string {
  const lines: string[] = ["flowchart TD"];
  const nodeId = (id: string) => id.replace(/-/g, "_");

  for (const step of workflow.steps) {
    const [open, close] = stepShape(step);
    lines.push(`    ${nodeId(step.id)}${open}"${step.name.replace(/"/g, "'")}"${close}`);
  }
  for (const t of workflow.transitions) {
    const label = t.condition ? `|${t.condition.replace(/"/g, "'")}|` : "";
    lines.push(`    ${nodeId(t.fromStepId)} -->${label} ${nodeId(t.toStepId)}`);
  }

  return lines.join("\n");
}

function renderMarkdown(workflow: WorkflowDefinition, discovery: DiscoveryResult): string {
  const lookup = buildLookup(discovery);
  const process = discovery.processes.find((p) => p.id === workflow.processId);
  const lines: string[] = [];

  lines.push(`# ${workflow.name}`);
  lines.push("");
  lines.push(`_Status: **${workflow.status}**${workflow.statusReasons.length > 0 ? ` (${workflow.statusReasons.join("; ")})` : ""}_`);
  lines.push("");
  lines.push(
    "> `implemented: true` on this capability means Stitchfy generated and validated this vendor-neutral " +
      "specification — it does not mean this workflow has been deployed or is running against real systems."
  );
  lines.push("");

  lines.push("## Source Process");
  lines.push("");
  lines.push(`${describeId(workflow.processId, lookup)}`);
  lines.push("");

  lines.push("## Trigger");
  lines.push("");
  if (workflow.triggers.length === 0) {
    lines.push("_No explicit trigger was discovered for this process._");
  } else {
    for (const t of workflow.triggers) lines.push(`- **${t.type}:** ${t.description}`);
  }
  lines.push("");

  lines.push("## Current Process (AS-IS)");
  lines.push("");
  if (process) {
    lines.push(`Trigger: ${process.trigger || "_not stated_"}`);
    lines.push("");
    lines.push("Steps:");
    process.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    if (process.manualSteps.length > 0) {
      lines.push("");
      lines.push("Manual steps: " + process.manualSteps.join("; "));
    }
    if (process.automationCandidates.length > 0) {
      lines.push("");
      lines.push("Discovered automation candidates: " + process.automationCandidates.join("; "));
    }
  } else {
    lines.push("_Source process not found._");
  }
  lines.push("");

  lines.push("## Proposed Workflow (TO-BE)");
  lines.push("");
  lines.push("```mermaid");
  lines.push(renderMermaid(workflow));
  lines.push("```");
  lines.push("");
  workflow.steps.forEach((s, i) => {
    lines.push(`${i + 1}. **${s.name}** _(${s.type})_ — ${s.description}`);
  });
  lines.push("");

  lines.push("## Human Tasks");
  lines.push("");
  const humanSteps = workflow.steps.filter((s) => s.type === "human-task");
  if (humanSteps.length === 0) lines.push("None.");
  else for (const s of humanSteps) lines.push(`- ${s.name}${s.actorIds?.length ? ` — ${s.actorIds.map((id) => describeId(id, lookup)).join(", ")}` : ""}`);
  lines.push("");

  lines.push("## Automated Tasks");
  lines.push("");
  const autoSteps = workflow.steps.filter((s) => s.type === "automated-task" || s.type === "external-task");
  if (autoSteps.length === 0) lines.push("None.");
  else for (const s of autoSteps) lines.push(`- ${s.name} _(${s.type})_`);
  lines.push("");

  lines.push("## Decisions");
  lines.push("");
  if (workflow.decisions.length === 0) lines.push("None — no explicit conditional logic was discovered.");
  else {
    for (const d of workflow.decisions) {
      lines.push(`- **${d.condition}**`);
      for (const b of d.branches) lines.push(`  - ${b.label} → ${describeId(b.toStepId, new Map(workflow.steps.map((s) => [s.id, s.name])))}`);
    }
  }
  lines.push("");

  lines.push("## Approvals");
  lines.push("");
  if (workflow.approvals.length === 0) lines.push("None.");
  else for (const a of workflow.approvals) lines.push(`- Approver: ${a.approval.approverRole} — ${a.approval.reason}`);
  lines.push("");

  lines.push("## Notifications");
  lines.push("");
  if (workflow.notifications.length === 0) lines.push("None.");
  else for (const n of workflow.notifications) lines.push(`- ${n.description} — channel: ${n.channel}`);
  lines.push("");

  lines.push("## External Systems");
  lines.push("");
  if (workflow.externalSystems.length === 0) lines.push("None.");
  else for (const es of workflow.externalSystems) lines.push(`- ${describeId(es.systemId, lookup)} — ${es.role}${es.interactionType ? ` (${es.interactionType})` : ""}`);
  lines.push("");

  lines.push("## Information Gaps");
  lines.push("");
  if (workflow.informationGaps.length === 0) lines.push("None.");
  else for (const g of workflow.informationGaps) lines.push(`- **${g.topic}**: ${g.question}`);
  lines.push("");

  lines.push("## Traceability");
  lines.push("");
  lines.push(`Source process: ${describeId(workflow.processId, lookup)}`);
  lines.push(`Steps: ${workflow.steps.length}, Transitions: ${workflow.transitions.length}, Decisions: ${workflow.decisions.length}, Approvals: ${workflow.approvals.length}`);
  lines.push("");

  return lines.join("\n");
}

export function buildWorkflowArtifacts(
  workflow: WorkflowDefinition,
  discovery: DiscoveryResult
): ImplementationArtifact[] {
  const slug = slugify(workflow.name.replace(/ Workflow$/i, ""));

  const jsonArtifact = createArtifact({
    capabilityId: CAPABILITY_ID,
    type: "config",
    path: `artifacts/workflow-automation/${slug}.workflow.json`,
    content: JSON.stringify(workflow, null, 2),
    metadata: { workflowId: workflow.id, processId: workflow.processId },
  });

  const markdownArtifact = createArtifact({
    capabilityId: CAPABILITY_ID,
    type: "document",
    path: `artifacts/workflow-automation/${slug}.workflow.md`,
    content: renderMarkdown(workflow, discovery),
    metadata: { workflowId: workflow.id, processId: workflow.processId },
  });

  return [jsonArtifact, markdownArtifact];
}
