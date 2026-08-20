/**
 * Stable CLI contract tests (RC2) — locks the 3 commands promoted to
 * STABLE in docs/architecture/PUBLIC_CONTRACTS.md (`npm run stitchfy`,
 * `npm run solution`, `npm run analyze:codebase`) distinctly from RC1's
 * broader tests/contracts/cli-contract.test.ts, which checks ALL
 * documented flags regardless of stability tier. This file exists to
 * catch a regression in specifically the STABLE-tier promise.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = process.cwd();
const STABLE_CLI_COMMANDS = ["stitchfy", "solution", "analyze:codebase"] as const;

describe("STABLE CLI commands exist in package.json and are documented as STABLE", () => {
  test("each STABLE command has a real npm script", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
    for (const command of STABLE_CLI_COMMANDS) {
      assert.ok(pkg.scripts[command], `expected package.json scripts to include "${command}"`);
    }
  });

  test("PUBLIC_CONTRACTS.md documents each STABLE command under the STABLE tier", () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, "docs", "architecture", "PUBLIC_CONTRACTS.md"), "utf-8");
    const stableSectionStart = content.indexOf("## STABLE");
    const candidateSectionStart = content.indexOf("## CANDIDATE");
    assert.ok(stableSectionStart >= 0, "expected a ## STABLE section in PUBLIC_CONTRACTS.md");
    assert.ok(candidateSectionStart > stableSectionStart, "expected ## CANDIDATE to follow ## STABLE");
    const stableSection = content.slice(stableSectionStart, candidateSectionStart);
    for (const command of STABLE_CLI_COMMANDS) {
      assert.ok(stableSection.includes(`npm run ${command}`), `expected "npm run ${command}" documented under the STABLE section`);
    }
  });
});

describe("STABLE CLI flags", () => {
  test("scripts/run-solution.ts still exposes all 5 documented flags", () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, "scripts", "run-solution.ts"), "utf-8");
    for (const flag of ["--input", "--output", "--codebase", "--system-id", "--modernization-export"]) {
      assert.ok(content.includes(`"${flag}"`), `run-solution.ts no longer references "${flag}"`);
    }
  });

  test("scripts/run-stitchfy.ts still exposes --input/--output", () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, "scripts", "run-stitchfy.ts"), "utf-8");
    for (const flag of ["--input", "--output"]) {
      assert.ok(content.includes(`"${flag}"`), `run-stitchfy.ts no longer references "${flag}"`);
    }
  });

  test("scripts/analyze-codebase.ts still exposes --path/--system-id/--output", () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, "scripts", "analyze-codebase.ts"), "utf-8");
    for (const flag of ["--path", "--system-id", "--output"]) {
      assert.ok(content.includes(`"${flag}"`), `analyze-codebase.ts no longer references "${flag}"`);
    }
  });
});
