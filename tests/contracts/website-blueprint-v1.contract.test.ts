/**
 * WebsiteBlueprint v1 contract tests (RC2) — the gap that had to close
 * before WebsiteBlueprint v1 could be justified as STABLE (see
 * docs/architecture/PUBLIC_CONTRACTS.md "STABLE"). Uses
 * examples/beauty-salon.md, confirmed byte-identical between `main` and
 * `development` (docs/releases/MAIN_TO_DEVELOPMENT_DELTA.md), as the real
 * website-compatibility fixture — never a simplified replacement.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { runPipeline } from "../../framework/orchestrator/orchestrator.js";
import { validateBlueprint } from "../../framework/schemas/blueprint.schema.js";
import { WEBSITE_BLUEPRINT_SCHEMA_VERSION } from "../../framework/core/version.js";

const REPO_ROOT = process.cwd();
const WEBSITE_BLUEPRINT_SECTIONS = ["project", "business", "pages", "ux", "seo", "accessibility", "frontend", "qa"] as const;

describe("WebsiteBlueprint v1 — real fixture (examples/beauty-salon.md)", () => {
  test("validates against WebsiteBlueprintSchema", async () => {
    const outputDir = path.join(REPO_ROOT, "output", "contracts", "website-blueprint-v1");
    const state = await runPipeline(path.join(REPO_ROOT, "examples", "beauty-salon.md"), outputDir);
    assert.equal(state.stage, "complete");

    const blueprintPath = path.join(outputDir, "blueprint", "website-blueprint.v1.json");
    const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8"));

    const validation = validateBlueprint(blueprint);
    assert.equal(validation.ok, true, validation.ok ? undefined : validation.errors.join("; "));
  });

  test("schemaVersion stays \"1.0\" and all 8 documented sections are present", async () => {
    const blueprintPath = path.join(REPO_ROOT, "output", "contracts", "website-blueprint-v1", "blueprint", "website-blueprint.v1.json");
    const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8"));

    assert.equal(blueprint.project.schemaVersion, WEBSITE_BLUEPRINT_SCHEMA_VERSION);
    assert.equal(WEBSITE_BLUEPRINT_SCHEMA_VERSION, "1.0");
    for (const section of WEBSITE_BLUEPRINT_SECTIONS) {
      assert.ok(section in blueprint, `expected WebsiteBlueprint section "${section}" to be present`);
    }
  });
});

describe("WebsiteBlueprint v1 — historical document acceptance (task item 7)", () => {
  test("a document with an old frameworkVersion value still validates — frameworkVersion is metadata, not a schema break", () => {
    const fixturePath = path.join(REPO_ROOT, "tests", "fixtures", "contracts", "website-blueprint-v1.pre-rc.json");
    const historical = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

    assert.notEqual(historical.project.frameworkVersion, WEBSITE_BLUEPRINT_SCHEMA_VERSION, "fixture should intentionally carry an old, unrelated frameworkVersion value");

    const validation = validateBlueprint(historical);
    assert.equal(validation.ok, true, validation.ok ? undefined : validation.errors.join("; "));
  });
});
