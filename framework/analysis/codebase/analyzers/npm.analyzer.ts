/**
 * npm analyzer — supports when package.json exists. JSON.parse only (no
 * eval, no script execution — task item 24 is satisfied by construction:
 * scripts are copied as {name, command} strings and no code path anywhere
 * references them as executable). Dependency ranges are preserved verbatim
 * (task item 77) — no lockfile-based resolution is attempted.
 */

import type { CodebaseAnalyzer, CodebaseAnalyzerContext, AnalyzerDiagnostic } from "../contracts/codebase-analyzer.types.js";
import type { BuildSystemFact, CodeDependencyFact, RuntimeFact, ConfigurationFact } from "../contracts/codebase-analysis-result.types.js";
import type { CodebaseEvidenceReference, CodebaseFactMetadata } from "../contracts/codebase-evidence.types.js";

export const NPM_ANALYZER_ID = "npm";

export interface NpmAnalyzerOutput {
  buildSystems: BuildSystemFact[];
  dependencies: CodeDependencyFact[];
  runtimes: RuntimeFact[];
  configurationFacts: ConfigurationFact[];
  diagnostics: AnalyzerDiagnostic[];
}

function observed(evidenceRefs: CodebaseEvidenceReference[]): CodebaseFactMetadata {
  return { provenance: "observed", evidenceRefs };
}

function evidenceRef(filePath: string, symbol?: string): CodebaseEvidenceReference {
  return { analyzerId: NPM_ANALYZER_ID, filePath, symbol, evidenceType: "manifest" };
}

const DEPENDENCY_FIELDS: Array<{ field: string; scope: string }> = [
  { field: "dependencies", scope: "dependencies" },
  { field: "devDependencies", scope: "devDependencies" },
  { field: "peerDependencies", scope: "peerDependencies" },
  { field: "optionalDependencies", scope: "optionalDependencies" },
];

export const npmAnalyzer: CodebaseAnalyzer<NpmAnalyzerOutput> = {
  id: NPM_ANALYZER_ID,
  name: "npm Analyzer",
  version: "1.0.0",
  supports(context: CodebaseAnalyzerContext): boolean {
    return context.files.some((f) => f.relativePath === "package.json" || f.relativePath.endsWith("/package.json"));
  },
  async analyze(context: CodebaseAnalyzerContext): Promise<NpmAnalyzerOutput> {
    const manifestFiles = context.files
      .filter((f) => f.relativePath === "package.json" || f.relativePath.endsWith("/package.json"))
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const buildSystems: BuildSystemFact[] = [];
    const dependencies: CodeDependencyFact[] = [];
    const runtimes: RuntimeFact[] = [];
    const configurationFacts: ConfigurationFact[] = [];
    const diagnostics: AnalyzerDiagnostic[] = [];
    let depCounter = 0;
    let buildSystemCounter = 0;
    let configCounter = 0;

    for (const file of manifestFiles) {
      const content = context.readFile(file.relativePath);
      if (content === undefined) continue;

      let pkg: Record<string, unknown>;
      try {
        pkg = JSON.parse(content);
      } catch {
        diagnostics.push({ analyzerId: NPM_ANALYZER_ID, severity: "error", message: `Failed to parse ${file.relativePath} as JSON`, filePath: file.relativePath });
        continue;
      }

      const name = typeof pkg.name === "string" ? pkg.name : file.relativePath;
      const version = typeof pkg.version === "string" ? pkg.version : undefined;
      const buildSystemId = `BUILDSYS-${String(++buildSystemCounter).padStart(3, "0")}`;

      const pluginCoordinates = Array.isArray(pkg.workspaces) || (pkg.workspaces && typeof pkg.workspaces === "object")
        ? [{ name: "workspaces" }]
        : [];

      buildSystems.push({
        id: buildSystemId,
        type: "npm",
        descriptorPath: file.relativePath,
        coordinates: { name, version },
        packaging: typeof pkg.type === "string" ? pkg.type : undefined,
        pluginCoordinates,
        profiles: [],
        metadata: observed([evidenceRef(file.relativePath, "package.json")]),
      });

      const engines = pkg.engines as Record<string, string> | undefined;
      if (engines?.node) {
        runtimes.push({
          id: `RUNTIME-${String(runtimes.length + 1).padStart(3, "0")}`,
          type: "node",
          version: engines.node,
          detectionMethod: "manifest",
          metadata: observed([evidenceRef(file.relativePath, "engines.node")]),
        });
      }

      for (const { field, scope } of DEPENDENCY_FIELDS) {
        const deps = pkg[field] as Record<string, string> | undefined;
        if (!deps) continue;
        for (const [depName, range] of Object.entries(deps).sort(([a], [b]) => a.localeCompare(b))) {
          dependencies.push({
            id: `CODEDEP-${String(++depCounter).padStart(3, "0")}`,
            ecosystem: "npm",
            name: depName,
            version: range,
            scope,
            direct: true,
            metadata: observed([evidenceRef(file.relativePath, `${field}.${depName}`)]),
          });
        }
      }
    }

    const lockfiles = context.files.filter((f) => f.relativePath.endsWith("package-lock.json") || f.relativePath.endsWith("npm-shrinkwrap.json"));
    for (const lockfile of lockfiles) {
      configurationFacts.push({ id: `CONFIGFACT-${String(++configCounter).padStart(3, "0")}`, relativePath: lockfile.relativePath, kind: "npm-lockfile" });
    }

    return { buildSystems, dependencies, runtimes, configurationFacts, diagnostics };
  },
};
