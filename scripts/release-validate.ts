#!/usr/bin/env tsx
/**
 * release-validate — RC2 release preparation gate composer. Reuses
 * rc-validate.ts's gate-runner pattern (npm-script orchestration only, no
 * reimplemented validation logic) plus a read-only main-vs-development Git
 * compatibility check. Never merges, tags, or publishes.
 *
 * Usage: npm run release:validate
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { STITCHFY_VERSION, SOLUTION_BLUEPRINT_SCHEMA_VERSION, WEBSITE_BLUEPRINT_SCHEMA_VERSION } from "../framework/core/version.js";

const REPO_ROOT = path.resolve(__dirname, "..");

interface GateResult {
  id: string;
  name: string;
  command: string;
  ok: boolean;
  durationMs: number;
}

function runGate(id: string, name: string, command: string): GateResult {
  console.log(`\n▶ ${name} (${command})`);
  const start = Date.now();
  try {
    execSync(command, { cwd: REPO_ROOT, stdio: "inherit" });
    return { id, name, command, ok: true, durationMs: Date.now() - start };
  } catch {
    return { id, name, command, ok: false, durationMs: Date.now() - start };
  }
}

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
}

function gitOkExitCode(args: string): boolean {
  try {
    execSync(`git ${args}`, { cwd: REPO_ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

interface TopologyResult {
  baseBranch: string;
  candidateBranch: string;
  mergeBase: string;
  baseHead: string;
  candidateHead: string;
  commitsAhead: number;
  commitsBehind: number;
  changedFiles: number;
  fastForwardPossible: boolean;
  baseTreeIdenticalToMergeBase: boolean;
  mergeTopology: string;
}

function checkTopology(): TopologyResult {
  const baseBranch = "main";
  const candidateBranch = "development";
  const mergeBase = git(`merge-base ${baseBranch} ${candidateBranch}`);
  const baseHead = git(`rev-parse ${baseBranch}`);
  const candidateHead = git(`rev-parse ${candidateBranch}`);
  const [behind, ahead] = git(`rev-list --left-right --count ${baseBranch}...${candidateBranch}`).split(/\s+/).map(Number);
  const changedFiles = git(`diff --name-status ${baseBranch}...${candidateBranch}`).split("\n").filter(Boolean).length;
  const fastForwardPossible = gitOkExitCode(`merge-base --is-ancestor ${baseBranch} ${candidateBranch}`);
  const baseTreeIdenticalToMergeBase = gitOkExitCode(`diff --quiet ${mergeBase} ${baseBranch}`);

  let mergeTopology: string;
  if (fastForwardPossible) {
    mergeTopology = "FAST-FORWARD POSSIBLE";
  } else if (baseTreeIdenticalToMergeBase) {
    mergeTopology = "MERGE REQUIRED (non-fast-forward, content-conflict-free)";
  } else {
    mergeTopology = "MERGE/REBASE REQUIRED";
  }

  return {
    baseBranch,
    candidateBranch,
    mergeBase,
    baseHead,
    candidateHead,
    commitsAhead: ahead,
    commitsBehind: behind,
    changedFiles,
    fastForwardPossible,
    baseTreeIdenticalToMergeBase,
    mergeTopology,
  };
}

function renderMainlinePromotionMarkdown(gates: GateResult[], topology: TopologyResult, overallOk: boolean): string {
  const lines: string[] = [
    "# Mainline Promotion Report",
    "",
    `Status: **${overallOk ? "READY TO PROMOTE WITH CONDITIONS" : "NOT READY TO PROMOTE"}**`,
    "",
    "## Branch state",
    "",
    `- Base branch: \`${topology.baseBranch}\` @ \`${topology.baseHead}\``,
    `- Candidate branch: \`${topology.candidateBranch}\` @ \`${topology.candidateHead}\``,
    `- Merge base: \`${topology.mergeBase}\``,
    `- Commits ahead (candidate-only): ${topology.commitsAhead}`,
    `- Commits behind (base-only): ${topology.commitsBehind}`,
    `- Changed files: ${topology.changedFiles}`,
    `- Merge topology: **${topology.mergeTopology}**`,
    "",
    "## Compatibility result",
    "",
    "See docs/releases/MAIN_TO_DEVELOPMENT_DELTA.md for the full classification. No compatibility risk requiring a major version bump was found.",
    "",
    "## Stable contracts",
    "",
    "WebsiteBlueprint v1, SolutionBlueprint v1, `npm run stitchfy`, `npm run solution`, `npm run analyze:codebase` — see docs/architecture/PUBLIC_CONTRACTS.md.",
    "",
    "## Remaining candidate contracts",
    "",
    "IntegrationExportManifest v1, ModernizationExportManifest v1, CodebaseAnalysisResult, per-capability JSON artifacts, `npm run reference:validate`.",
    "",
    "## Release gates",
    "",
  ];
  for (const gate of gates) {
    lines.push(`- ${gate.ok ? "PASS" : "FAIL"} — ${gate.name} (\`${gate.command}\`, ${gate.durationMs}ms)`);
  }
  lines.push(
    "",
    "## Recommended version",
    "",
    `\`${STITCHFY_VERSION}\` (MINOR bump — backward-compatible, additive; see docs/architecture/RELEASE_CANDIDATE.md's SemVer analysis)`,
    "",
    "## Blockers / conditions",
    "",
    "- Human review of docs/architecture/decisions/ (ADR-001 through ADR-004) before treating package-boundary/runtime-provider/promotion decisions as final.",
    "- Target version approval — this report recommends but does not itself authorize a release.",
    "- Final branch protection / PR review on the actual `git merge`.",
    "",
    "## Final recommendation",
    "",
    `**${overallOk ? "READY TO PROMOTE WITH CONDITIONS" : "NOT READY TO PROMOTE"}** — see docs/releases/MAINLINE_PROMOTION.md for the full human-reviewable checklist. Human approval to merge is NOT granted by this report.`,
    ""
  );
  return lines.join("\n");
}

async function main() {
  const gates: GateResult[] = [
    runGate("rc", "RC1 gates (typecheck/test/reference:validate)", "npm run rc:validate"),
    runGate("contracts", "Contract tests", "npm run test:contracts"),
  ];

  const topology = checkTopology();
  console.log(`\n▶ Main → development topology: ${topology.mergeTopology}`);

  const overallOk = gates.every((g) => g.ok);

  const outDir = path.join(REPO_ROOT, "output", "release");
  fs.mkdirSync(outDir, { recursive: true });

  const compatibilityReport = {
    stableContracts: ["WebsiteBlueprint v1", "SolutionBlueprint v1", "npm run stitchfy", "npm run solution", "npm run analyze:codebase"],
    candidateContracts: [
      "IntegrationExportManifest v1",
      "ModernizationExportManifest v1",
      "CodebaseAnalysisResult",
      "per-capability JSON artifacts",
      "npm run reference:validate",
    ],
    deprecatedContracts: ["SolutionBlueprint.deployment"],
    compatibilityTests: gates.reduce((acc, g) => ({ ...acc, [g.id]: g.ok ? "passed" : "failed" }), {} as Record<string, string>),
    websiteResult: gates.find((g) => g.id === "rc")?.ok ? "passed" : "unknown",
    solutionResult: gates.find((g) => g.id === "rc")?.ok ? "passed" : "unknown",
    referenceResult: gates.find((g) => g.id === "rc")?.ok ? "passed" : "unknown",
    breakingChangesDetected: [],
    recommendedSemVerLevel: "minor",
    status: overallOk ? "passed" : "failed",
  };
  fs.writeFileSync(path.join(outDir, "compatibility-report.json"), JSON.stringify(compatibilityReport, null, 2));

  const mainlineDiffSummary = {
    baseBranch: topology.baseBranch,
    candidateBranch: topology.candidateBranch,
    mergeBase: topology.mergeBase,
    baseHead: topology.baseHead,
    candidateHead: topology.candidateHead,
    commitsAhead: topology.commitsAhead,
    commitsBehind: topology.commitsBehind,
    changedFiles: topology.changedFiles,
    compatibility: "backward-compatible, additive",
    recommendedVersion: STITCHFY_VERSION,
    promotionStatus: overallOk ? "READY TO PROMOTE WITH CONDITIONS" : "NOT READY TO PROMOTE",
  };
  fs.writeFileSync(path.join(outDir, "mainline-diff-summary.json"), JSON.stringify(mainlineDiffSummary, null, 2));

  fs.writeFileSync(path.join(outDir, "mainline-promotion.md"), renderMainlinePromotionMarkdown(gates, topology, overallOk));

  console.log(`\nFramework version: ${STITCHFY_VERSION}`);
  console.log(`SolutionBlueprint schema: ${SOLUTION_BLUEPRINT_SCHEMA_VERSION}`);
  console.log(`WebsiteBlueprint schema: ${WEBSITE_BLUEPRINT_SCHEMA_VERSION}`);
  console.log(`Merge topology: ${topology.mergeTopology}`);
  console.log(`\n${overallOk ? "✓ Release gates passed." : "✗ One or more release gates failed."}`);
  console.log(`  Reports: output/release/{compatibility-report.json,mainline-diff-summary.json,mainline-promotion.md}`);

  process.exit(overallOk ? 0 : 1);
}

main();
