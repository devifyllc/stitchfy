/**
 * Phase 9 — semantic regression coverage for the three canonical reference
 * solutions (examples/reference/). Reuses the same manifest/runner
 * scripts/reference-validate.ts uses (tests/reference/), so the two never
 * drift into separately-maintained expectations. Run with `npm run test`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { REFERENCE_SOLUTIONS, type ReferenceSolutionDefinition } from "./reference/reference-solutions.js";
import { runReferenceScenario, normalizeReferenceOutput, checkArtifactDirs, assertGoldenSubset } from "./reference/reference-runner.js";
import type { SolutionContext } from "../framework/core/contracts/context.js";

const REPO_ROOT = process.cwd();
const REFERENCE_MODULE_DIR = path.join(REPO_ROOT, "tests", "reference");
const REFERENCE_SCRIPT = path.join(REPO_ROOT, "scripts", "reference-validate.ts");

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkTsFiles(full));
    else if (entry.name.endsWith(".ts")) results.push(full);
  }
  return results;
}

// Matches an actual import/require statement, not prose in a comment.
function importsModule(content: string, moduleName: string): boolean {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`from\\s+["'](node:)?${escaped}["']|require\\(["'](node:)?${escaped}["']\\)`);
  return pattern.test(content);
}

// ─── Run each scenario exactly once, memoized on first access ──────────────
// (a shared top-level `before()` hook does not reliably run ahead of tests
// nested inside separate `describe()` blocks across every Node test-runner
// version — a memoized lazy promise sidesteps hook-ordering entirely.)

const scenarioPromises = new Map<string, Promise<SolutionContext>>();

function getContext(def: ReferenceSolutionDefinition): Promise<SolutionContext> {
  let promise = scenarioPromises.get(def.id);
  if (!promise) {
    promise = runReferenceScenario(def);
    scenarioPromises.set(def.id, promise);
  }
  return promise;
}

for (const def of REFERENCE_SOLUTIONS) {
  describe(def.name, () => {
    test("parses and completes successfully", async () => {
      const context = await getContext(def);
      assert.equal(context.stage, "complete");
    });

    test("selects exactly the expected capabilities — no drift", async () => {
      const context = await getContext(def);
      const selected = context.solutionPlan?.selectedCapabilities ?? [];
      for (const capabilityId of def.expectedSelectedCapabilities) {
        assert.ok(selected.includes(capabilityId), `expected "${capabilityId}" to be selected, selected=${JSON.stringify(selected)}`);
      }
      for (const capabilityId of def.expectedNotSelectedCapabilities) {
        assert.ok(!selected.includes(capabilityId), `expected "${capabilityId}" to NOT be selected, selected=${JSON.stringify(selected)}`);
      }
    });

    test("produces every expected artifact directory, non-empty", async () => {
      await getContext(def);
      const outputDir = path.resolve(REPO_ROOT, "output", "reference", def.id);
      const results = checkArtifactDirs(outputDir, def.expectedArtifactDirs);
      for (const r of results) assert.ok(r.ok, `expected non-empty artifact dir "${r.dir}"`);
    });

    for (const invariant of def.expectedInvariants) {
      test(`invariant: ${invariant.id}`, async () => {
        const context = await getContext(def);
        const result = invariant.check(context);
        assert.equal(result, true, typeof result === "string" ? result : undefined);
      });
    }

    test("matches the golden subset fixture", async () => {
      const context = await getContext(def);
      const fixturePath = path.resolve(REPO_ROOT, def.expectedFixturePath);
      const expected = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
      const actual = normalizeReferenceOutput(context.solutionBlueprint);
      const errors = assertGoldenSubset(expected, actual);
      assert.deepEqual(errors, []);
    });
  });
}

// ─── Cross-scenario coverage (task section 47-48) ───────────────────────────

describe("Capability coverage completeness", () => {
  test("every implemented non-website capability is exercised by at least one reference scenario", () => {
    const implementedCapabilities = [
      "workflow-automation",
      "integrations",
      "ai-agents",
      "security-governance",
      "observability",
      "cloud",
      "modernization",
    ];
    const selectedAnywhere = new Set(REFERENCE_SOLUTIONS.flatMap((def) => def.expectedSelectedCapabilities));
    for (const capabilityId of implementedCapabilities) {
      assert.ok(selectedAnywhere.has(capabilityId), `"${capabilityId}" is not selected by any canonical reference scenario`);
    }
  });

  test("codebase evidence analysis is exercised by at least one reference scenario", () => {
    assert.ok(REFERENCE_SOLUTIONS.some((def) => def.optionalCodebase !== undefined));
  });
});

describe("Exporter coverage", () => {
  test("generic-rest-typescript appears in at least one scenario's integration exports", async () => {
    const context = await getContext(REFERENCE_SOLUTIONS.find((d) => d.id === "order-platform")!);
    const exportsList = context.solutionBlueprint.integrations?.exports ?? [];
    assert.ok(exportsList.some((b) => b.exporterId === "generic-rest-typescript"));
  });

  test("generic-java-replatform appears in at least one scenario's modernization exports", async () => {
    const context = await getContext(REFERENCE_SOLUTIONS.find((d) => d.id === "legacy-java-modernization")!);
    const exportsList = context.solutionBlueprint.modernization?.exports ?? [];
    assert.ok(exportsList.some((b) => b.exporterId === "generic-java-replatform"));
  });
});

describe("Codebase evidence integrity", () => {
  test("the analyzed repository fixture remains byte-identical, no absolute path leaks, strategy unchanged", async () => {
    const fixtureDir = path.resolve(REPO_ROOT, "tests/fixtures/codebases/legacy-java-maven");
    const before = new Map<string, Buffer>();
    const files = fs.readdirSync(fixtureDir, { recursive: true } as { recursive: true }) as unknown as string[];
    for (const rel of files) {
      const full = path.join(fixtureDir, rel);
      if (fs.statSync(full).isFile()) before.set(rel, fs.readFileSync(full));
    }

    const context = await getContext(REFERENCE_SOLUTIONS.find((d) => d.id === "legacy-java-modernization")!);
    assert.equal(context.codebaseSystemId, "SYS-001");

    for (const [rel, contentBefore] of before) {
      const contentAfter = fs.readFileSync(path.join(fixtureDir, rel));
      assert.ok(contentBefore.equals(contentAfter), `${rel} changed`);
    }

    const strategies = context.solutionBlueprint.modernization?.architecture.migrationCandidates[0]?.strategyOptions ?? [];
    assert.ok(strategies.some((s) => s.strategy === "replatform" && s.status === "explicit"));
  });
});

// ─── Reproducibility (task section 45) ──────────────────────────────────────

describe("Reproducibility", () => {
  test("re-running order-platform produces a semantically identical normalized blueprint", async () => {
    const def = REFERENCE_SOLUTIONS.find((d) => d.id === "order-platform")!;
    const first = normalizeReferenceOutput((await getContext(def)).solutionBlueprint);
    const second = await runReferenceScenario(def);
    const again = normalizeReferenceOutput(second.solutionBlueprint);
    assert.deepEqual(again, first);
  });
});

// ─── Static safety guards (task section 54) ─────────────────────────────────

describe("No command execution", () => {
  test("no reference-runner/reference-validate file imports child_process", () => {
    const files = [...walkTsFiles(REFERENCE_MODULE_DIR), REFERENCE_SCRIPT];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      assert.ok(!importsModule(content, "child_process"), `${file} imports child_process`);
      assert.ok(!/\bexecSync\(|\bspawnSync\(/.test(content), `${file} calls execSync/spawnSync`);
    }
  });
});

describe("No network calls", () => {
  test("no reference-runner/reference-validate file imports fetch/axios/http(s)/undici", () => {
    const files = [...walkTsFiles(REFERENCE_MODULE_DIR), REFERENCE_SCRIPT];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      for (const moduleName of ["axios", "undici", "http", "https"]) {
        assert.ok(!importsModule(content, moduleName), `${file} imports ${moduleName}`);
      }
      assert.ok(!/\bfetch\(/.test(content), `${file} calls fetch()`);
    }
  });
});

// ─── Documentation consistency (task section 43-44) ────────────────────────

function extractNpmRunCommands(markdown: string): string[] {
  const matches = [...markdown.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

describe("Reference documentation command validity", () => {
  const docFiles = [
    "docs/reference/END_TO_END.md",
    "docs/reference/APPOINTMENT_AUTOMATION_AI.md",
    "docs/reference/ORDER_PLATFORM.md",
    "docs/reference/LEGACY_JAVA_MODERNIZATION.md",
    "docs/reference/CAPABILITY_MATRIX.md",
    "examples/reference/README.md",
    "templates/README.md",
  ];

  test("every `npm run <script>` referenced in the new reference docs exists in package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
    const knownScripts = new Set(Object.keys(pkg.scripts ?? {}));
    for (const relPath of docFiles) {
      const fullPath = path.join(REPO_ROOT, relPath);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const scriptName of extractNpmRunCommands(content)) {
        assert.ok(knownScripts.has(scriptName), `${relPath} references "npm run ${scriptName}", not in package.json`);
      }
    }
  });

  test("every referenced input file under examples/reference/ actually exists", () => {
    for (const def of REFERENCE_SOLUTIONS) {
      assert.ok(fs.existsSync(path.join(REPO_ROOT, def.input)), `${def.input} does not exist`);
    }
  });
});

describe("Capability matrix validity", () => {
  test("CAPABILITY_MATRIX.md references only real example files", () => {
    const matrixPath = path.join(REPO_ROOT, "docs/reference/CAPABILITY_MATRIX.md");
    const content = fs.readFileSync(matrixPath, "utf-8");
    assert.ok(content.includes("Appointment Automation"));
    assert.ok(content.includes("Order Platform"));
    assert.ok(content.includes("Java Modernization"));
  });
});

describe("README framework positioning", () => {
  test("README mentions the Solution Architecture pipeline command", () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf-8");
    assert.ok(content.includes("npm run solution"));
  });

  test("README no longer scopes the whole framework to static websites only", () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf-8");
    assert.ok(!/generates\s+\*\*informational static websites only\*\*/i.test(content));
    assert.ok(/solution-engineering framework/i.test(content));
  });

  test("README does not claim runtime execution capabilities", () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf-8");
    assert.ok(!/stitchfy (deploys|provisions) (cloud|infrastructure)/i.test(content));
  });
});
