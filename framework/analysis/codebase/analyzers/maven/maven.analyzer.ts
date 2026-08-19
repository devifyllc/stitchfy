/**
 * Maven analyzer — supports when at least one pom.xml survives scanning.
 * Extracts groupId/artifactId/version/packaging, parent coordinates,
 * modules, properties (merged across every locally-parsed POM, root-first —
 * never fetched from a remote parent/BOM, task item 75/76), dependencies
 * (direct) and dependencyManagement (direct: false), plugins, profile
 * names, and compiler settings. A `${property}` unresolved in the merged
 * local map becomes the literal string "unresolved" (task item 21) —
 * never guessed.
 */

import type { CodebaseAnalyzer, CodebaseAnalyzerContext } from "../../contracts/codebase-analyzer.types.js";
import type { AnalyzerDiagnostic } from "../../contracts/codebase-analyzer.types.js";
import type { BuildSystemFact, CodeDependencyFact, CodeModule, FrameworkFact, RuntimeFact, BuildSystemCoordinates } from "../../contracts/codebase-analysis-result.types.js";
import type { CodebaseEvidenceReference, CodebaseFactMetadata } from "../../contracts/codebase-evidence.types.js";
import { parsePomXml, findChild, findChildren, childText, type XmlNode } from "./pom-xml-parser.js";
import { detectFrameworkFromMavenCoordinate } from "../framework-detection.js";

export const MAVEN_ANALYZER_ID = "maven";

export interface MavenAnalyzerOutput {
  buildSystems: BuildSystemFact[];
  modules: CodeModule[];
  dependencies: CodeDependencyFact[];
  frameworks: FrameworkFact[];
  runtimes: RuntimeFact[];
  diagnostics: AnalyzerDiagnostic[];
}

const PROPERTY_PATTERN = /\$\{([^}]+)\}/;

function observed(evidenceRefs: CodebaseEvidenceReference[]): CodebaseFactMetadata {
  return { provenance: "observed", evidenceRefs };
}
function derived(evidenceRefs: CodebaseEvidenceReference[]): CodebaseFactMetadata {
  return { provenance: "derived", evidenceRefs };
}

function evidenceRef(filePath: string, line: number | undefined, symbol?: string): CodebaseEvidenceReference {
  return { analyzerId: MAVEN_ANALYZER_ID, filePath, line, symbol, evidenceType: "build-file" };
}

function resolveProperty(raw: string | undefined, localProps: Map<string, string>, mergedProps: Map<string, string>): string | undefined {
  if (raw === undefined) return undefined;
  const match = raw.match(PROPERTY_PATTERN);
  if (!match) return raw;
  const key = match[1];
  return localProps.get(key) ?? mergedProps.get(key) ?? "unresolved";
}

function parseCoordinatesNode(node: XmlNode | undefined): BuildSystemCoordinates | undefined {
  if (!node) return undefined;
  const name = childText(node, "artifactId");
  if (!name) return undefined;
  return { group: childText(node, "groupId"), name, version: childText(node, "version") };
}

