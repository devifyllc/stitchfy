/**
 * Renders output/reports/solution-plan.md straight from already-computed
 * planning data (SolutionPlan, DiscoveryResult, optionally the Workflow
 * Automation plan) — no decision is recomputed here, per task item 16.
 */

import * as fs from "fs";
import * as path from "path";
import type { DiscoveryResult } from "../discovery/discovery-result.types.js";
import type { SolutionPlan } from "../planning/capability-assessment/solution-plan.types.js";
import type { CapabilityAssessment } from "../planning/capability-assessment/capability-assessment.types.js";
import type { WorkflowAutomationPlan } from "../capabilities/workflow-automation/schemas/workflow-automation.types.js";

export interface SolutionPlanReportInput {
  discoveryResult: DiscoveryResult;
  solutionPlan: SolutionPlan;
  /** Present when Workflow Automation was recommended/needs-review — its real plan (task item 8/9). */
  workflowAutomationPlan?: WorkflowAutomationPlan;
}

function buildLookup(discovery: DiscoveryResult): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const g of discovery.goals) lookup.set(g.id, g.description);
  for (const p of discovery.painPoints) lookup.set(p.id, p.description);
  for (const o of discovery.desiredOutcomes) lookup.set(o.id, o.description);
  for (const a of discovery.actors) lookup.set(a.id, a.role || a.description);
  for (const p of discovery.processes) lookup.set(p.id, p.name);
  for (const r of discovery.requirements) lookup.set(r.id, r.description);
  for (const s of discovery.systems) lookup.set(s.id, s.name);
  for (const c of discovery.constraints) lookup.set(c.id, c.description);
  for (const r of discovery.businessRules) lookup.set(r.id, r.description);
  for (const i of discovery.integrationNeeds) lookup.set(i.id, i.description);
  for (const g of discovery.informationGaps) lookup.set(g.id, g.topic);
  return lookup;
}

function describeIds(ids: string[], lookup: Map<string, string>): string {
  if (ids.length === 0) return "none";
  return ids.map((id) => `${lookup.get(id) ?? id} (${id})`).join(", ");
}

function renderCapabilitySection(assessment: CapabilityAssessment, lookup: Map<string, string>): string {
  const lines: string[] = [];
  lines.push(`### ${assessment.capabilityId}`);
  lines.push("");
  lines.push(`- **Status:** ${assessment.status}`);
  lines.push(`- **Confidence:** ${assessment.confidence}`);
  lines.push(`- **Method:** ${assessment.method}`);
  lines.push("");
  lines.push("**Why:**");
  if (assessment.reasons.length === 0) {
    lines.push("- No supporting evidence found.");
  } else {
    for (const reason of assessment.reasons) lines.push(`- ${reason.description}`);
  }
  lines.push("");
  lines.push(`**Processes involved:** ${describeIds(assessment.relatedProcessIds, lookup)}`);
  lines.push(`**Requirements involved:** ${describeIds(assessment.relatedRequirementIds, lookup)}`);
  lines.push(`**Systems involved:** ${describeIds(assessment.relatedSystemIds, lookup)}`);
  if (assessment.blockingGapIds.length > 0) {
    lines.push(`**Blocking gaps:** ${describeIds(assessment.blockingGapIds, lookup)}`);
  }
  return lines.join("\n");
}

function renderWorkflowAutomationDetail(plan: WorkflowAutomationPlan, lookup: Map<string, string>): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("**Automation candidates:**");
  if (plan.automationCandidates.length === 0) {
    lines.push("- none");
  } else {
    for (const c of plan.automationCandidates) {
      lines.push(`- ${c.description} (from process: ${lookup.get(c.processId) ?? c.processId})`);
    }
  }
  lines.push("");
  lines.push("**Human approval considerations:**");
  if (plan.humanTouchpoints.length === 0) {
    lines.push("- none identified");
  } else {
    for (const t of plan.humanTouchpoints) {
      lines.push(`- Trigger: "${t.trigger}"`);
      lines.push(`  Approver: ${t.approval.approverRole} — ${t.reason}`);
    }
  }
  lines.push("");
  lines.push(`**Information gaps:** ${describeIds(plan.informationGaps, lookup)}`);
  lines.push("");
  lines.push("**Assumptions:**");
  for (const a of plan.assumptions) lines.push(`- ${a}`);
  return lines.join("\n");
}

