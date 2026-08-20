/**
 * Java source structure analyzer — regex-based, no compilation, no
 * method-body interpretation (task item 26). Extracts package/imports/
 * type declarations (class/interface/enum/record)/extends/implements, and
 * annotations found on the lines immediately preceding a declaration.
 * Imports feed the shared framework-detection table (detectionMethod:
 * "import"); application-server evidence is deliberately narrow — only a
 * small set of real, recognizable descriptor filenames, never inferred
 * from "this is Java EE" (task item 32).
 */

import * as path from "path";
import type { CodebaseAnalyzer, CodebaseAnalyzerContext } from "../contracts/codebase-analyzer.types.js";
import type { FrameworkFact, RuntimeFact, SourceStructureFact, SourceSymbolKind } from "../contracts/codebase-analysis-result.types.js";
import type { CodebaseEvidenceReference, CodebaseFactMetadata } from "../contracts/codebase-evidence.types.js";
import { detectFrameworkFromImport } from "./framework-detection.js";
import { buildLineIndex, lineForOffset } from "./text-position.js";

export const JAVA_SOURCE_ANALYZER_ID = "java-source";

export interface JavaSourceAnalyzerOutput {
  sourceStructure: SourceStructureFact[];
  frameworks: FrameworkFact[];
  runtimes: RuntimeFact[];
}

function observed(evidenceRefs: CodebaseEvidenceReference[]): CodebaseFactMetadata {
  return { provenance: "observed", evidenceRefs };
}
function derived(evidenceRefs: CodebaseEvidenceReference[]): CodebaseFactMetadata {
  return { provenance: "derived", evidenceRefs };
}

const PACKAGE_PATTERN = /^\s*package\s+([\w.]+)\s*;/m;
const IMPORT_PATTERN = /^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm;
const TYPE_DECL_PATTERN =
  /(?:^|\n)[ \t]*(?:(?:public|private|protected|abstract|final|static|strictfp)\s+)*(class|interface|enum|record|@interface)\s+(\w+)(?:\s*<[^>]*>)?(?:\s+extends\s+([\w.<>,\s]+?))?(?:\s+implements\s+([\w.<>,\s]+?))?\s*[{]/g;
const ANNOTATION_LINE_PATTERN = /^\s*@(\w+)/;

const WEBSPHERE_DESCRIPTOR_PATTERN = /^(ibm-web-bnd\.xml|ibm-web-ext\.xml|websphere\.xml)$/i;

function splitTypeList(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export const javaSourceAnalyzer: CodebaseAnalyzer<JavaSourceAnalyzerOutput> = {
  id: JAVA_SOURCE_ANALYZER_ID,
  name: "Java Source Structure Analyzer",
  version: "1.0.0",
  supports(context: CodebaseAnalyzerContext): boolean {
    return context.files.some((f) => f.ext === ".java");
  },
  async analyze(context: CodebaseAnalyzerContext): Promise<JavaSourceAnalyzerOutput> {
    const sourceStructure: SourceStructureFact[] = [];
    const frameworks: FrameworkFact[] = [];
    const runtimes: RuntimeFact[] = [];
    const seenFrameworks = new Map<string, FrameworkFact>();

    const javaFiles = context.files.filter((f) => f.ext === ".java").sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    for (const file of javaFiles) {
      const content = context.readFile(file.relativePath);
      if (content === undefined) continue;

      const lineIndex = buildLineIndex(content);
      const lines = content.split("\n");

      const packageMatch = content.match(PACKAGE_PATTERN);
      const packageName = packageMatch?.[1];

      IMPORT_PATTERN.lastIndex = 0;
      let importMatch: RegExpExecArray | null;
      while ((importMatch = IMPORT_PATTERN.exec(content)) !== null) {
        const importPath = importMatch[1];
        const line = lineForOffset(lineIndex, importMatch.index);
        const match = detectFrameworkFromImport(importPath);
        if (!match) continue;

        const evidenceRef: CodebaseEvidenceReference = { analyzerId: JAVA_SOURCE_ANALYZER_ID, filePath: file.relativePath, line, symbol: importPath, evidenceType: "source" };
        const existing = seenFrameworks.get(match.name);
        if (existing) {
          existing.metadata.evidenceRefs.push(evidenceRef);
        } else {
          const fact: FrameworkFact = {
            id: `FRAMEWORK-${String(seenFrameworks.size + 1).padStart(3, "0")}`,
            name: match.name,
            detectionMethod: "import",
            moduleIds: [],
            metadata: derived([evidenceRef]),
          };
          seenFrameworks.set(match.name, fact);
          frameworks.push(fact);
        }
      }

      TYPE_DECL_PATTERN.lastIndex = 0;
      let typeMatch: RegExpExecArray | null;
      while ((typeMatch = TYPE_DECL_PATTERN.exec(content)) !== null) {
        const rawKind = typeMatch[1];
        const symbolKind: SourceSymbolKind = rawKind === "@interface" ? "annotation" : (rawKind as SourceSymbolKind);
        const symbolName = typeMatch[2];
        const line = lineForOffset(lineIndex, typeMatch.index + (typeMatch[0].startsWith("\n") ? 1 : 0));

        const annotations: string[] = [];
        for (let l = line - 2; l >= Math.max(0, line - 6); l--) {
          const text = lines[l];
          if (text === undefined) break;
          const annotationMatch = text.match(ANNOTATION_LINE_PATTERN);
          if (annotationMatch) {
            annotations.unshift(annotationMatch[1]);
            continue;
          }
          if (text.trim().length === 0) continue;
          break;
        }

        sourceStructure.push({
          id: `SOURCE-${String(sourceStructure.length + 1).padStart(3, "0")}`,
          packageName,
          symbolName,
          symbolKind,
          annotations,
          extends: splitTypeList(typeMatch[3]),
          implements: splitTypeList(typeMatch[4]),
          metadata: observed([{ analyzerId: JAVA_SOURCE_ANALYZER_ID, filePath: file.relativePath, line, symbol: symbolName, evidenceType: "source" }]),
        });
      }
    }

    // Application-server evidence — a small, explicit descriptor-filename allowlist only (task item 32).
    for (const file of context.files) {
      const basename = path.basename(file.relativePath);
      if (!WEBSPHERE_DESCRIPTOR_PATTERN.test(basename)) continue;
      runtimes.push({
        id: `RUNTIME-${String(runtimes.length + 1).padStart(3, "0")}`,
        type: "application-server",
        name: "WebSphere",
        detectionMethod: "descriptor",
        metadata: observed([{ analyzerId: JAVA_SOURCE_ANALYZER_ID, filePath: file.relativePath, evidenceType: "configuration" }]),
      });
    }

    return { sourceStructure, frameworks, runtimes };
  },
};
