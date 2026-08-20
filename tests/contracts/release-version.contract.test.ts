/**
 * Release-version consistency tests (RC2) — added because this release
 * prepares a package.json version bump (see docs/releases/2.2.0.md).
 * Guards against exactly the kind of drift RC1 already found and fixed
 * once (see docs/architecture/KNOWN_TECHNICAL_DEBT.md): package.json,
 * README, STITCHFY_VERSION, and freshly generated blueprints must all
 * agree.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { STITCHFY_VERSION } from "../../framework/core/version.js";
import { runPipeline } from "../../framework/orchestrator/orchestrator.js";
import { runSolutionPipeline } from "../../framework/orchestrator/solution-orchestrator.js";

const REPO_ROOT = process.cwd();

describe("Release version consistency", () => {
  test("package.json version matches STITCHFY_VERSION", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8"));
    assert.equal(STITCHFY_VERSION, pkg.version);
  });

  test("README badge and footer both reference the current version", () => {
    const readme = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf-8");
    assert.ok(readme.includes(`version-${STITCHFY_VERSION}-brightgreen`), `README badge does not reference ${STITCHFY_VERSION}`);
    assert.ok(readme.includes(`Stitchfy v${STITCHFY_VERSION},`), `README footer does not reference ${STITCHFY_VERSION}`);
  });

  test("a fresh website pipeline run's frameworkVersion matches STITCHFY_VERSION", async () => {
    const outputDir = path.join(REPO_ROOT, "output", "contracts", "release-version-website-check");
    await runPipeline(path.join(REPO_ROOT, "input", "project.md"), outputDir);
    const blueprint = JSON.parse(fs.readFileSync(path.join(outputDir, "blueprint", "website-blueprint.v1.json"), "utf-8"));
    assert.equal(blueprint.project.frameworkVersion, STITCHFY_VERSION);
  });

  test("a fresh solution pipeline run's frameworkVersion matches STITCHFY_VERSION", async () => {
    const outputDir = path.join(REPO_ROOT, "output", "contracts", "release-version-solution-check");
    const context = await runSolutionPipeline(path.join(REPO_ROOT, "input", "project.md"), outputDir);
    assert.equal(context.solutionBlueprint.project?.frameworkVersion, STITCHFY_VERSION);
  });
});
