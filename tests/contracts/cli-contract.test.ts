/**
 * CLI contract tests (RC1) — static checks that scripts/*.ts still expose
 * the flags documented in docs/architecture/PUBLIC_CONTRACTS.md, and that
 * the fatal-error UX fix (docs/architecture/KNOWN_TECHNICAL_DEBT.md
 * "Resolved by RC1") hasn't regressed.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = process.cwd();

function readScript(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf-8");
}

describe("Documented CLI flags exist in source", () => {
  test("scripts/run-solution.ts exposes --input/--output/--codebase/--system-id/--modernization-export", () => {
    const content = readScript("scripts/run-solution.ts");
    for (const flag of ["--input", "--output", "--codebase", "--system-id", "--modernization-export"]) {
      assert.ok(content.includes(`"${flag}"`), `run-solution.ts no longer references "${flag}"`);
    }
  });

  test("scripts/run-stitchfy.ts exposes --input/--output", () => {
    const content = readScript("scripts/run-stitchfy.ts");
    for (const flag of ["--input", "--output"]) {
      assert.ok(content.includes(`"${flag}"`), `run-stitchfy.ts no longer references "${flag}"`);
    }
  });

  test("scripts/analyze-codebase.ts exposes --path/--system-id/--output", () => {
    const content = readScript("scripts/analyze-codebase.ts");
    for (const flag of ["--path", "--system-id", "--output"]) {
      assert.ok(content.includes(`"${flag}"`), `analyze-codebase.ts no longer references "${flag}"`);
    }
  });
});

describe("CLI error contract", () => {
  test("no CLI script prints a raw Error object as the primary fatal-error line", () => {
    for (const rel of ["scripts/run-solution.ts", "scripts/run-stitchfy.ts", "scripts/analyze-codebase.ts"]) {
      const content = readScript(rel);
      assert.ok(
        !/console\.error\("Fatal error:",\s*err\)/.test(content),
        `${rel} regressed to printing the raw Error object (should be "err instanceof Error ? err.message : err")`
      );
    }
  });
});

describe("Package metadata consistency", () => {
  test("package.json description no longer describes Stitchfy as static-website-only", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
    assert.ok(!/static-website/i.test(pkg.description), "description still uses the old static-website-only framing");
  });

  test("package.json description reflects the solution-engineering framing", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
    assert.ok(/solution-engineering|architecture/i.test(pkg.description), "description does not mention the broader framework scope");
  });
});
