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
import type { SecurityArchitecture, GovernancePlan } from "../capabilities/security-governance/schemas/security-governance.types.js";
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
import { writeSolutionReport } from "../reports/solution-report/index.js";
import { writeImplementationArtifacts } from "../core/artifact-writer.js";
import { logAuditEvent } from "../governance/audit/audit-logger.js";
import type { ProjectMeta } from "../schemas/blueprint.types.js";
import type { WorkflowAutomationSection } from "../capabilities/workflow-automation/schemas/workflow-automation.types.js";
import type { ImplementationArtifact } from "../core/contracts/artifact.js";
import { generateIntegrationExports } from "../capabilities/integrations/exporters/generate-integration-exports.js";
import { runCodebaseAnalysis } from "../analysis/codebase/codebase-analysis.js";
import { buildCodebaseAnalysisArtifacts } from "../analysis/codebase/generators/codebase-analysis-artifact.generator.js";
import { generateModernizationExports } from "../capabilities/modernization/exporters/generate-modernization-exports.js";
import type { ModernizationSection } from "../capabilities/modernization/schemas/modernization.types.js";
import { STITCHFY_VERSION, SOLUTION_BLUEPRINT_SCHEMA_VERSION } from "../core/version.js";

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
    const output = result.output as { security: SecurityArchitecture; governance: GovernancePlan };
    blueprint.security = output.security;
    blueprint.governance = output.governance;
    blueprint.risks = output.security.risks;
    return;
  }

  if (result.capabilityId === "website") return; // WebsiteBlueprint lives in its own output dir, not on SolutionBlueprint

  const field = SINGLE_FIELD_MAP[result.capabilityId];
  if (field) {
    (blueprint as Record<string, unknown>)[field] = result.output;
  }
}

