#!/usr/bin/env tsx
/**
 * analyze-codebase — standalone CLI entry point for Phase 8.5A local
 * codebase evidence and dependency analysis. Read-only, deterministic, no
 * network calls, no command execution.
 *
 * Usage:
 *   npm run analyze:codebase -- --path ../order-portal
 *   npm run analyze:codebase -- --path ../order-portal --system-id SYS-001
 */

import path from "path";
import { runCodebaseAnalysis } from "../framework/analysis/codebase/codebase-analysis.js";
import { validateCodebaseAnalysisResult } from "../framework/analysis/codebase/validators/codebase-analysis.validator.js";
import { buildCodebaseAnalysisArtifacts } from "../framework/analysis/codebase/generators/codebase-analysis-artifact.generator.js";
import { writeImplementationArtifacts } from "../framework/core/artifact-writer.js";

function ok(message: string) {
  console.log(`  ✓  ${message}`);
}
function warn(message: string) {
  console.warn(`  ⚠  ${message}`);
}
function fail(message: string) {
  console.error(`  ✗  ${message}`);
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };

  const repositoryPath = getArg("--path");
  if (!repositoryPath) {
    fail("--path <repository> is required");
    process.exit(1);
  }

  const systemId = getArg("--system-id");
  const outputDir = path.resolve(getArg("--output") ?? "output");

  console.log(`\n${"━".repeat(52)}`);
  console.log("  Stitchfy — Codebase Analysis");
  console.log("━".repeat(52));
  console.log(`  Repository: ${repositoryPath}`);
  if (systemId) console.log(`  System:     ${systemId} (standalone tagging only — no modernization solution)`);

  try {
    const result = await runCodebaseAnalysis(repositoryPath);
    ok(
      `Analysis ${result.status} — ${result.buildSystems.length} build system(s), ${result.dependencies.length} dependenc${result.dependencies.length === 1 ? "y" : "ies"}, ` +
        `${result.frameworks.length} framework(s), ${result.runtimes.length} runtime fact(s)`
    );

    const validation = validateCodebaseAnalysisResult(result);
    if (!validation.ok) {
      for (const issue of validation.issues.filter((i) => i.severity === "error")) fail(issue.message);
      process.exit(1);
    }
    if (result.diagnostics.length > 0) {
      for (const d of result.diagnostics) (d.severity === "error" ? fail : warn)(`[${d.analyzerId}] ${d.message}`);
    }

    const artifacts = buildCodebaseAnalysisArtifacts(result, systemId);
    const writes = writeImplementationArtifacts(artifacts, outputDir);
    for (const write of writes) {
      if (write.ok) ok(write.filePath!);
      else fail(write.error ?? "artifact write failed");
    }

    console.log(`${"━".repeat(52)}`);
    console.log("  Codebase analysis complete.");
    console.log("━".repeat(52));
    process.exit(0);
  } catch (err) {
    console.error("Fatal error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
