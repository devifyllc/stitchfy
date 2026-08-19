/**
 * Solution Orchestrator — drives the new capability-era pipeline:
 *
 *   project.md → Business Discovery → SolutionContext
 *     → Solution Architect (draft blueprint)
 *     → Capability Registry (plan → execute → validate per capability)
 *     → Risk Assessment
 *     → Validation → business-context.json + solution-blueprint.v1.json
 *
 * This is entirely additive: framework/orchestrator/orchestrator.ts (the
 * existing project.md → website-blueprint.v1.json pipeline) is untouched.
 * The "website" capability (framework/capabilities/website) calls that
 * existing pipeline as one of the capabilities run below.
 */

import * as fs from "fs";
import * as path from "path";
import { parseMarkdown } from "../core/markdown-parser.js";
import { createSolutionContext, type SolutionContext } from "../core/contracts/context.js";
import type { SolutionBlueprint } from "../schemas/solution-blueprint/solution-blueprint.types.js";
import type { SecuritySection, GovernanceSection } from "../capabilities/security-governance/schemas/security-governance.types.js";
import type { CapabilityExecutionResult } from "../schemas/capability/capability-result.types.js";
import { businessDiscoveryAgent } from "../discovery/business/business-discovery.agent.js";
import { deriveBusinessContext } from "../discovery/discovery-result.types.js";
import { draftSolutionBlueprint } from "../planning/solution-architect/solution-architect.js";
import { assessRisks } from "../planning/risk-assessment/risk-assessment.js";
import { assessAllCapabilities } from "../planning/capability-assessment/assess-capabilities.js";
import { buildSolutionPlan } from "../planning/capability-assessment/solution-plan.js";
import { createDefaultRegistry } from "../core/registry/default-capabilities.js";
import { runCapability } from "./capability-runner.js";
import { writeBusinessContextArtifact } from "../core/business-context-writer.js";
import { writeSolutionBlueprintArtifact } from "../core/solution-blueprint-writer.js";
import { renderSolutionPlanReport, writeSolutionPlanReport } from "../reports/render-solution-plan-report.js";
import { logAuditEvent } from "../governance/audit/audit-logger.js";
import type { ProjectMeta } from "../schemas/blueprint.types.js";
import type { WorkflowAutomationSection } from "../capabilities/workflow-automation/schemas/workflow-automation.types.js";

const DIVIDER = "━".repeat(52);

function ok(message: string) {
  console.log(`  ✓  ${message}`);
}

function warn(message: string) {
  console.warn(`  ⚠  ${message}`);
}

function fail(message: string) {
  console.error(`  ✗  ${message}`);
}

// Single-field capability → SolutionBlueprint section lookup — a plain map,
// not a switch, so adding a capability never means editing this function.
const SINGLE_FIELD_MAP: Partial<Record<string, keyof SolutionBlueprint>> = {
  "workflow-automation": "automation",
  "ai-agents": "ai",
  integrations: "integrations",
  cloud: "architecture",
  observability: "observability",
  modernization: "modernization",
};

function mergeCapabilityOutput(blueprint: Partial<SolutionBlueprint>, result: CapabilityExecutionResult): void {
  if (result.status !== "executed" || result.output === undefined) return;

  if (result.capabilityId === "security-governance") {
    const output = result.output as { security: SecuritySection; governance: GovernanceSection };
    blueprint.security = output.security;
    blueprint.governance = output.governance;
    return;
  }

  if (result.capabilityId === "website") return; // WebsiteBlueprint lives in its own output dir, not on SolutionBlueprint

  const field = SINGLE_FIELD_MAP[result.capabilityId];
  if (field) {
    (blueprint as Record<string, unknown>)[field] = result.output;
  }
}