export async function runSolutionPipeline(
  inputPath: string,
  outputDir: string,
  codebasePath?: string,
  codebaseSystemId?: string,
  modernizationExportTarget?: string
): Promise<SolutionContext> {
  console.log(`\n${DIVIDER}`);
  console.log("  Stitchfy — Solution Pipeline");
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

  // ── Codebase analysis (Phase 8.5A, optional) ─────────────────────────────
  // Runs before discovery/planning so Modernization can consume it during
  // its own execute() — a second, independent evidence domain, never merged
  // into DiscoveryResult/BusinessContext (see docs/architecture/CODEBASE_ANALYSIS.md).
  if (codebasePath) {
    console.log(`  Codebase: ${codebasePath}${codebaseSystemId ? ` (system: ${codebaseSystemId})` : ""}`);
    const codebaseAnalysis = await runCodebaseAnalysis(codebasePath);
    context.codebaseAnalysis = codebaseAnalysis;
    context.codebaseSystemId = codebaseSystemId;
    ok(`Codebase analysis ${codebaseAnalysis.status} — ${codebaseAnalysis.buildSystems.length} build system(s), ${codebaseAnalysis.dependencies.length} dependenc${codebaseAnalysis.dependencies.length === 1 ? "y" : "ies"}, ${codebaseAnalysis.frameworks.length} framework(s)`);
  }

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
    schemaVersion: SOLUTION_BLUEPRINT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(inputPath),
    frameworkVersion: STITCHFY_VERSION,
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

  // security-governance (if it ran) already populated real risks via
  // mergeCapabilityOutput above — assessRisks() is only the deterministic
  // empty-array fallback for when it didn't.
  context.solutionBlueprint.risks = context.solutionBlueprint.risks ?? assessRisks(context);

  // Integration export-bundle generation (Phase 5.5A) needs SecurityArchitecture,
  // which only exists once security-governance has run — it registers after
  // integrations in default-capabilities.ts, so this can't happen inside
  // integrations.capability.ts's own execute(). Runs here, once every
  // capability has executed, mutating the SAME IntegrationsSection object
  // capabilityResults already references (so the artifact collection below
  // picks up the new files with zero further changes) — see
  // docs/architecture/ARCHITECTURE.md "Integration Export Adapter Foundation
  // (Phase 5.5A)".
  const integrationsSection = context.solutionBlueprint.integrations;
  if (integrationsSection && integrationsSection.integrations.length > 0) {
    const { exports: exportBundles, artifacts: exportArtifacts, notes: exportNotes } = await generateIntegrationExports(
      integrationsSection.integrations,
      context.solutionBlueprint.security,
      context.solutionBlueprint.governance,
      (context.solutionBlueprint.automation as WorkflowAutomationSection | undefined)?.workflows ?? [],
      context.solutionBlueprint.systems ?? []
    );
    integrationsSection.exports = exportBundles;
    integrationsSection.artifacts.push(...exportArtifacts);
    integrationsSection.notes.push(...exportNotes);
    if (exportBundles.length > 0) {
      ok(`Integration exports: generated ${exportBundles.length} bundle(s).`);
    }
  }

  // Modernization export generation (Phase 8.5B) requires EXPLICIT user intent
  // (--modernization-export) — never automatic, unlike every capability above.
  // Plain --codebase/--system-id (no export flag) performs analysis/enrichment
  // only. See docs/architecture/MODERNIZATION_EXPORTERS.md "Review boundary".
  const modernizationSection = context.solutionBlueprint.modernization as ModernizationSection | undefined;
  if (modernizationExportTarget && context.codebaseAnalysis && context.codebaseSystemId && modernizationSection) {
    const { bundles, artifacts: exportArtifacts, notes: exportNotes } = await generateModernizationExports(
      modernizationSection.architecture,
      context.codebaseAnalysis,
      context.codebaseSystemId,
      modernizationExportTarget
    );
    modernizationSection.exports = bundles;
    modernizationSection.artifacts.push(...exportArtifacts);
    modernizationSection.notes.push(...exportNotes);
    for (const note of exportNotes) console.log(`  ·  ${note}`);
    if (bundles.length > 0) {
      ok(`Modernization exports: generated ${bundles.length} bundle(s) via "${modernizationExportTarget}".`);
    }
  }

  // ── Implementation artifacts ─────────────────────────────────────────────
  // Any capability output may carry an `artifacts` array (see
  // ImplementationArtifact) — write them all generically, no capability-ID
  // branching (task item 19/21 for workflow-automation specifically, but
  // this stays open for any future capability that produces artifacts).
  // The three generic codebase-analysis artifacts (item 53) are written here, once, regardless of whether
  // Modernization ran — Modernization's own execute() only adds the fourth, mapping-specific pair.
  const codebaseArtifacts = context.codebaseAnalysis ? buildCodebaseAnalysisArtifacts(context.codebaseAnalysis, context.codebaseSystemId) : [];

  const allArtifacts = [
    ...context.capabilityResults.flatMap((result) => (result.output as { artifacts?: ImplementationArtifact[] } | undefined)?.artifacts ?? []),
    ...codebaseArtifacts,
  ];
  if (allArtifacts.length > 0) {
    const artifactWrites = writeImplementationArtifacts(allArtifacts, outputDir);
    for (const write of artifactWrites) {
      if (write.ok) ok(`${write.filePath}`);
      else fail(write.error ?? "artifact write failed");
    }
  }

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

  // Human-readable projection of the same blueprint (never a second source of
  // truth — see docs/architecture/ARCHITECTURE.md "Solution Report"). Failing
  // to render it never fails the pipeline: the canonical JSON contract above
  // already succeeded.
  const reportResult = writeSolutionReport(context.solutionBlueprint as SolutionBlueprint, outputDir);
  if (reportResult.ok) {
    ok(`${reportResult.filePath}`);
  } else {
    warn(`Solution report generation failed: ${reportResult.error}`);
  }

  context.stage = "complete";
  context.completedAt = new Date().toISOString();

  console.log(`\n${DIVIDER}`);
  console.log("  Solution blueprint ready.");
  console.log(DIVIDER);

  return context;
}
