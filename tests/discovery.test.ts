/**
 * Deterministic coverage for Phase 1 Business Discovery. Uses Node's
 * built-in test runner (no test framework dependency was added — see
 * docs/architecture/ROADMAP.md Phase 1). Run with `npm run test`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { parseMarkdown } from "../framework/core/markdown-parser.js";
import { businessDiscoveryAgent } from "../framework/discovery/business/business-discovery.agent.js";
import { deriveBusinessContext } from "../framework/discovery/discovery-result.types.js";
import type { DiscoveryResult } from "../framework/discovery/discovery-result.types.js";
import { DiscoveryResultSchema } from "../framework/schemas/discovery/discovery-result.schema.js";
import { SolutionBlueprintSchema } from "../framework/schemas/solution-blueprint/solution-blueprint.schema.js";
import { draftSolutionBlueprint } from "../framework/planning/solution-architect/solution-architect.js";
import type { ProjectMeta } from "../framework/schemas/blueprint.types.js";

// Tests are run via `npm run test` from the repository root (see
// package.json), same assumption the CLI scripts already make.
const REPO_ROOT = process.cwd();

async function discover(markdown: string): Promise<DiscoveryResult> {
  const parsed = parseMarkdown(markdown);
  return businessDiscoveryAgent.run({ parsed });
}

/** Every traceability link must reference an id that actually exists somewhere in the result. */
function collectAllIds(result: DiscoveryResult): Set<string> {
  const ids = new Set<string>();
  for (const arr of [
    result.goals,
    result.painPoints,
    result.desiredOutcomes,
    result.actors,
    result.processes,
    result.requirements,
    result.systems,
    result.integrationNeeds,
    result.dataEntities,
    result.constraints,
    result.businessRules,
  ] as Array<Array<{ id: string }>>) {
    for (const item of arr) ids.add(item.id);
  }
  return ids;
}

function assertNoDanglingLinks(result: DiscoveryResult): void {
  const ids = collectAllIds(result);
  for (const link of result.traceability) {
    assert.ok(ids.has(link.fromId), `traceability fromId "${link.fromId}" (${link.relationship}) does not exist`);
    assert.ok(ids.has(link.toId), `traceability toId "${link.toId}" (${link.relationship}) does not exist`);
  }
}

describe("1. complete solution-discovery input (examples/solution/appointment-business.md)", () => {
  const fixturePath = path.join(REPO_ROOT, "examples/solution/appointment-business.md");
  const markdown = fs.readFileSync(fixturePath, "utf-8");

  test("extracts goals, actors, processes, requirements, systems, business rules", async () => {
    const result = await discover(markdown);
    assert.equal(result.businessName, "Riverside Wellness Studio");
    assert.ok(result.goals.length >= 3);
    assert.ok(result.actors.length >= 2);
    assert.equal(result.processes.length, 1);
    assert.equal(result.requirements.length, result.desiredOutcomes.length);
    assert.ok(result.systems.length >= 2);
    assert.equal(result.businessRules.length, 1);
    assert.ok(result.traceability.length > 0);
  });

  test("validates against DiscoveryResultSchema", async () => {
    const result = await discover(markdown);
    const validation = DiscoveryResultSchema.safeParse(result);
    assert.equal(validation.success, true, JSON.stringify(validation.success ? null : validation.error.issues));
  });
});

describe("2. minimal website-style legacy input (examples/beauty-salon.md)", () => {
  const fixturePath = path.join(REPO_ROOT, "examples/beauty-salon.md");
  const markdown = fs.readFileSync(fixturePath, "utf-8");

  test("does not throw and produces a valid DiscoveryResult with no solution-engineering sections", async () => {
    const result = await discover(markdown);
    assert.ok(result.businessName.length > 0);
    assert.equal(DiscoveryResultSchema.safeParse(result).success, true);
    // No Goals/Processes/Requirements sections in this website-only example.
    assert.equal(result.goals.length, 0);
    assert.equal(result.processes.length, 0);
  });
});

describe("3. missing information → gaps", () => {
  test("an input with only a title raises gaps for every empty category", async () => {
    const result = await discover("# Project: Empty Co\n");
    const topics = result.informationGaps.map((g) => g.topic);
    assert.ok(topics.includes("Business goals"));
    assert.ok(topics.includes("Users / actors"));
    assert.ok(topics.includes("Pain points"));
    assert.ok(topics.includes("Existing systems"));
    assert.ok(topics.includes("Constraints"));
    assert.ok(topics.includes("Business rules"));
    const blocking = result.informationGaps.find((g) => g.topic === "Business goals");
    assert.equal(blocking?.blocking, true);
  });
});

