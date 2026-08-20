/**
 * Deterministic coverage for Phase 8.5B Modernization Recipe and
 * Transformation Export Adapters. Uses Node's built-in test runner, same as
 * the other test files. Run with `npm run test`.
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

import { assessIntegrations } from "../framework/capabilities/integrations/integrations.assessor.js";
import { buildIntegrationPlan } from "../framework/capabilities/integrations/integrations.planner.js";
import { buildIntegrationDefinitions } from "../framework/capabilities/integrations/generators/integration-definition.generator.js";

import { buildSecurityArchitecture } from "../framework/capabilities/security-governance/generators/security-architecture.generator.js";
import { buildGovernancePlan } from "../framework/capabilities/security-governance/generators/governance-plan.generator.js";
import { buildObservabilityArchitecture } from "../framework/capabilities/observability/generators/observability-architecture.generator.js";
import { buildModernizationArchitecture } from "../framework/capabilities/modernization/generators/modernization-architecture.generator.js";
import type { ModernizationArchitecture } from "../framework/capabilities/modernization/schemas/modernization.types.js";

import { runCodebaseAnalysis } from "../framework/analysis/codebase/codebase-analysis.js";
import type { CodebaseAnalysisResult } from "../framework/analysis/codebase/contracts/codebase-analysis-result.types.js";

import { ModernizationExporterRegistry } from "../framework/capabilities/modernization/exporters/exporter-registry.js";
import { createDefaultModernizationExporterRegistry } from "../framework/capabilities/modernization/exporters/default-exporters.js";
import { generateModernizationExports } from "../framework/capabilities/modernization/exporters/generate-modernization-exports.js";
import { genericJavaReplatformExporter, GENERIC_JAVA_REPLATFORM_EXPORTER_ID } from "../framework/capabilities/modernization/exporters/generic-java-replatform/generic-java-replatform.exporter.js";
import { validateModernizationExportBundle } from "../framework/capabilities/modernization/exporters/validators/modernization-export.validator.js";

const REPO_ROOT = process.cwd();
const LEGACY_JAVA_MAVEN = path.join(REPO_ROOT, "tests/fixtures/codebases/legacy-java-maven");
const EXPORTERS_DIR = path.join(REPO_ROOT, "framework/capabilities/modernization/exporters");

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkTsFiles(full));
    else if (entry.name.endsWith(".ts")) results.push(full);
  }
  return results;
}

function importsModule(content: string, moduleName: string): boolean {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`from\\s+["'](node:)?${escaped}["']|require\\(["'](node:)?${escaped}["']\\)`);
  return pattern.test(content);
}

async function makeDiscovery(markdown: string) {
  const parsed = parseMarkdown(markdown);
  return businessDiscoveryAgent.run({ parsed });
}

async function buildJavaModernizationArchitecture(): Promise<{ architecture: ModernizationArchitecture; codebase: CodebaseAnalysisResult }> {
  const markdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/legacy-java-modernization.md"), "utf-8");
  const discovery = await makeDiscovery(markdown);

  const parsed = parseMarkdown(markdown);
  const context = createSolutionContext("test.md", "test-output", markdown, parsed);
  context.discoveryResult = discovery;
  context.businessContext = deriveBusinessContext(discovery);

  const iAssessment = assessIntegrations(context);
  const iPlan = buildIntegrationPlan(context, iAssessment);
  const integrations = buildIntegrationDefinitions(discovery, iPlan.candidates, []);

  const security = buildSecurityArchitecture(discovery, [], integrations);
  const governance = buildGovernancePlan(discovery, [], security);
  const observability = buildObservabilityArchitecture(discovery, [], integrations, [], security, governance);

  const architecture = buildModernizationArchitecture(discovery, integrations, security, observability, undefined);
  const codebase = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);

  // Apply the same Phase 8.5A enrichment the real pipeline applies, so profiles/deltas match production behavior.
  const systemId = architecture.profiles[0].systemId;
  const { enrichModernizationWithCodebaseAnalysis } = await import("../framework/capabilities/modernization/generators/modernization-codebase-enrichment.generator.js");
  enrichModernizationWithCodebaseAnalysis(architecture, codebase, systemId, discovery.modernizationNeeds[0]);

  return { architecture, codebase };
}

function minimalArchitecture(overrides: Partial<ModernizationArchitecture> = {}): ModernizationArchitecture {
  return {
    version: "1.0",
    profiles: [],
    dependencies: [],
    technicalDebt: [],
    preservationRequirements: [],
    seams: [],
    migrationConstraints: [],
    migrationCandidates: [],
    modernizationDeltas: [],
    targetStateRequirements: [],
    validationRequirements: [],
    risks: [],
    roadmap: { candidateIds: [], workstreams: [], dependencies: [], validationRequirementIds: [], informationGapIds: [], status: "draft" },
    informationGaps: [],
    evidenceRefs: [],
    codebaseEvidenceConflicts: [],
    status: "draft",
    statusReasons: [],
    ...overrides,
  };
}

// ─── Registry ────────────────────────────────────────────────────────────

describe("Exporter registry", () => {
  test("register/get/getAll/findSupported work as expected", async () => {
    const registry = new ModernizationExporterRegistry();
    registry.register(genericJavaReplatformExporter);
    assert.equal(registry.get(GENERIC_JAVA_REPLATFORM_EXPORTER_ID), genericJavaReplatformExporter);
    assert.equal(registry.getAll().length, 1);

    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const supported = registry.findSupported(candidate, architecture, codebase);
    assert.deepEqual(supported, [genericJavaReplatformExporter]);
  });

  test("default registry registers generic-java-replatform", () => {
    const registry = createDefaultModernizationExporterRegistry();
    assert.ok(registry.get(GENERIC_JAVA_REPLATFORM_EXPORTER_ID));
  });
});

// ─── Gating conditions ──────────────────────────────────────────────────

describe("Strategy requirement", () => {
  test("a candidate without an explicit replatform strategy is unsupported", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = { ...architecture.migrationCandidates[0], strategyOptions: [{ strategy: "unknown" as const, status: "needs-review" as const, rationale: "", evidenceRefs: [], prerequisiteIds: [], riskIds: [] }] };
    assert.equal(genericJavaReplatformExporter.supports(candidate, architecture, codebase), false);
  });
});

describe("Java requirement", () => {
  test("a non-Java codebase is unsupported even with a replatform strategy and runtime delta", async () => {
    const { architecture } = await buildJavaModernizationArchitecture();
    const nonJavaCodebase = await runCodebaseAnalysis(path.join(REPO_ROOT, "tests/fixtures/codebases/typescript-npm"));
    const candidate = architecture.migrationCandidates[0];
    assert.equal(genericJavaReplatformExporter.supports(candidate, architecture, nonJavaCodebase), false);
  });
});

describe("Explicit target requirement", () => {
  test("no runtime ModernizationDelta means unsupported, never a fabricated recipe", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const architectureWithoutDelta = { ...architecture, modernizationDeltas: [] };
    assert.equal(genericJavaReplatformExporter.supports(candidate, architectureWithoutDelta, codebase), false);
    const readiness = genericJavaReplatformExporter.assessReadiness(candidate, architectureWithoutDelta, codebase);
    assert.equal(readiness.status, "unsupported");
  });
});

// ─── Immutability ───────────────────────────────────────────────────────

describe("Strategy immutability", () => {
  test("MigrationCandidate.strategyOptions is identical before and after export()", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const before = JSON.parse(JSON.stringify(candidate.strategyOptions));
    await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    assert.deepEqual(candidate.strategyOptions, before);
  });
});

// Both sides are round-tripped through JSON before comparing: some Phase
// 8.5A analyzer facts carry optional fields as an explicit `undefined`
// value (e.g. BuildSystemFact.parentCoordinates when no <parent> exists) —
// a real, harmless, pre-existing property of those objects, but one that
// makes assert.deepEqual (strict mode distinguishes {x: undefined} from
// {}) unusable directly against a live object. Round-tripping both sides
// verifies true structural equality without that false positive.
function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe("Architecture immutability", () => {
  test("ModernizationArchitecture is unchanged after export()", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const before = snapshot(architecture);
    await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    assert.deepEqual(snapshot(architecture), before);
  });
});

describe("Codebase immutability", () => {
  test("CodebaseAnalysisResult is unchanged after export()", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const before = snapshot(codebase);
    await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    assert.deepEqual(snapshot(codebase), before);
  });
});

// ─── WebSphere → Tomcat acceptance (item 58/81) ────────────────────────

describe("WebSphere to Tomcat acceptance", () => {
  test("explicit target preserved, no version/config/cloud/container/database invented", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);

    assert.equal(bundle.recipe.currentState.runtime, "IBM WebSphere");
    assert.equal(bundle.recipe.targetState.runtime, "Apache Tomcat");

    const serialized = JSON.stringify(bundle);
    assert.ok(!/Tomcat\s+\d/.test(serialized), "a Tomcat version was invented");
    assert.ok(!/context\.xml|server\.xml|tomcat-users\.xml/i.test(serialized), "Tomcat configuration was invented");
    assert.ok(!/\bAWS\b|\bAzure\b|\bGCP\b|\bKubernetes\b|\bDocker\b|\bDockerfile\b/i.test(serialized), "cloud/container output was invented");
    assert.ok(!/\bschema migration\b|\bETL\b|\bdatabase migration\b/i.test(serialized), "a database migration was invented");
  });

  test("readiness surfaces the unresolved target version and unresolved dependency, status needs-review", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const readiness = genericJavaReplatformExporter.assessReadiness(candidate, architecture, codebase);
    assert.equal(readiness.status, "needs-review");
    assert.ok(readiness.reasons.some((r) => r.code === "target-version-unresolved"));
    assert.ok(readiness.reasons.some((r) => r.code === "dependency-version-unresolved"));
  });
});

// ─── javax / Jakarta restraint (items 26-28, 60, 82-83) ───────────────

describe("javax without Jakarta evidence", () => {
  test("Servlet API import stays review-only, no namespace replacement proposed", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);

    const namespaceCandidates = bundle.transformations.sourceCandidates.filter((s) => s.category === "namespace");
    assert.ok(namespaceCandidates.length > 0);
    for (const candidate of namespaceCandidates) {
      assert.equal(candidate.status, "review");
      assert.equal(candidate.proposedDirection, undefined);
    }
    assert.ok(!/jakarta\.servlet/i.test(JSON.stringify(bundle.transformations.sourceCandidates)));
  });
});

describe("Explicit Jakarta target", () => {
  test("a real ModernizationDelta target mentioning Jakarta promotes the namespace candidate, still no source write", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const jakartaArchitecture: ModernizationArchitecture = {
      ...architecture,
      modernizationDeltas: architecture.modernizationDeltas.map((d) => (d.category === "runtime" ? { ...d, targetState: "Apache Tomcat with Jakarta Servlet 6.0" } : d)),
    };

    const bundle = await genericJavaReplatformExporter.export(candidate, jakartaArchitecture, codebase);
    const namespaceCandidates = bundle.transformations.sourceCandidates.filter((s) => s.category === "namespace");
    assert.ok(namespaceCandidates.some((s) => s.status === "candidate" && s.proposedDirection === "javax.servlet.* → jakarta.servlet.*"));

    const before = fs.readFileSync(path.join(LEGACY_JAVA_MAVEN, "src/main/java/com/example/OrderService.java"));
    assert.ok(before.toString().includes("javax.servlet"), "fixture source unchanged, still javax");
  });
});

// ─── Dependency restraint (items 17-20, 61-62, 84) ─────────────────────

describe("Dependency restraint", () => {
  test("Spring and Hibernate are retained, not upgraded", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);

    const spring = bundle.transformations.dependencyChanges.find((d) => d.currentDependency?.name === "Spring Framework");
    const hibernate = bundle.transformations.dependencyChanges.find((d) => d.currentDependency?.name === "Hibernate");
    assert.equal(spring?.action, "retain");
    assert.equal(hibernate?.action, "retain");
    assert.ok(!bundle.transformations.dependencyChanges.some((d) => d.action === "replace" || d.action === "add"));
  });

  test("the unresolved property-based dependency version stays unresolved, never guessed", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);

    const unresolved = bundle.transformations.dependencyChanges.find((d) => d.currentDependency?.name === "internal-fixture-lib");
    assert.ok(unresolved);
    assert.equal(unresolved!.currentDependency?.version, "unresolved");
    assert.equal(unresolved!.action, "review");
    assert.equal(unresolved!.proposedDependency, undefined);
  });

  test("no target dependency version is ever fabricated anywhere in the bundle", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    for (const dep of bundle.transformations.dependencyChanges) {
      assert.equal(dep.proposedDependency, undefined);
    }
  });
});

// ─── Configuration restraint (items 21-23, 59, 85) ─────────────────────

describe("Configuration restraint", () => {
  test("the WebSphere descriptor is referenced by its real path and marked review, never remove", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);

    const cfg = bundle.transformations.configurationChanges.find((c) => c.filePath.endsWith("ibm-web-bnd.xml"));
    assert.ok(cfg);
    assert.equal(cfg!.action, "review");
    assert.match(cfg!.description, /requires review for the target runtime/);
    assert.ok(!bundle.transformations.configurationChanges.some((c) => c.action === "remove"));
  });

  test("no Tomcat-specific configuration file is invented", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    assert.ok(!bundle.transformations.configurationChanges.some((c) => /context\.xml|server\.xml/i.test(c.filePath)));
  });
});

// ─── Preservation threading (item 86) ───────────────────────────────────

describe("Preservation references threaded through", () => {
  test("recipe and test impact both reference the real preservation requirements", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);

    assert.ok(bundle.recipe.preservationRequirementIds.length > 0);
    assert.deepEqual(new Set(bundle.recipe.preservationRequirementIds), new Set(architecture.preservationRequirements.map((p) => p.id)));
    assert.deepEqual(new Set(bundle.testImpact.preservationRequirementIds), new Set(architecture.preservationRequirements.map((p) => p.id)));
  });
});

// ─── Test impact area rules (item 87-88) ────────────────────────────────

describe("Test impact area rules", () => {
  test("a data-type preservation requirement produces a data validation area with an explicit no-database-migration statement", async () => {
    const architecture = minimalArchitecture({
      profiles: [{ id: "MODPROFILE-001", systemId: "SYS-001", modernizationNeedIds: [], role: "", lifecycleStatus: "unknown", modernizationDrivers: [], technicalDebtIds: [], dependencyIds: [], preservationRequirementIds: ["PRESERVE-001"], constraintIds: [], evidenceRefs: [], status: "candidate" }],
      preservationRequirements: [{ id: "PRESERVE-001", systemId: "SYS-001", type: "data", description: "The Order Database technology must not change.", sourceArchitectureRefs: [], evidenceRefs: [] }],
      migrationCandidates: [{ id: "CANDIDATE-001", systemId: "SYS-001", status: "candidate", driverIds: [], strategyOptions: [{ strategy: "replatform", status: "explicit", rationale: "", evidenceRefs: [], prerequisiteIds: [], riskIds: [] }], approach: "unknown", dependencyIds: [], preservationRequirementIds: ["PRESERVE-001"], riskIds: [], informationGapIds: [], evidenceRefs: [] }],
      modernizationDeltas: [{ id: "DELTA-001", systemId: "SYS-001", category: "runtime", currentState: "IBM WebSphere", targetState: "Apache Tomcat", evidenceRefs: [] }],
    });
    const codebase = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const candidate = architecture.migrationCandidates[0];

    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    const dataArea = bundle.testImpact.testAreas.find((a) => a.category === "data");
    assert.ok(dataArea);
    assert.match(dataArea!.description, /no database migration is proposed/);
    assert.ok(!/\bmigrate\b|\bschema change\b/i.test(JSON.stringify(bundle.recipe)));
  });

  test("no fabricated numeric acceptance criteria appear anywhere", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    const serialized = JSON.stringify(bundle.testImpact);
    assert.ok(!/\bHTTP\s+\d{3}\b|\b\d+\s?ms\b|response time/i.test(serialized));
  });
});

// ─── Conflict lowers readiness (item 89) ────────────────────────────────

describe("Conflict readiness", () => {
  test("an unresolved runtime conflict blocks readiness and appears in the manifest", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const architectureWithConflict: ModernizationArchitecture = {
      ...architecture,
      codebaseEvidenceConflicts: [
        { id: "CONFLICT-001", topic: "Java runtime version", discoveryEvidence: [], codebaseEvidence: [], description: "Discovery says Java 11, repository shows compiler source 8.", resolution: "unresolved" },
      ],
    };

    const readiness = genericJavaReplatformExporter.assessReadiness(candidate, architectureWithConflict, codebase);
    assert.equal(readiness.status, "blocked");
    assert.ok(readiness.conflictIds.includes("CONFLICT-001"));

    const bundle = await genericJavaReplatformExporter.export(candidate, architectureWithConflict, codebase);
    const manifestArtifact = bundle.artifacts.find((a) => a.path?.endsWith("modernization.manifest.json"));
    const manifest = JSON.parse(manifestArtifact!.content as string);
    assert.ok(manifest.conflictIds.includes("CONFLICT-001"));
    assert.equal(manifest.readiness, "blocked");
  });
});

// ─── Static guards (items 90-91) ────────────────────────────────────────

describe("No command execution", () => {
  test("no exporter module imports child_process", () => {
    for (const file of walkTsFiles(EXPORTERS_DIR)) {
      const content = fs.readFileSync(file, "utf-8");
      assert.ok(!importsModule(content, "child_process"), `${file} imports child_process`);
      assert.ok(!/\bexecSync\(|\bspawnSync\(/.test(content), `${file} calls execSync/spawnSync`);
    }
  });
});

describe("No network calls", () => {
  test("no exporter module imports fetch/axios/http(s)/undici", () => {
    for (const file of walkTsFiles(EXPORTERS_DIR)) {
      const content = fs.readFileSync(file, "utf-8");
      for (const moduleName of ["axios", "undici", "http", "https"]) {
        assert.ok(!importsModule(content, moduleName), `${file} imports ${moduleName}`);
      }
      assert.ok(!/\bfetch\(/.test(content), `${file} calls fetch()`);
    }
  });
});

// ─── No repository write (item 92) ──────────────────────────────────────

describe("No repository write", () => {
  test("the analyzed fixture remains byte-identical after a full export", async () => {
    const files = fs.readdirSync(LEGACY_JAVA_MAVEN, { recursive: true } as { recursive: true }) as unknown as string[];
    const before = new Map<string, Buffer>();
    for (const rel of files) {
      const full = path.join(LEGACY_JAVA_MAVEN, rel);
      if (fs.statSync(full).isFile()) before.set(rel, fs.readFileSync(full));
    }

    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    await genericJavaReplatformExporter.export(candidate, architecture, codebase);

    for (const [rel, contentBefore] of before) {
      const contentAfter = fs.readFileSync(path.join(LEGACY_JAVA_MAVEN, rel));
      assert.ok(contentBefore.equals(contentAfter), `${rel} changed after export`);
    }
  });
});

// ─── Absolute path / secret leakage (items 93-94) ───────────────────────

describe("Absolute path leakage", () => {
  test("no generated artifact contains the absolute analyzed repository path", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    const rootFragment = LEGACY_JAVA_MAVEN.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
    for (const artifact of bundle.artifacts) {
      const content = typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content);
      assert.ok(!content.includes(rootFragment), `${artifact.path} leaked an absolute path fragment`);
      assert.ok(!/[A-Za-z]:\\/.test(content), `${artifact.path} contains a Windows absolute path`);
    }
  });
});

describe("Secret leakage", () => {
  test("no generated artifact contains fixture secret values", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    const serialized = JSON.stringify(bundle);
    assert.ok(!serialized.includes("this-must-never-appear-in-any-generated-artifact"));
    assert.ok(!serialized.includes("not-a-real-secret-fixture-value"));
    assert.ok(!serialized.includes(".env"));
    assert.ok(!serialized.includes("id_rsa"));
  });
});

// ─── Proposal integrity validation (item 95, 99) ────────────────────────

describe("Proposal integrity validation", () => {
  test("validateModernizationExportBundle passes with zero errors for the acceptance fixture", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    const result = validateModernizationExportBundle(bundle, architecture, codebase);
    assert.deepEqual(result.issues.filter((i) => i.severity === "error"), [], JSON.stringify(result.issues));
  });

  test("every manifest generatedFiles entry exists in the bundle", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const candidate = architecture.migrationCandidates[0];
    const bundle = await genericJavaReplatformExporter.export(candidate, architecture, codebase);
    const manifestArtifact = bundle.artifacts.find((a) => a.path?.endsWith("modernization.manifest.json"));
    const manifest = JSON.parse(manifestArtifact!.content as string);
    const filePaths = new Set(bundle.files.map((f) => f.path));
    for (const path of manifest.generatedFiles) assert.ok(filePaths.has(path));
  });
});

// ─── Orchestration policy (items 48, 101-104) ───────────────────────────

describe("Explicit export intent", () => {
  test("no bundle is generated for an unregistered exporter target", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const systemId = architecture.profiles[0].systemId;
    const result = await generateModernizationExports(architecture, codebase, systemId, "does-not-exist");
    assert.deepEqual(result.bundles, []);
    assert.ok(result.notes.some((n) => n.includes("not a registered exporter")));
  });

  test("no bundle is generated for a system id outside modernization scope", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const result = await generateModernizationExports(architecture, codebase, "SYS-999-does-not-exist", GENERIC_JAVA_REPLATFORM_EXPORTER_ID);
    assert.deepEqual(result.bundles, []);
  });

  test("a real candidate with an explicit replatform strategy produces exactly one bundle", async () => {
    const { architecture, codebase } = await buildJavaModernizationArchitecture();
    const systemId = architecture.profiles[0].systemId;
    const result = await generateModernizationExports(architecture, codebase, systemId, GENERIC_JAVA_REPLATFORM_EXPORTER_ID);
    assert.equal(result.bundles.length, 1);
    assert.ok(result.artifacts.length === 13);
  });
});