export const mavenAnalyzer: CodebaseAnalyzer<MavenAnalyzerOutput> = {
  id: MAVEN_ANALYZER_ID,
  name: "Maven Analyzer",
  version: "1.0.0",
  supports(context: CodebaseAnalyzerContext): boolean {
    return context.files.some((f) => f.relativePath === "pom.xml" || f.relativePath.endsWith("/pom.xml"));
  },
  async analyze(context: CodebaseAnalyzerContext): Promise<MavenAnalyzerOutput> {
    const pomFiles = context.files.filter((f) => f.relativePath === "pom.xml" || f.relativePath.endsWith("/pom.xml")).sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const diagnostics: AnalyzerDiagnostic[] = [];
    const parsedPoms: Array<{ filePath: string; moduleId: string; root: XmlNode; localProps: Map<string, string> }> = [];

    // Pass 1: parse everything, merge properties root-first (shortest path = closest to root).
    const mergedProps = new Map<string, string>();
    let moduleCounter = 0;
    const modules: CodeModule[] = [];

    for (const file of pomFiles) {
      const content = context.readFile(file.relativePath);
      if (content === undefined) continue;
      const root = parsePomXml(content);
      if (!root || root.tag !== "project") {
        diagnostics.push({ analyzerId: MAVEN_ANALYZER_ID, severity: "error", message: `Failed to parse ${file.relativePath} as a Maven POM`, filePath: file.relativePath });
        continue;
      }

      const moduleId = `MODULE-${String(++moduleCounter).padStart(3, "0")}`;
      const artifactId = childText(root, "artifactId") ?? file.relativePath;
      modules.push({ id: moduleId, name: artifactId, relativePath: file.relativePath, buildSystemIds: [] });

      const localProps = new Map<string, string>();
      const propsNode = findChild(root, "properties");
      if (propsNode) for (const child of propsNode.children) if (child.text) localProps.set(child.tag, child.text);

      parsedPoms.push({ filePath: file.relativePath, moduleId, root, localProps });
    }

    parsedPoms
      .slice()
      .sort((a, b) => a.filePath.split("/").length - b.filePath.split("/").length)
      .forEach(({ localProps }) => {
        for (const [k, v] of localProps) if (!mergedProps.has(k)) mergedProps.set(k, v);
      });

    // Pass 2: build facts now that mergedProps is complete.
    const buildSystems: BuildSystemFact[] = [];
    const dependencies: CodeDependencyFact[] = [];
    const frameworks: FrameworkFact[] = [];
    const runtimes: RuntimeFact[] = [];
    let depCounter = 0;
    let buildSystemCounter = 0;

    for (const { filePath, moduleId, root, localProps } of parsedPoms) {
      const resolve = (raw: string | undefined) => resolveProperty(raw, localProps, mergedProps);

      const coordinates = parseCoordinatesNode(root);
      const parentNode = findChild(root, "parent");
      const parentCoordinates = parseCoordinatesNode(parentNode);
      const packaging = childText(root, "packaging");

      const compilerSourceRaw = localProps.get("maven.compiler.source") ?? mergedProps.get("maven.compiler.source");
      const compilerTargetRaw = localProps.get("maven.compiler.target") ?? mergedProps.get("maven.compiler.target");
      const compilerReleaseRaw = localProps.get("maven.compiler.release") ?? mergedProps.get("maven.compiler.release");

      const pluginCoordinates: BuildSystemCoordinates[] = [];
      let pluginCompilerSource: string | undefined;
      let pluginCompilerTarget: string | undefined;
      let pluginCompilerRelease: string | undefined;

      const buildNode = findChild(root, "build");
      const pluginsNode = findChild(buildNode, "plugins");
      for (const pluginNode of findChildren(pluginsNode, "plugin")) {
        const pc = parseCoordinatesNode(pluginNode);
        if (pc) pluginCoordinates.push(pc);
        if (pc?.name === "maven-compiler-plugin") {
          const config = findChild(pluginNode, "configuration");
          pluginCompilerSource = childText(config, "source") ?? pluginCompilerSource;
          pluginCompilerTarget = childText(config, "target") ?? pluginCompilerTarget;
          pluginCompilerRelease = childText(config, "release") ?? pluginCompilerRelease;
        }
      }

      const profilesNode = findChild(root, "profiles");
      const profiles = findChildren(profilesNode, "profile").map((p) => childText(p, "id")).filter((id): id is string => Boolean(id));

      const compilerSource = compilerSourceRaw ?? pluginCompilerSource;
      const compilerTarget = compilerTargetRaw ?? pluginCompilerTarget;
      const compilerRelease = compilerReleaseRaw ?? pluginCompilerRelease;

      const buildSystemId = `BUILDSYS-${String(++buildSystemCounter).padStart(3, "0")}`;
      buildSystems.push({
        id: buildSystemId,
        type: "maven",
        descriptorPath: filePath,
        moduleId,
        coordinates,
        parentCoordinates,
        packaging,
        compilerSource,
        compilerTarget,
        compilerRelease,
        pluginCoordinates,
        profiles,
        metadata: observed([evidenceRef(filePath, root.line, "project")]),
      });

      const moduleRecord = modules.find((m) => m.id === moduleId);
      moduleRecord?.buildSystemIds.push(buildSystemId);

      if (compilerSource || compilerTarget || compilerRelease) {
        runtimes.push({
          id: `RUNTIME-${String(runtimes.length + 1).padStart(3, "0")}`,
          type: "java",
          version: compilerRelease ?? compilerTarget ?? compilerSource,
          detectionMethod: "compiler-config",
          metadata: derived([evidenceRef(filePath, root.line, "maven.compiler.*")]),
        });
      }

      const dependencyLists: Array<{ nodes: XmlNode[]; direct: true | false }> = [
        { nodes: findChildren(findChild(root, "dependencies"), "dependency"), direct: true },
        { nodes: findChildren(findChild(findChild(root, "dependencyManagement"), "dependencies"), "dependency"), direct: false },
      ];

      for (const { nodes, direct } of dependencyLists) {
        for (const depNode of nodes) {
          const name = childText(depNode, "artifactId");
          if (!name) continue;
          const group = childText(depNode, "groupId");
          const versionRaw = childText(depNode, "version");
          const version = resolve(versionRaw);
          const scope = childText(depNode, "scope");

          const depId = `CODEDEP-${String(++depCounter).padStart(3, "0")}`;
          dependencies.push({
            id: depId,
            ecosystem: "maven",
            moduleId,
            group,
            name,
            version,
            scope,
            direct,
            metadata: observed([evidenceRef(filePath, depNode.line, `${group ?? "?"}:${name}`)]),
          });

          const frameworkMatch = detectFrameworkFromMavenCoordinate(group, name);
          if (frameworkMatch) {
            frameworks.push({
              id: `FRAMEWORK-${String(frameworks.length + 1).padStart(3, "0")}`,
              name: frameworkMatch.name,
              version,
              detectionMethod: "dependency",
              moduleIds: [moduleId],
              metadata: derived([{ ...evidenceRef(filePath, depNode.line, `${group ?? "?"}:${name}`), factId: depId }]),
            });
          }
        }
      }
    }

    return { buildSystems, modules, dependencies, frameworks, runtimes, diagnostics };
  },
};