export function renderSolutionPlanReport(input: SolutionPlanReportInput): string {
  const { discoveryResult, solutionPlan, workflowAutomationPlan } = input;
  const lookup = buildLookup(discoveryResult);

  const recommended = solutionPlan.assessments.filter(
    (a) => a.status === "recommended" || a.status === "needs-review"
  );
  const others = solutionPlan.assessments.filter(
    (a) => a.status === "not-recommended" || a.status === "blocked"
  );

  const lines: string[] = [];
  lines.push("# Solution Plan");
  lines.push("");
  lines.push(`_Generated: ${solutionPlan.generatedAt}_`);
  lines.push("");

  lines.push("## Business Context");
  lines.push("");
  lines.push(`- **Business:** ${discoveryResult.businessName} (${discoveryResult.industry || "unknown industry"})`);
  lines.push(`- Goals: ${discoveryResult.goals.length}`);
  lines.push(`- Actors: ${discoveryResult.actors.length}`);
  lines.push(`- Processes: ${discoveryResult.processes.length}`);
  lines.push(`- Requirements: ${discoveryResult.requirements.length}`);
  lines.push(`- Systems: ${discoveryResult.systems.length}`);
  lines.push(
    `- Information gaps: ${discoveryResult.informationGaps.length} (${discoveryResult.informationGaps.filter((g) => g.blocking).length} blocking)`
  );
  lines.push("");

  lines.push("## Recommended Capabilities");
  lines.push("");
  if (recommended.length === 0) {
    lines.push("No capability was recommended for this business context.");
  } else {
    for (const assessment of recommended) {
      lines.push(renderCapabilitySection(assessment, lookup));
      if (assessment.capabilityId === "workflow-automation" && workflowAutomationPlan) {
        lines.push(renderWorkflowAutomationDetail(workflowAutomationPlan, lookup));
      }
      lines.push("");
    }
  }

  lines.push("## Other Capability Assessments");
  lines.push("");
  lines.push("| Capability | Status | Confidence | Method |");
  lines.push("|---|---|---|---|");
  for (const a of others) {
    lines.push(`| ${a.capabilityId} | ${a.status} | ${a.confidence} | ${a.method} |`);
  }
  lines.push("");

  lines.push("## Unresolved Information");
  lines.push("");
  const unresolved = discoveryResult.informationGaps.filter((g) => solutionPlan.unresolvedGaps.includes(g.id));
  if (unresolved.length === 0) {
    lines.push("None.");
  } else {
    for (const gap of unresolved) {
      lines.push(`- **${gap.topic}** (${gap.importance}): ${gap.question}`);
    }
  }
  lines.push("");

  lines.push("## Traceability Summary");
  lines.push("");
  lines.push(`- ${discoveryResult.traceability.length} link(s) total`);
  const byRelationship = new Map<string, number>();
  for (const link of discoveryResult.traceability) {
    byRelationship.set(link.relationship, (byRelationship.get(link.relationship) ?? 0) + 1);
  }
  for (const [relationship, count] of byRelationship) {
    lines.push(`  - ${relationship}: ${count}`);
  }
  lines.push("");
  lines.push("_Full detail: `output/context/business-context.json`, `output/blueprints/solution-blueprint.v1.json`._");
  lines.push("");

  return lines.join("\n");
}

export interface WriteResult {
  ok: boolean;
  filePath?: string;
}

export function writeSolutionPlanReport(markdown: string, outputDir: string): WriteResult {
  const reportsDir = path.join(outputDir, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const filePath = path.join(reportsDir, "solution-plan.md");
  fs.writeFileSync(filePath, markdown);
  return { ok: true, filePath };
}