describe("4. structured business process extraction", () => {
  const markdown = `# Project: Test Co

## Business Processes

Order Fulfillment

Trigger:
Customer places an order

Actors:
Customer
Warehouse Staff

Current systems:
Shopify
Excel spreadsheet

Steps:
1. Order received
2. Staff picks item
3. Staff packs item
4. Staff ships item

Inputs:
Order details

Outputs:
Shipped package

Pain points:
- Picking errors
- Manual packing slip creation

Business rules:
- Orders over $500 require manager approval

Manual steps:
- Packing slip creation

Automation candidates:
- Auto-generate packing slips
`;

  test("parses every label of a single process block", async () => {
    const result = await discover(markdown);
    assert.equal(result.processes.length, 1);
    const proc = result.processes[0];
    assert.equal(proc.name, "Order Fulfillment");
    assert.equal(proc.trigger, "Customer places an order");
    assert.equal(proc.actorIds.length, 2);
    assert.equal(proc.systemIds.length, 2);
    assert.deepEqual(proc.steps, [
      "Order received",
      "Staff picks item",
      "Staff packs item",
      "Staff ships item",
    ]);
    assert.deepEqual(proc.inputs, ["Order details"]);
    assert.deepEqual(proc.outputs, ["Shipped package"]);
    assert.equal(proc.painPointIds.length, 2);
    assert.equal(proc.businessRuleIds.length, 1);
    assert.deepEqual(proc.manualSteps, ["Packing slip creation"]);
    assert.deepEqual(proc.automationCandidates, ["Auto-generate packing slips"]);

    const rule = result.businessRules.find((r) => r.id === proc.businessRuleIds[0]);
    assert.equal(rule?.description, "Orders over $500 require manager approval");
    assert.ok(rule?.relatedProcessIds.includes(proc.id));
  });

  test("systems mentioned in the process are categorized deterministically", async () => {
    const result = await discover(markdown);
    const shopify = result.systems.find((s) => s.name === "Shopify");
    const spreadsheet = result.systems.find((s) => s.name === "Excel spreadsheet");
    assert.equal(spreadsheet?.category, "spreadsheet");
    assert.ok(shopify); // unmatched by the keyword table — stays "unknown", not guessed
    assert.equal(shopify?.category, "unknown");
  });
});

describe("5. requirements extraction", () => {
  test("explicit Requirements section is extracted as-is (sourceType input)", async () => {
    const markdown = `# Project: Test Co

## Requirements
- The system must integrate with Google Calendar
- The system should send automated reminders
`;
    const result = await discover(markdown);
    assert.equal(result.requirements.length, 2);
    assert.equal(result.requirements[0].type, "integration");
    assert.equal(result.requirements[0].priority, "must");
    assert.equal(result.requirements[0].metadata.sources[0].sourceType, "input");
    assert.equal(result.requirements[0].metadata.confidence, 1);
  });

  test("no Requirements section → one requirement derived per desired outcome, clearly marked derived", async () => {
    const markdown = `# Project: Test Co

## Desired Outcomes
- Customers can book online
- Staff spend less time on scheduling
`;
    const result = await discover(markdown);
    assert.equal(result.requirements.length, 2);
    for (const req of result.requirements) {
      assert.ok(req.description.startsWith("Support: "));
      assert.equal(req.metadata.sources[0].sourceType, "derived");
      assert.equal(req.metadata.inferred, false);
      assert.ok(req.metadata.confidence < 1);
    }
  });

  test("never invents requirements when neither section is present", async () => {
    const result = await discover("# Project: Test Co\n");
    assert.equal(result.requirements.length, 0);
  });
});

describe("6. system extraction / categorization", () => {
  test("classifies systems from a plain bullet list deterministically, never guessing technology", async () => {
    const markdown = `# Project: Test Co

## Existing Systems
- Google Calendar
- Excel spreadsheet
- Phone
- Custom website
`;
    const result = await discover(markdown);
    const byName = Object.fromEntries(result.systems.map((s) => [s.name, s]));
    assert.equal(byName["Google Calendar"].category, "saas");
    assert.equal(byName["Excel spreadsheet"].category, "spreadsheet");
    assert.equal(byName["Phone"].category, "manual");
    assert.equal(byName["Custom website"].category, "application");
    for (const system of result.systems) {
      assert.equal(system.technology, undefined);
    }
  });
});

describe("7. provenance + traceability", () => {
  test("every discovery object has a well-formed DiscoveryMetadata, and every traceability link resolves", async () => {
    const fixturePath = path.join(REPO_ROOT, "examples/solution/appointment-business.md");
    const markdown = fs.readFileSync(fixturePath, "utf-8");
    const result = await discover(markdown);

    const allEntities = [
      ...result.goals,
      ...result.painPoints,
      ...result.desiredOutcomes,
      ...result.actors,
      ...result.processes,
      ...result.requirements,
      ...result.systems,
      ...result.integrationNeeds,
      ...result.dataEntities,
      ...result.constraints,
      ...result.businessRules,
    ];
    assert.ok(allEntities.length > 0);
    for (const entity of allEntities) {
      assert.ok(entity.metadata.confidence >= 0 && entity.metadata.confidence <= 1);
      assert.ok(Array.isArray(entity.metadata.sources) && entity.metadata.sources.length > 0);
      assert.equal(typeof entity.metadata.inferred, "boolean");
    }

    assertNoDanglingLinks(result);
  });
});

describe("8. backward compatibility", () => {
  test("deriveBusinessContext produces the exact Phase 0 BusinessContext shape", async () => {
    const result = await discover("# Project: Test Co\n\n## Goals\n- Grow revenue\n");
    const businessContext = deriveBusinessContext(result);
    assert.deepEqual(Object.keys(businessContext).sort(), [
      "businessName",
      "businessRules",
      "constraints",
      "data",
      "desiredOutcomes",
      "existingSystems",
      "goals",
      "industry",
      "integrations",
      "missingInformation",
      "painPoints",
      "processes",
      "users",
    ].sort());
    assert.ok(Array.isArray(businessContext.goals));
    assert.equal(businessContext.goals[0], "Grow revenue");
  });

  test("a discovery-derived SolutionBlueprint still validates against SolutionBlueprintSchema", async () => {
    const result = await discover("# Project: Test Co\n\n## Goals\n- Grow revenue\n");
    const project: ProjectMeta = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      sourceFile: "test-co.md",
      frameworkVersion: "test",
    };
    const blueprint = draftSolutionBlueprint(project, result);
    const validation = SolutionBlueprintSchema.safeParse(blueprint);
    assert.equal(validation.success, true, JSON.stringify(validation.success ? null : validation.error.issues));
  });
});
