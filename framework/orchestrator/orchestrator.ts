/**
 * Orchestrator — drives the Stitchfy pipeline from Markdown input to
 * a validated, written website-blueprint.v1.json artifact.
 *
 * Pipeline stages (displayed as numbered progress during run):
 *  1. Reading Markdown input
 *  2. Running Intake Agent
 *  3. Running UX Agent
 *  4. Running SEO Agent
 *  5. Running Accessibility Agent
 *  6. Running Frontend Agent
 *  7. Validating blueprint
 *  8. Writing blueprint artifact
 *  9. Done
 */

import * as fs from "fs";
import { parseMarkdown } from "../core/markdown-parser.js";
import { createWorkflowState, type WorkflowState } from "./workflow-state.js";
import { runAgent, type AgentConfig } from "./agent-runner.js";
import { intakeAgent } from "../agents/intake.agent.js";
import { uxAgent } from "../agents/ux.agent.js";
import { seoAgent } from "../agents/seo.agent.js";
import { accessibilityAgent } from "../agents/accessibility.agent.js";
import { frontendAgent } from "../agents/frontend.agent.js";
import { validateBlueprint } from "../schemas/blueprint.schema.js";
import { writeBlueprintArtifact } from "../core/blueprint-writer.js";

const PIPELINE: AgentConfig[] = [
  intakeAgent,
  uxAgent,
  seoAgent,
  accessibilityAgent,
  frontendAgent,
];

const DIVIDER = "━".repeat(52);

function step(n: number, total: number, label: string) {
  process.stdout.write(`\n  [${n}/${total}] ${label}...\n`);
}

function ok(message: string) {
  console.log(`  ✓  ${message}`);
}

function fail(message: string) {
  console.error(`  ✗  ${message}`);
}

function warn(message: string) {
  console.warn(`  ⚠  ${message}`);
}

export async function runPipeline(
  inputPath: string,
  outputDir: string
): Promise<WorkflowState> {
  const TOTAL_STEPS = 9;

  console.log(`\n${DIVIDER}`);
  console.log("  Stitchfy v2 — AI-Powered Website Generator");
  console.log(DIVIDER);
  console.log(`  Input:  ${inputPath}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Mode:   local (deterministic)`);

  // ── Step 1: Read Markdown ───────────────────────────────────────────────

  step(1, TOTAL_STEPS, "Reading Markdown input");

  if (!fs.existsSync(inputPath)) {
    fail(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(inputPath, "utf-8");
  const parsed = parseMarkdown(markdown);
  ok(`Loaded ${inputPath} (${markdown.length} chars, ${Object.keys(parsed.sections).length} sections)`);

  const state = createWorkflowState(inputPath, outputDir, markdown, parsed);

  // ── Steps 2–6: Agent pipeline ───────────────────────────────────────────

  const agentStepLabels: Record<string, string> = {
    intake: "Running Intake Agent",
    ux: "Running UX Agent",
    seo: "Running SEO Agent",
    accessibility: "Running Accessibility Agent",
    frontend: "Running Frontend Agent",
  };

  let stepN = 2;
  for (const agent of PIPELINE) {
    step(stepN, TOTAL_STEPS, agentStepLabels[agent.stage] ?? agent.name);
    state.stage = agent.stage;

    const { result, output } = await runAgent(agent, state);
    state.blueprint = { ...state.blueprint, ...output };
    state.results.push(result);

    if (!result.success) {
      fail(`${agent.name} failed: ${result.error}`);
      state.stage = "error";
      state.error = result.error;
      state.completedAt = new Date().toISOString();
      return state;
    }

    if (result.summary) ok(result.summary);
    stepN++;
  }

  // ── Step 7: Validate blueprint ──────────────────────────────────────────

  step(7, TOTAL_STEPS, "Validating blueprint");
  state.stage = "validation";

  const validation = validateBlueprint(state.blueprint);
  if (!validation.ok) {
    for (const err of validation.errors) {
      fail(err);
    }
    fail("Blueprint validation failed — not written to disk.");
    state.stage = "error";
    state.error = `Blueprint validation failed (${validation.errors.length} error(s))`;
    state.completedAt = new Date().toISOString();
    return state;
  }

  const sectionCount = Object.keys(state.blueprint).length;
  ok(`Blueprint valid — ${sectionCount} sections, ${(state.blueprint as { pages?: unknown[] }).pages?.length ?? 0} pages`);

  // ── Step 8: Write artifact ──────────────────────────────────────────────

  step(8, TOTAL_STEPS, "Writing blueprint artifact");
  state.stage = "writing";

  const writeResult = writeBlueprintArtifact(state.blueprint, outputDir);
  if (!writeResult.ok) {
    for (const err of writeResult.errors ?? []) fail(err);
    state.stage = "error";
    state.error = "Blueprint write failed";
    return state;
  }

  ok(`${writeResult.filePath} (${writeResult.sizeKb} KB)`);

  // Print compliance flags if any
  const biz = (state.blueprint as { business?: { complianceFlags?: string[]; missingInformation?: string[] } }).business;
  if (biz?.complianceFlags && biz.complianceFlags.length > 0) {
    warn(`Compliance flags: ${biz.complianceFlags.join(", ")}`);
  }
  if (biz?.missingInformation && biz.missingInformation.length > 0) {
    warn(`Missing info: ${biz.missingInformation.join(", ")}`);
  }

  // ── Step 9: Done ────────────────────────────────────────────────────────

  step(9, TOTAL_STEPS, "Done");
  state.stage = "complete";
  state.completedAt = new Date().toISOString();

  console.log(`\n${DIVIDER}`);
  console.log("  Blueprint ready. Run npm run build:site to generate the website.");
  console.log(DIVIDER);

  return state;
}