export async function runSolutionPipeline(inputPath: string, outputDir: string): Promise<SolutionContext> {
  console.log(`\n${DIVIDER}`);
  console.log("  Stitchfy — Solution Pipeline (Phase 0)");
  console.log(DIVIDER);
  console.log(`  Input:  ${inputPath}`);
  console.log(`  Output: ${outputDir}`);

  if (!fs.existsSync(inputPath)) {
    fail(`File not found: ${inputPath}`);
    throw new Error(`File not found: ${inputPath}`);
  }

  const markdown = fs.readFileSync(inputPath, "utf-8");
  const parsed = parseMarkdown(markdown);
  const context = createSolutionContext(inputPath, outputDir, markdown, parsed);

  // ── Business discovery ──────────────────────────────────────────────────
  context.stage = "discovery";
  const discoveryResult = await businessDiscoveryAgent.run({ parsed });
  context.discoveryResult = discoveryResult;
  context.businessContext = deriveBusinessContext(discoveryResult);

  ok(`Business discovery: ${discoveryResult.businessName} (${discoveryResult.industry || "unknown industry"})`);
  ok(
    `Extracted: ${discoveryResult.goals.length} goals, ${discoveryResult.actors.length} actors, ` +
      `${discoveryResult.processes.length} processes, ${discoveryResult.requirements.length} requirements, ` +
      `${discoveryResult.systems.length} systems, ${discoveryResult.constraints.length} constraints, ` +
      `${discoveryResult.businessRules.length} business rules`
  );
  ok(`Traceability: ${discoveryResult.traceability.length} links`);
  if (discoveryResult.informationGaps.length > 0) {
    warn(
      `Information gaps: ${discoveryResult.informationGaps.length} (${discoveryResult.informationGaps
        .filter((g) => g.blocking)
        .length} blocking)`
    );
  }

  const contextWrite = writeBusinessContextArtifact(discoveryResult, outputDir);
  if (contextWrite.ok) {
    ok(`${contextWrite.filePath} (${contextWrite.sizeKb} KB)`);
  } else {
    for (const err of contextWrite.errors ?? []) fail(err);
  }

  // ── Planning ─────────────────────────────────────────────────────────────
  // Assess every registered capability BEFORE any of them execute — this is
  // what makes selection explainable: the decision is made and recorded
  // once, up front, not discovered implicitly as a side effect of running
  // capability-runner.ts (see docs/architecture/ARCHITECTURE.md "Solution
  // Planning").
  context.stage = "planning";
  const project: ProjectMeta = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(inputPath),
    frameworkVersion: "0.1.0-solution",
  };
  context.solutionBlueprint = draftSolutionBlueprint(project, discoveryResult);

  const registry = createDefaultRegistry();
  const assessments = assessAllCapabilities(registry, context);
  context.capabilityAssessments = assessments;

  const solutionPlan = buildSolutionPlan(assessments, discoveryResult);
  context.solutionPlan = solutionPlan;
  context.solutionBlueprint.planning = solutionPlan;

  for (const assessment of assessments) {
    logAuditEvent({
      actor: "capability-assessor",
      action: "capability.assessed",
      capabilityId: assessment.capabilityId,
      details: {
        status: assessment.status,
        confidence: assessment.confidence,
        method: assessment.method,
        reasonCodes: assessment.reasons.map((r) => r.code),
      },
    });
  }
  for (const decision of solutionPlan.decisions) {
    logAuditEvent({
      actor: "solution-planner",
      action: "capability.decision",
      capabilityId: decision.capabilityId,
      details: { decision: decision.decision },
    });
  }

  ok(
    `Planning: ${solutionPlan.selectedCapabilities.length}/${assessments.length} capabilities selected ` +
      `(${solutionPlan.unresolvedGaps.length} unresolved blocking gap(s))`
  );
  for (const assessment of assessments) {
    console.log(`  ·  ${assessment.capabilityId}: ${assessment.status} (${assessment.confidence}, ${assessment.method})`);
  }

  // ── Capabilities ─────────────────────────────────────────────────────────
  context.stage = "capabilities";

  for (const capability of registry.getAll()) {
    const result = await runCapability(capability, context);
    context.capabilityResults.push(result);
    context.solutionBlueprint.capabilities = context.capabilityResults;
    mergeCapabilityOutput(context.solutionBlueprint, result);

    if (result.status === "skipped") {
      console.log(`  ·  ${result.capabilityName}: skipped (not applicable)`);
    } else if (result.success) {
      ok(`${result.capabilityName}: ${result.summary ?? "executed"}`);
    } else {
      fail(`${result.capabilityName}: ${result.error}`);
    }
  }

  context.solutionBlueprint.risks = assessRisks(context);

  // ── Planning report ──────────────────────────────────────────────────────
  const workflowAutomationOutput = context.solutionBlueprint.automation as WorkflowAutomationSection | undefined;
  const reportMarkdown = renderSolutionPlanReport({
    discoveryResult,
    solutionPlan,
    workflowAutomationPlan: workflowAutomationOutput?.plan,
  });
  const reportWrite = writeSolutionPlanReport(reportMarkdown, outputDir);
  if (reportWrite.ok) {
    ok(`${reportWrite.filePath}`);
  }

  // ── Validation + write ───────────────────────────────────────────────────
  context.stage = "validation";
  const writeResult = writeSolutionBlueprintArtifact(context.solutionBlueprint, outputDir);
  if (!writeResult.ok) {
    for (const err of writeResult.errors ?? []) fail(err);
    context.stage = "error";
    context.error = `Solution blueprint validation failed (${(writeResult.errors ?? []).length} error(s))`;
    context.completedAt = new Date().toISOString();
    return context;
  }

  context.stage = "writing";
  ok(`${writeResult.filePath} (${writeResult.sizeKb} KB)`);

  context.stage = "complete";
  context.completedAt = new Date().toISOString();

  console.log(`\n${DIVIDER}`);
  console.log("  Solution blueprint ready.");
  console.log(DIVIDER);

  return context;
}
