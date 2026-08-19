/**
 * Top-level orchestrator: scanner → analyzer registry → CodebaseAnalysisResult.
 * The only entry point that touches the filesystem outside the scanner/
 * analyzer-context boundary. Deterministic: identical repository contents
 * produce identical fact ordering and ids (task item 70/72/104).
 */

import * as fs from "fs";
import * as path from "path";
import { scanRepository } from "./scanner/repository-scanner.js";
import { resolveWithinRoot, toRepoRelativePath } from "./scanner/path-safety.js";
import { CodebaseAnalyzerRegistry } from "./analyzers/analyzer-registry.js";
import { repositoryAnalyzer } from "./analyzers/repository.analyzer.js";
import { mavenAnalyzer } from "./analyzers/maven/maven.analyzer.js";
import { npmAnalyzer } from "./analyzers/npm.analyzer.js";
import { javaSourceAnalyzer } from "./analyzers/java-source.analyzer.js";
import type { CodebaseAnalyzerContext, AnalyzerDiagnostic } from "./contracts/codebase-analyzer.types.js";
import type {
  CodebaseAnalysisResult,
  BuildSystemFact,
  CodeModule,
  CodeDependencyFact,
  FrameworkFact,
  RuntimeFact,
  ConfigurationFact,
  CodebaseInformationGap,
} from "./contracts/codebase-analysis-result.types.js";
import type { CodebaseEvidenceReference } from "./contracts/codebase-evidence.types.js";

const CONFIG_FILENAME_KINDS: Array<{ pattern: RegExp; kind: string }> = [
  { pattern: /^application\.properties$/, kind: "spring-properties" },
  { pattern: /^application\.ya?ml$/, kind: "spring-yaml" },
  { pattern: /^web\.xml$/, kind: "servlet-descriptor" },
  { pattern: /^persistence\.xml$/, kind: "jpa-descriptor" },
  { pattern: /^struts\.xml$/, kind: "struts-descriptor" },
  { pattern: /^beans\.xml$/, kind: "cdi-descriptor" },
  { pattern: /^MANIFEST\.MF$/, kind: "jar-manifest" },
];

function buildDefaultRegistry(): CodebaseAnalyzerRegistry {
  const registry = new CodebaseAnalyzerRegistry();
  registry.register(repositoryAnalyzer);
  registry.register(mavenAnalyzer);
  registry.register(npmAnalyzer);
  registry.register(javaSourceAnalyzer);
  return registry;
}

