/**
 * Deterministic coverage for Phase 5.5A integration export generation.
 * Uses Node's built-in test runner, same as the other test files. Run with
 * `npm run test`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { parseMarkdown } from "../framework/core/markdown-parser.js";
import { businessDiscoveryAgent } from "../framework/discovery/business/business-discovery.agent.js";
import { deriveBusinessContext } from "../framework/discovery/discovery-result.types.js";
import { createSolutionContext } from "../framework/core/contracts/context.js";
import type { SolutionContext } from "../framework/core/contracts/context.js";

import { assessWorkflowAutomation } from "../framework/capabilities/workflow-automation/workflow-automation.assessor.js";
import { buildWorkflowAutomationPlan } from "../framework/capabilities/workflow-automation/workflow-automation.planner.js";
import { buildWorkflowDefinitions } from "../framework/capabilities/workflow-automation/generators/workflow-definition.generator.js";
import type { WorkflowDefinition } from "../framework/capabilities/workflow-automation/schemas/workflow-automation.types.js";

import { assessIntegrations } from "../framework/capabilities/integrations/integrations.assessor.js";
import { buildIntegrationPlan } from "../framework/capabilities/integrations/integrations.planner.js";
import { buildIntegrationDefinitions } from "../framework/capabilities/integrations/generators/integration-definition.generator.js";
import type { IntegrationDefinition } from "../framework/capabilities/integrations/schemas/integrations.types.js";

import { buildSecurityArchitecture } from "../framework/capabilities/security-governance/generators/security-architecture.generator.js";
import { buildGovernancePlan } from "../framework/capabilities/security-governance/generators/governance-plan.generator.js";
import type { SecurityArchitecture, GovernancePlan } from "../framework/capabilities/security-governance/schemas/security-governance.types.js";

import { IntegrationExporterRegistry } from "../framework/capabilities/integrations/exporters/exporter-registry.js";
import { createDefaultExporterRegistry } from "../framework/capabilities/integrations/exporters/default-exporters.js";
import { generateIntegrationExports } from "../framework/capabilities/integrations/exporters/generate-integration-exports.js";
import {
  genericRestTypeScriptExporter,
  supportsGenericRestTypeScript,
} from "../framework/capabilities/integrations/exporters/generic-rest-typescript/generic-rest-typescript.exporter.js";
import { validateExportBundle } from "../framework/capabilities/integrations/exporters/generic-rest-typescript/generic-rest-typescript.validator.js";
import { toSafeTypeScriptIdentifier, detectIdentifierCollisions } from "../framework/capabilities/integrations/exporters/naming/typescript-identifier.js";
import type { IntegrationExportContext } from "../framework/capabilities/integrations/exporters/exporter.types.js";
import { websiteCapability } from "../framework/capabilities/website/website.capability.js";

const REPO_ROOT = process.cwd();

async function makeContext(markdown: string): Promise<SolutionContext> {
  const parsed = parseMarkdown(markdown);
  const discoveryResult = await businessDiscoveryAgent.run({ parsed });
  const context = createSolutionContext("test.md", "test-output", markdown, parsed);
  context.discoveryResult = discoveryResult;
  context.businessContext = deriveBusinessContext(discoveryResult);
  return context;
}

async function generateWorkflows(context: SolutionContext): Promise<WorkflowDefinition[]> {
  const wfAssessment = assessWorkflowAutomation(context);
  const wfPlan = buildWorkflowAutomationPlan(context, wfAssessment);
  return buildWorkflowDefinitions(context, wfPlan);
}

async function generateIntegrations(context: SolutionContext, workflows: WorkflowDefinition[]): Promise<IntegrationDefinition[]> {
  const assessment = assessIntegrations(context);
  const plan = buildIntegrationPlan(context, assessment);
  return buildIntegrationDefinitions(context.discoveryResult!, plan.candidates, workflows);
}

async function buildFullContext(markdown: string) {
  const context = await makeContext(markdown);
  const workflows = await generateWorkflows(context);
  const integrations = await generateIntegrations(context, workflows);
  const security: SecurityArchitecture = buildSecurityArchitecture(context.discoveryResult!, workflows, integrations);
  const governance: GovernancePlan = buildGovernancePlan(context.discoveryResult!, workflows, security);
  const exportContext: IntegrationExportContext = { securityArchitecture: security, governancePlan: governance, systems: context.discoveryResult!.systems, workflows };
  return { context, workflows, integrations, security, governance, exportContext };
}

const appointmentMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/appointment-business.md"), "utf-8");
const invoiceMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/invoice-approval.md"), "utf-8");
const apiMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/api-integration.md"), "utf-8");
const readyMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/rest-export-ready.md"), "utf-8");

describe("Exporter/Provider separation", () => {
  test("exporter.types.ts never imports from or extends IntegrationProvider", () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, "framework/capabilities/integrations/exporters/exporter.types.ts"),
      "utf-8"
    );
    // The file's own doc comment explains the Provider/Exporter distinction
    // in prose (mentions the name deliberately) — what must never happen is
    // an actual import or an `extends`/`implements IntegrationProvider`.
    assert.ok(!/from ["'][^"']*integration-provider/i.test(source));
    assert.ok(!/extends IntegrationProvider|implements IntegrationProvider/.test(source));
  });

  test("generic-rest-typescript.exporter.ts never references IntegrationProvider or performs a network call", () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, "framework/capabilities/integrations/exporters/generic-rest-typescript/generic-rest-typescript.exporter.ts"),
      "utf-8"
    );
    assert.ok(!/IntegrationProvider/.test(source));
    assert.ok(!/\bfetch\(/.test(source));
    assert.ok(!/require\(["']http/.test(source));
  });
});

describe("Registry", () => {
  test("register/get/getAll/findSupported work generically", async () => {
    const registry = new IntegrationExporterRegistry();
    registry.register(genericRestTypeScriptExporter);
    assert.equal(registry.get("generic-rest-typescript"), genericRestTypeScriptExporter);
    assert.equal(registry.getAll().length, 1);

    const { integrations } = await buildFullContext(apiMarkdown);
    assert.equal(registry.findSupported(integrations[0]).length, 1);
  });

  test("registering the same exporter id twice throws", () => {
    const registry = new IntegrationExporterRegistry();
    registry.register(genericRestTypeScriptExporter);
    assert.throws(() => registry.register(genericRestTypeScriptExporter));
  });
});

describe("Support determined by restContract, not system name or category", () => {
  test("api-integration.md and rest-export-ready.md are supported; appointment/invoice are not", async () => {
    const api = await buildFullContext(apiMarkdown);
    const ready = await buildFullContext(readyMarkdown);
    const appointment = await buildFullContext(appointmentMarkdown);
    const invoice = await buildFullContext(invoiceMarkdown);

    assert.equal(supportsGenericRestTypeScript(api.integrations[0]), true);
    assert.equal(supportsGenericRestTypeScript(ready.integrations[0]), true);
    for (const integration of appointment.integrations) assert.equal(supportsGenericRestTypeScript(integration), false);
    for (const integration of invoice.integrations) assert.equal(supportsGenericRestTypeScript(integration), false);
  });
});

describe("Readiness", () => {
  test("explicit API example is needs-review (auth placement unresolved)", async () => {
    const { integrations, exportContext } = await buildFullContext(apiMarkdown);
    const readiness = genericRestTypeScriptExporter.assessReadiness(integrations[0], exportContext);
    assert.equal(readiness.status, "needs-review");
    assert.ok(readiness.reasons.some((r) => r.code === "authentication-placement-unresolved"));
  });

  test("fully explicit example is ready", async () => {
    const { integrations, exportContext } = await buildFullContext(readyMarkdown);
    const readiness = genericRestTypeScriptExporter.assessReadiness(integrations[0], exportContext);
    assert.equal(readiness.status, "ready");
    assert.deepEqual(readiness.reasons.filter((r) => r.severity !== "info"), []);
  });

  test("no bundle is produced for unsupported integrations via the full policy function", async () => {
    const { integrations, security, governance, workflows, context } = await buildFullContext(appointmentMarkdown);
    const { exports: bundles } = await generateIntegrationExports(integrations, security, governance, workflows, context.discoveryResult!.systems);
    assert.deepEqual(bundles, []);
  });
});

describe("generateIntegrationExports end-to-end policy", () => {
  test("exactly one supported exporter produces exactly one bundle", async () => {
    const { integrations, security, governance, workflows, context } = await buildFullContext(apiMarkdown);
    const { exports: bundles, artifacts, notes } = await generateIntegrationExports(
      integrations,
      security,
      governance,
      workflows,
      context.discoveryResult!.systems
    );
    assert.equal(bundles.length, 1);
    assert.equal(bundles[0].readiness.status, "needs-review");
    assert.ok(artifacts.length >= 5);
    assert.ok(notes.some((n) => n.includes("generic-rest-typescript")));
  });
});

describe("Method and path preservation", () => {
  test("POST /v1/orders is preserved exactly in the manifest and client source", async () => {
    const { integrations, exportContext } = await buildFullContext(apiMarkdown);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const clientArtifact = bundle.artifacts.find((a) => a.path?.endsWith("client.ts"));
    assert.ok(clientArtifact);
    assert.ok((clientArtifact!.content as string).includes("REST POST /v1/orders."));
  });
});

describe("Unknown base URL", () => {
  test("missing baseUrl becomes required external configuration, not an invented hostname", async () => {
    const { integrations, exportContext } = await buildFullContext(apiMarkdown);
    assert.equal(integrations[0].restContract?.baseUrl, undefined);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const configArtifact = bundle.artifacts.find((a) => a.path?.endsWith("config.ts"));
    const content = configArtifact!.content as string;
    assert.ok(content.includes("baseUrl: string;"));
    assert.ok(!/https?:\/\//.test(content));
  });
});

describe("Authentication mechanism preservation", () => {
  test("api-key is preserved and no other mechanism is invented", async () => {
    const { integrations, exportContext } = await buildFullContext(apiMarkdown);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const configArtifact = bundle.artifacts.find((a) => a.path?.endsWith("config.ts"));
    const content = configArtifact!.content as string;
    assert.ok(content.includes("apiKey: string;"));
    assert.ok(!/oauth|jwt|saml|basic|mtls/i.test(content));
  });
});

describe("Unknown API-key placement", () => {
  test("unresolved placement is never converted into a guessed header name", async () => {
    const { integrations, exportContext } = await buildFullContext(apiMarkdown);
    assert.equal(integrations[0].authentication?.placement, undefined);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const clientArtifact = bundle.artifacts.find((a) => a.path?.endsWith("client.ts"));
    const content = clientArtifact!.content as string;
    assert.ok(!/Authorization|X-API-Key/i.test(content));
    assert.ok(content.includes("AuthenticationStrategy"));
  });
});

describe("Explicit authentication placement", () => {
  test("X-API-Key header placement is preserved exactly", async () => {
    const { integrations, exportContext } = await buildFullContext(readyMarkdown);
    assert.deepEqual(integrations[0].authentication?.placement, { location: "header", name: "X-API-Key" });
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const clientArtifact = bundle.artifacts.find((a) => a.path?.endsWith("client.ts"));
    assert.ok((clientArtifact!.content as string).includes('Placement: header ("X-API-Key")'));
  });
});

describe("Request/response field integrity", () => {
  test("only explicit fields appear, camelCase source names are preserved, unknown types render as unknown, unresolved requiredness stays optional", async () => {
    const { integrations, exportContext } = await buildFullContext(readyMarkdown);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const typesArtifact = bundle.artifacts.find((a) => a.path?.endsWith("types.ts"));
    const content = typesArtifact!.content as string;

    assert.ok(content.includes("externalOrderId: string;"));
    assert.ok(content.includes("amount: number;"));
    assert.ok(content.includes("orderId: string;"));
    assert.ok(content.includes("status: string;"));
    assert.ok(!/customerId|items|quantity|price|address/i.test(content));
  });

  test("unresolved field types render as unknown and unresolved requiredness never becomes required", async () => {
    const { integrations, exportContext } = await buildFullContext(apiMarkdown);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const typesArtifact = bundle.artifacts.find((a) => a.path?.endsWith("types.ts"));
    const content = typesArtifact!.content as string;

    assert.ok(content.includes("orderIdentifier?: unknown;"));
    assert.ok(content.includes("acceptedStatus?: unknown;"));
  });

  test("no request type is generated when no request DataContract exists", async () => {
    const { integrations, exportContext } = await buildFullContext(apiMarkdown);
    assert.equal(integrations[0].dataContracts.find((c) => c.direction === "request"), undefined);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const typesArtifact = bundle.artifacts.find((a) => a.path?.endsWith("types.ts"));
    assert.ok((typesArtifact!.content as string).includes("Request = unknown;"));
  });
});

describe("Security and risk references", () => {
  test("readiness references real Phase 5 SecurityRequirement and RiskAssessment ids", async () => {
    const { integrations, security, exportContext } = await buildFullContext(apiMarkdown);
    const readiness = genericRestTypeScriptExporter.assessReadiness(integrations[0], exportContext);
    assert.ok(readiness.securityRequirementIds.length > 0);
    assert.ok(readiness.riskIds.length > 0);
    const knownReqIds = new Set(security.requirements.map((r) => r.id));
    const knownRiskIds = new Set(security.risks.map((r) => r.id));
    for (const id of readiness.securityRequirementIds) assert.ok(knownReqIds.has(id));
    for (const id of readiness.riskIds) assert.ok(knownRiskIds.has(id));
  });

  test("security requirement and risk ids propagate into the manifest", async () => {
    const { integrations, exportContext } = await buildFullContext(apiMarkdown);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const manifestArtifact = bundle.artifacts.find((a) => a.path?.endsWith("integration.manifest.json"));
    const manifest = JSON.parse(manifestArtifact!.content as string);
    assert.ok(manifest.securityRequirementIds.length > 0);
    assert.ok(manifest.riskIds.length > 0);
  });
});

describe("Naming utility", () => {
  test("matches the task's own examples exactly", () => {
    assert.equal(toSafeTypeScriptIdentifier("Fulfillment API", "pascal"), "FulfillmentApi");
    assert.equal(toSafeTypeScriptIdentifier("Submit approved order", "camel"), "submitApprovedOrder");
  });

  test("preserves existing camelCase source names instead of lowercasing them", () => {
    assert.equal(toSafeTypeScriptIdentifier("externalOrderId", "camel"), "externalOrderId");
    assert.equal(toSafeTypeScriptIdentifier("orderId", "camel"), "orderId");
  });

  test("detects a collision between two distinct source names normalizing to the same identifier", () => {
    const collisions = detectIdentifierCollisions([
      { sourceName: "Submit Order", identifier: "submitOrder" },
      { sourceName: "submit order", identifier: "submitOrder" },
    ]);
    assert.equal(collisions.length, 1);
    assert.equal(collisions[0].identifier, "submitOrder");
  });
});

describe("Secret protection", () => {
  test("no generated artifact contains a credential literal", async () => {
    const { integrations, exportContext } = await buildFullContext(readyMarkdown);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    for (const artifact of bundle.artifacts) {
      if (typeof artifact.content !== "string") continue;
      assert.ok(!/apiKey\s*[:=]\s*["'][^"'\s]{4,}["']/i.test(artifact.content));
    }
  });
});

describe("Export bundle validation", () => {
  test("validateExportBundle passes for both supported examples", async () => {
    const api = await buildFullContext(apiMarkdown);
    const apiBundle = await genericRestTypeScriptExporter.export(api.integrations[0], api.exportContext);
    const apiResult = validateExportBundle(apiBundle, api.integrations[0]);
    assert.deepEqual(apiResult.issues.filter((i) => i.severity === "error"), [], JSON.stringify(apiResult.issues));

    const ready = await buildFullContext(readyMarkdown);
    const readyBundle = await genericRestTypeScriptExporter.export(ready.integrations[0], ready.exportContext);
    const readyResult = validateExportBundle(readyBundle, ready.integrations[0]);
    assert.deepEqual(readyResult.issues.filter((i) => i.severity === "error"), [], JSON.stringify(readyResult.issues));
  });

  test("every manifest-listed generated file exists in the bundle", async () => {
    const { integrations, exportContext } = await buildFullContext(readyMarkdown);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const manifestArtifact = bundle.artifacts.find((a) => a.path?.endsWith("integration.manifest.json"));
    const manifest = JSON.parse(manifestArtifact!.content as string);
    const bundlePaths = new Set(bundle.files.map((f) => f.path));
    for (const file of manifest.generatedFiles) assert.ok(bundlePaths.has(file));
  });

  test("no duplicate generated file paths", async () => {
    const { integrations, exportContext } = await buildFullContext(readyMarkdown);
    const bundle = await genericRestTypeScriptExporter.export(integrations[0], exportContext);
    const paths = bundle.files.map((f) => f.path);
    assert.equal(new Set(paths).size, paths.length);
  });
});

describe("No network calls", () => {
  test("no fetch/http import appears anywhere in the exporters module tree", () => {
    const exportersDir = path.join(REPO_ROOT, "framework/capabilities/integrations/exporters");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".ts")) files.push(full);
      }
    };
    walk(exportersDir);
    assert.ok(files.length > 0);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      assert.ok(!/\bfetch\(/.test(content), `${file} calls fetch()`);
      assert.ok(!/from ["']node:https?["']/.test(content), `${file} imports node:http(s)`);
    }
  });
});

describe("Backward compatibility", () => {
  test("website capability is unaffected by export generation changes", async () => {
    const context = await makeContext(appointmentMarkdown);
    assert.equal(websiteCapability.assess, undefined);
    assert.equal(websiteCapability.supports(context), true);
  });

  test("createDefaultExporterRegistry produces the expected single built-in exporter", () => {
    const registry = createDefaultExporterRegistry();
    assert.equal(registry.getAll().length, 1);
    assert.equal(registry.get("generic-rest-typescript"), genericRestTypeScriptExporter);
  });
});
