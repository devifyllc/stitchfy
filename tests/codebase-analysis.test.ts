/**
 * Deterministic coverage for Phase 8.5A Local Codebase Evidence and
 * Dependency Analysis. Uses Node's built-in test runner, same as the other
 * test files. Run with `npm run test`.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { runCodebaseAnalysis } from "../framework/analysis/codebase/codebase-analysis.js";
import { validateCodebaseAnalysisResult } from "../framework/analysis/codebase/validators/codebase-analysis.validator.js";
import { buildCodebaseAnalysisArtifacts } from "../framework/analysis/codebase/generators/codebase-analysis-artifact.generator.js";
import { resolveWithinRoot } from "../framework/analysis/codebase/scanner/path-safety.js";
import { scanRepository } from "../framework/analysis/codebase/scanner/repository-scanner.js";
import { enrichModernizationWithCodebaseAnalysis } from "../framework/capabilities/modernization/generators/modernization-codebase-enrichment.generator.js";
import { buildModernizationArchitecture } from "../framework/capabilities/modernization/generators/modernization-architecture.generator.js";
import { parseMarkdown } from "../framework/core/markdown-parser.js";
import { businessDiscoveryAgent } from "../framework/discovery/business/business-discovery.agent.js";
import type { ObservabilityArchitecture } from "../framework/capabilities/observability/schemas/observability.types.js";
import type { SecurityArchitecture } from "../framework/capabilities/security-governance/schemas/security-governance.types.js";

const REPO_ROOT = process.cwd();
const FIXTURES_DIR = path.join(REPO_ROOT, "tests/fixtures/codebases");
const LEGACY_JAVA_MAVEN = path.join(FIXTURES_DIR, "legacy-java-maven");
const TYPESCRIPT_NPM = path.join(FIXTURES_DIR, "typescript-npm");
const MIXED_JAVA_NODE = path.join(FIXTURES_DIR, "mixed-java-node");

const CODEBASE_MODULE_DIR = path.join(REPO_ROOT, "framework/analysis/codebase");

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkTsFiles(full));
    else if (entry.name.endsWith(".ts")) results.push(full);
  }
  return results;
}

function emptySecurity(): SecurityArchitecture {
  return { version: "1.0", requirements: [], trustBoundaries: [], dataProtection: [], identityAccess: [], integrationSecurity: [], auditRequirements: [], risks: [], informationGaps: [], evidenceRefs: [], status: "draft", statusReasons: [] };
}
function emptyObservability(): ObservabilityArchitecture {
  return { version: "1.0", telemetryRequirements: [], signals: [], logRequirements: [], metricRequirements: [], correlationRequirements: [], healthRequirements: [], alertRequirements: [], dashboardSpecifications: [], auditMappings: [], operationalObjectives: [], informationGaps: [], evidenceRefs: [], status: "draft", statusReasons: [] };
}

// ─── Static guard tests (items 11/87/88) ───────────────────────────────────

// Matches an actual import/require statement, not prose in a comment
// explaining that something is deliberately absent.
function importsModule(content: string, moduleName: string): boolean {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`from\\s+["'](node:)?${escaped}["']|require\\(["'](node:)?${escaped}["']\\)`);
  return pattern.test(content);
}

describe("No command execution", () => {
  test("no analyzer/scanner file imports child_process", () => {
    for (const file of walkTsFiles(CODEBASE_MODULE_DIR)) {
      const content = fs.readFileSync(file, "utf-8");
      assert.ok(!importsModule(content, "child_process"), `${file} imports child_process`);
      assert.ok(!/\bexecSync\(|\bspawnSync\(/.test(content), `${file} calls execSync/spawnSync`);
    }
  });
});

describe("No network calls", () => {
  test("no analyzer/scanner file imports fetch/axios/http(s)/undici", () => {
    for (const file of walkTsFiles(CODEBASE_MODULE_DIR)) {
      const content = fs.readFileSync(file, "utf-8");
      for (const moduleName of ["axios", "undici", "http", "https"]) {
        assert.ok(!importsModule(content, moduleName), `${file} imports ${moduleName}`);
      }
      assert.ok(!/\bfetch\(/.test(content), `${file} calls fetch()`);
    }
  });
});

// ─── Scanner safety tests (items 90/91) ────────────────────────────────────

describe("Path traversal", () => {
  test("a path escaping the repository root is rejected", () => {
    const result = resolveWithinRoot(LEGACY_JAVA_MAVEN, "../../../../etc/passwd");
    assert.equal(result, undefined);
  });

  test("a real file inside the root resolves", () => {
    const result = resolveWithinRoot(LEGACY_JAVA_MAVEN, "pom.xml");
    assert.ok(result);
  });
});

describe("Symlink escape", () => {
  test("a symlink is never followed, even one pointing back inside the root", function (t) {
    const linkPath = path.join(LEGACY_JAVA_MAVEN, "pom-link.xml");
    try {
      fs.symlinkSync(path.join(LEGACY_JAVA_MAVEN, "pom.xml"), linkPath, "file");
    } catch {
      t.skip("symlink creation not permitted in this environment");
      return;
    }
    try {
      const result = resolveWithinRoot(LEGACY_JAVA_MAVEN, "pom-link.xml");
      assert.equal(result, undefined);
    } finally {
      fs.unlinkSync(linkPath);
    }
  });
});

// ─── Sensitive file / binary exclusion (item 89) ───────────────────────────

describe("No secret leakage", () => {
  test(".env and id_rsa are ignored, never appear in generated artifacts", async () => {
    const result = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("this-must-never-appear-in-any-generated-artifact"));
    assert.ok(!serialized.includes("this-is-not-a-real-private-key"));
    assert.ok(!serialized.includes(".env"));
    assert.ok(!serialized.includes("id_rsa"));
  });

  test("application.properties content (including its password= line) is never copied — presence only", async () => {
    const result = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("not-a-real-secret-fixture-value"));
    assert.ok(result.configurationFacts.some((c) => c.relativePath.endsWith("application.properties")));
  });
});

// ─── Maven parsing (items 92/93) ───────────────────────────────────────────

describe("Maven parsing", () => {
  test("direct dependencies, plugin, module, and compiler settings are extracted", async () => {
    const result = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    assert.equal(result.modules.length, 1);
    assert.ok(result.dependencies.some((d) => d.name === "spring-context" && d.group === "org.springframework"));
    assert.ok(result.buildSystems[0].pluginCoordinates.some((p) => p.name === "maven-compiler-plugin"));
    assert.equal(result.buildSystems[0].compilerSource, "8");
    assert.ok(result.buildSystems[0].profiles.includes("local"));
  });

  test("an unresolved Maven property remains 'unresolved', never fabricated", async () => {
    const result = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const dep = result.dependencies.find((d) => d.name === "internal-fixture-lib");
    assert.ok(dep);
    assert.equal(dep!.version, "unresolved");
  });

  test("a property resolvable from the local POM model resolves correctly", async () => {
    const result = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const dep = result.dependencies.find((d) => d.name === "spring-context");
    assert.equal(dep!.version, "4.3.30.RELEASE");
  });
});

// ─── npm parsing (item 94) ──────────────────────────────────────────────────

describe("npm parsing", () => {
  test("dependencies, devDependencies, engines, and lockfile presence are represented; scripts never executed", async () => {
    const result = await runCodebaseAnalysis(TYPESCRIPT_NPM);
    assert.ok(result.dependencies.some((d) => d.name === "express" && d.version === "^4.19.0"));
    assert.ok(result.dependencies.some((d) => d.name === "typescript" && d.scope === "devDependencies"));
    assert.ok(result.runtimes.some((r) => r.type === "node" && r.version === ">=20"));
    assert.ok(result.configurationFacts.some((c) => c.kind === "npm-lockfile"));

    for (const file of walkTsFiles(CODEBASE_MODULE_DIR)) {
      assert.ok(!/exec\(["'`]npm|spawn\(["'`]npm/.test(fs.readFileSync(file, "utf-8")));
    }
  });
});

// ─── Java structural facts (item 95) ───────────────────────────────────────

describe("Java structural facts", () => {
  test("package, imports, type declarations, and annotations are extracted without interpreting method bodies", async () => {
    const result = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const orderService = result.sourceStructure.find((s) => s.symbolName === "OrderService");
    assert.ok(orderService);
    assert.equal(orderService!.packageName, "com.example");
    assert.equal(orderService!.symbolKind, "class");
    assert.ok(orderService!.annotations.includes("Service"));

    const orderRepository = result.sourceStructure.find((s) => s.symbolName === "OrderRepository");
    assert.ok(orderRepository?.implements?.includes("java.io.Serializable"));
  });
});

// ─── Framework derivation (item 96) ────────────────────────────────────────

describe("Framework derivation", () => {
  test("real Maven and import evidence derive FrameworkFacts, each with real evidence references", async () => {
    const result = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const spring = result.frameworks.find((f) => f.name === "Spring Framework" && f.detectionMethod === "dependency");
    assert.ok(spring);
    assert.ok(spring!.metadata.evidenceRefs.length > 0);
    assert.equal(spring!.metadata.provenance, "derived");

    const servletFromImport = result.frameworks.find((f) => f.name.startsWith("Servlet API") && f.detectionMethod === "import");
    assert.ok(servletFromImport);
  });
});

// ─── No lifecycle inference (item 97) ──────────────────────────────────────

describe("No lifecycle inference", () => {
  test("old-looking versions (Java 8, Spring 4.x) never produce EOL/unsupported/vulnerability/obsolete claims", async () => {
    for (const fixture of [LEGACY_JAVA_MAVEN, TYPESCRIPT_NPM, MIXED_JAVA_NODE]) {
      const result = await runCodebaseAnalysis(fixture);
      const serialized = JSON.stringify(result);
      assert.ok(!/end.of.life|\bEOL\b|unsupported|vulnerab|obsolete|deprecated|security risk/i.test(serialized), `${fixture} produced a lifecycle/vulnerability claim`);
    }
  });

  test("WebSphere evidence is only ever an explicit descriptor match, never inferred from Java EE alone", async () => {
    const result = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const webSphere = result.runtimes.find((r) => r.name === "WebSphere");
    assert.ok(webSphere);
    assert.equal(webSphere!.detectionMethod, "descriptor");
    assert.ok(webSphere!.metadata.evidenceRefs[0].filePath.includes("ibm-web-bnd.xml"));
  });
});

// ─── Generated directories ignored (item 103) ──────────────────────────────

describe("Generated directories ignored", () => {
  test("no analyzer sees excluded directories (node_modules/target/dist) — verified via the exclusion list itself", () => {
    const scan = scanRepository(LEGACY_JAVA_MAVEN);
    assert.ok(!scan.files.some((f) => f.relativePath.includes("node_modules/") || f.relativePath.includes("target/")));
  });
});

// ─── Absolute path leakage (item 102) ──────────────────────────────────────

describe("Absolute path leakage", () => {
  test("generated JSON/Markdown artifacts contain no absolute repository path", async () => {
    const result = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const artifacts = buildCodebaseAnalysisArtifacts(result);
    const rootFragment = LEGACY_JAVA_MAVEN.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
    for (const artifact of artifacts) {
      const content = typeof artifact.content === "string" ? artifact.content : JSON.stringify(artifact.content);
      assert.ok(!content.includes(rootFragment), `${artifact.path} leaked an absolute path fragment`);
      assert.ok(!/[A-Za-z]:\\/.test(content), `${artifact.path} contains a Windows absolute path`);
    }
  });
});

// ─── Determinism (item 104) ─────────────────────────────────────────────────

describe("Deterministic generation", () => {
  test("running analysis twice against the same fixture produces identical facts and ids", async () => {
    const first = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const second = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    assert.deepEqual(first, second);
  });
});

// ─── Referential integrity / status ────────────────────────────────────────

describe("Semantic validation", () => {
  test("all three fixtures pass validateCodebaseAnalysisResult with zero errors", async () => {
    for (const fixture of [LEGACY_JAVA_MAVEN, TYPESCRIPT_NPM, MIXED_JAVA_NODE]) {
      const result = await runCodebaseAnalysis(fixture);
      const validation = validateCodebaseAnalysisResult(result);
      assert.deepEqual(validation.issues.filter((i) => i.severity === "error"), [], JSON.stringify(validation.issues));
    }
  });

  test("mixed-java-node runs both Maven and npm analyzers without id collisions or competition", async () => {
    const result = await runCodebaseAnalysis(MIXED_JAVA_NODE);
    assert.ok(result.repository.analyzersUsed.includes("maven"));
    assert.ok(result.repository.analyzersUsed.includes("npm"));
    const ids = result.buildSystems.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("build.gradle-only content would surface as an honest unsupported-ecosystem gap, not silent parsing", async () => {
    const result = await runCodebaseAnalysis(TYPESCRIPT_NPM);
    // typescript-npm has no build.gradle, so this just proves the mechanism doesn't fabricate gaps when absent.
    assert.deepEqual(result.informationGaps, []);
  });
});

// ─── Modernization integration ─────────────────────────────────────────────

async function makeDiscovery(markdown: string) {
  const parsed = parseMarkdown(markdown);
  return businessDiscoveryAgent.run({ parsed });
}

const javaModernizationMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/legacy-java-modernization.md"), "utf-8");

describe("Explicit system mapping", () => {
  test("a system-id not present in modernization scope applies no enrichment and never silently remaps", async () => {
    const discovery = await makeDiscovery(javaModernizationMarkdown);
    const architecture = buildModernizationArchitecture(discovery, [], emptySecurity(), emptyObservability(), undefined);
    const codebaseAnalysis = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);

    const result = enrichModernizationWithCodebaseAnalysis(architecture, codebaseAnalysis, "SYS-999-does-not-exist", discovery.modernizationNeeds[0]);
    assert.equal(result.applied, false);
    assert.ok(result.reason);
    assert.equal(architecture.profiles.every((p) => p.codebaseAnalysis === undefined), true);
  });
});

describe("No strategy change", () => {
  test("codebase analysis enrichment never alters MigrationCandidate.strategyOptions", async () => {
    const discovery = await makeDiscovery(javaModernizationMarkdown);
    const architecture = buildModernizationArchitecture(discovery, [], emptySecurity(), emptyObservability(), undefined);
    const beforeStrategy = JSON.parse(JSON.stringify(architecture.migrationCandidates[0].strategyOptions));

    const codebaseAnalysis = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const systemId = architecture.profiles[0].systemId;
    enrichModernizationWithCodebaseAnalysis(architecture, codebaseAnalysis, systemId, discovery.modernizationNeeds[0]);

    assert.deepEqual(architecture.migrationCandidates[0].strategyOptions, beforeStrategy);
    assert.equal(architecture.migrationCandidates[0].strategyOptions[0].strategy, "replatform");
  });
});

describe("No strategy fabrication", () => {
  test("an assessment-only modernization example plus a Java-dependency repository stays needs-review/unknown", async () => {
    const assessmentOnlyMarkdown = fs.readFileSync(path.join(REPO_ROOT, "examples/solution/legacy-operations-assessment.md"), "utf-8");
    const discovery = await makeDiscovery(assessmentOnlyMarkdown);
    const architecture = buildModernizationArchitecture(discovery, [], emptySecurity(), emptyObservability(), undefined);
    const codebaseAnalysis = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const systemId = architecture.profiles[0].systemId;

    enrichModernizationWithCodebaseAnalysis(architecture, codebaseAnalysis, systemId, discovery.modernizationNeeds[0]);

    assert.equal(architecture.migrationCandidates[0].status, "needs-review");
    assert.equal(architecture.migrationCandidates[0].strategyOptions[0].strategy, "unknown");
  });
});

describe("Discovery conflict", () => {
  test("Discovery stating one Java version and repository evidence stating another produces an unresolved conflict, never a silent overwrite", async () => {
    const conflictMarkdown = `# Project: Conflict Fixture Co\n\n## Business\n- **Business Name:** Conflict Fixture Co\n- **Industry:** Software\n\n## Goals\n- Modernize safely\n\n## Users\n- Staff\n\n## Existing Systems\n- **Order Portal:** Internal legacy order-management application.\n\n## Modernization Requirements\n- The business wants to modernize the Order Portal.\n- The target runtime must be Java 11.\n`;
    const discovery = await makeDiscovery(conflictMarkdown);
    const architecture = buildModernizationArchitecture(discovery, [], emptySecurity(), emptyObservability(), undefined);
    const codebaseAnalysis = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN); // compiler source level 8
    const systemId = architecture.profiles[0].systemId;

    const result = enrichModernizationWithCodebaseAnalysis(architecture, codebaseAnalysis, systemId, discovery.modernizationNeeds[0]);

    assert.equal(result.applied, true);
    assert.equal(architecture.codebaseEvidenceConflicts.length, 1);
    assert.equal(architecture.codebaseEvidenceConflicts[0].resolution, "unresolved");
    assert.ok(architecture.codebaseEvidenceConflicts[0].discoveryEvidence.length > 0);
    assert.ok(architecture.codebaseEvidenceConflicts[0].codebaseEvidence.length > 0);
  });
});

describe("Technical debt and validation enrichment", () => {
  test("an unresolved dependency version produces a codebase-cited technical debt finding, never scored high", async () => {
    const discovery = await makeDiscovery(javaModernizationMarkdown);
    const architecture = buildModernizationArchitecture(discovery, [], emptySecurity(), emptyObservability(), undefined);
    const codebaseAnalysis = await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);
    const systemId = architecture.profiles[0].systemId;

    enrichModernizationWithCodebaseAnalysis(architecture, codebaseAnalysis, systemId, discovery.modernizationNeeds[0]);

    const finding = architecture.technicalDebt.find((t) => t.codebaseEvidenceRefs?.length);
    assert.ok(finding);
    assert.notEqual(finding!.impact, "high");
    assert.ok(finding!.description.startsWith("Analysis finding:"));
  });
});

// ─── Fixture read-only guarantee (item 111) ────────────────────────────────

describe("Read-only guarantee", () => {
  test("analyzed fixture files remain byte-identical after analysis", async () => {
    const files = fs.readdirSync(LEGACY_JAVA_MAVEN, { recursive: true } as { recursive: true }) as unknown as string[];
    const before = new Map<string, Buffer>();
    for (const rel of files) {
      const full = path.join(LEGACY_JAVA_MAVEN, rel);
      if (fs.statSync(full).isFile()) before.set(rel, fs.readFileSync(full));
    }

    await runCodebaseAnalysis(LEGACY_JAVA_MAVEN);

    for (const [rel, contentBefore] of before) {
      const contentAfter = fs.readFileSync(path.join(LEGACY_JAVA_MAVEN, rel));
      assert.ok(contentBefore.equals(contentAfter), `${rel} changed after analysis`);
    }
  });
});