export async function runCodebaseAnalysis(rootPath: string, registry: CodebaseAnalyzerRegistry = buildDefaultRegistry()): Promise<CodebaseAnalysisResult> {
  const root = path.resolve(rootPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Repository path does not exist or is not a directory: ${rootPath}`);
  }

  const scanResult = scanRepository(root);

  const context: CodebaseAnalyzerContext = {
    repositoryName: path.basename(root),
    files: scanResult.files,
    readFile(relativePath: string): string | undefined {
      const resolved = resolveWithinRoot(root, relativePath);
      if (!resolved) return undefined;
      try {
        return fs.readFileSync(resolved, "utf-8");
      } catch {
        return undefined;
      }
    },
  };

  const supported = registry.findSupported(context);
  const diagnostics: AnalyzerDiagnostic[] = [];

  let buildSystems: BuildSystemFact[] = [];
  let modules: CodeModule[] = [];
  let dependencies: CodeDependencyFact[] = [];
  let frameworks: FrameworkFact[] = [];
  let runtimes: RuntimeFact[] = [];
  let configurationFacts: ConfigurationFact[] = [];
  let gaps: CodebaseInformationGap[] = [];
  let detectedLanguages: string[] = [];
  let buildDescriptors: string[] = [];
  let sourceStructure: CodebaseAnalysisResult["sourceStructure"] = [];

  for (const analyzer of supported) {
    try {
      const output = await analyzer.analyze(context);

      if (analyzer.id === repositoryAnalyzer.id) {
        const repoOutput = output as Awaited<ReturnType<typeof repositoryAnalyzer.analyze>>;
        detectedLanguages = repoOutput.detectedLanguages;
        buildDescriptors = repoOutput.buildDescriptors;
        gaps = gaps.concat(repoOutput.gaps);
      } else if (analyzer.id === mavenAnalyzer.id) {
        const mavenOutput = output as Awaited<ReturnType<typeof mavenAnalyzer.analyze>>;
        buildSystems = buildSystems.concat(mavenOutput.buildSystems);
        modules = modules.concat(mavenOutput.modules);
        dependencies = dependencies.concat(mavenOutput.dependencies);
        frameworks = frameworks.concat(mavenOutput.frameworks);
        runtimes = runtimes.concat(mavenOutput.runtimes);
        diagnostics.push(...mavenOutput.diagnostics);
      } else if (analyzer.id === npmAnalyzer.id) {
        const npmOutput = output as Awaited<ReturnType<typeof npmAnalyzer.analyze>>;
        buildSystems = buildSystems.concat(npmOutput.buildSystems);
        dependencies = dependencies.concat(npmOutput.dependencies);
        runtimes = runtimes.concat(npmOutput.runtimes);
        configurationFacts = configurationFacts.concat(npmOutput.configurationFacts);
        diagnostics.push(...npmOutput.diagnostics);
      } else if (analyzer.id === javaSourceAnalyzer.id) {
        const javaOutput = output as Awaited<ReturnType<typeof javaSourceAnalyzer.analyze>>;
        frameworks = frameworks.concat(javaOutput.frameworks);
        runtimes = runtimes.concat(javaOutput.runtimes);
        sourceStructure = javaOutput.sourceStructure;
      }
    } catch (err) {
      diagnostics.push({ analyzerId: analyzer.id, severity: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Re-number every fact id deterministically now that multiple analyzers may have independently produced the
  // same prefix (e.g. Maven and npm both emit BuildSystemFact/CodeDependencyFact) — cross-references
  // (dependency.moduleId, framework.moduleIds, module.buildSystemIds) are remapped alongside their targets so
  // referential integrity survives the renumbering.
  const moduleIdMap = new Map(modules.map((m, i) => [m.id, `MODULE-${String(i + 1).padStart(3, "0")}`]));
  const buildSystemIdMap = new Map(buildSystems.map((b, i) => [b.id, `BUILDSYS-${String(i + 1).padStart(3, "0")}`]));
  const dependencyIdMap = new Map(dependencies.map((d, i) => [d.id, `CODEDEP-${String(i + 1).padStart(3, "0")}`]));

  const remapFactId = (evidenceRefs: CodebaseEvidenceReference[]) => evidenceRefs.map((r) => (r.factId && dependencyIdMap.has(r.factId) ? { ...r, factId: dependencyIdMap.get(r.factId) } : r));

  modules = modules.map((m) => ({ ...m, id: moduleIdMap.get(m.id)!, buildSystemIds: m.buildSystemIds.map((id) => buildSystemIdMap.get(id) ?? id) }));
  buildSystems = buildSystems.map((b, i) => ({ ...b, id: `BUILDSYS-${String(i + 1).padStart(3, "0")}`, moduleId: b.moduleId ? moduleIdMap.get(b.moduleId) : undefined }));
  dependencies = dependencies.map((d, i) => ({ ...d, id: `CODEDEP-${String(i + 1).padStart(3, "0")}`, moduleId: d.moduleId ? moduleIdMap.get(d.moduleId) : undefined }));
  frameworks = frameworks.map((f, i) => ({
    ...f,
    id: `FRAMEWORK-${String(i + 1).padStart(3, "0")}`,
    moduleIds: f.moduleIds.map((id) => moduleIdMap.get(id) ?? id),
    metadata: { ...f.metadata, evidenceRefs: remapFactId(f.metadata.evidenceRefs) },
  }));
  runtimes = runtimes.map((r, i) => ({ ...r, id: `RUNTIME-${String(i + 1).padStart(3, "0")}` }));

  // Configuration inventory — presence only, generic across ecosystems.
  let configCounter = configurationFacts.length;
  for (const file of scanResult.files) {
    const basename = path.basename(file.relativePath);
    const match = CONFIG_FILENAME_KINDS.find((c) => c.pattern.test(basename));
    if (!match) continue;
    configurationFacts.push({ id: `CONFIGFACT-${String(++configCounter).padStart(3, "0")}`, relativePath: file.relativePath, kind: match.kind });
  }

  const repository = {
    name: context.repositoryName,
    rootMarker: buildDescriptors[0] ?? (scanResult.files.length > 0 ? scanResult.files[0].relativePath : ""),
    detectedLanguages,
    buildDescriptors,
    moduleCount: modules.length,
    analyzedFileCount: scanResult.analyzedFileCount,
    ignoredFileCount: scanResult.ignoredFileCount,
    analyzersUsed: supported.map((a) => a.id).sort(),
  };

  const evidenceRefs: CodebaseEvidenceReference[] = [
    ...buildSystems.flatMap((f) => f.metadata.evidenceRefs),
    ...dependencies.flatMap((f) => f.metadata.evidenceRefs),
    ...frameworks.flatMap((f) => f.metadata.evidenceRefs),
    ...runtimes.flatMap((f) => f.metadata.evidenceRefs),
  ];

  const hasErrorDiagnostic = diagnostics.some((d) => d.severity === "error");
  const status: CodebaseAnalysisResult["status"] = supported.length === 0 ? "unsupported" : hasErrorDiagnostic || gaps.length > 0 ? "partial" : "complete";

  return {
    schemaVersion: "1.0",
    repository,
    buildSystems,
    modules,
    dependencies,
    frameworks,
    runtimes,
    sourceStructure,
    configurationFacts,
    informationGaps: gaps,
    evidenceRefs,
    diagnostics,
    status,
  };
}

export { buildDefaultRegistry, toRepoRelativePath };
