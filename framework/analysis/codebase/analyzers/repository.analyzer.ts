/**
 * The generic filesystem analyzer — always supports. Detects languages from
 * a file-extension histogram and every recognized build-descriptor
 * filename present, regardless of whether a real analyzer exists for it.
 * For any descriptor whose ecosystem has no registered analyzer, emits one
 * honest CodebaseInformationGap ("Build system detected: Gradle. Analyzer
 * support: unavailable.") — this is the entire mechanism behind task item
 * 107; no per-ecosystem special-casing exists anywhere else.
 */

import * as path from "path";
import type { CodebaseAnalyzer, CodebaseAnalyzerContext } from "../contracts/codebase-analyzer.types.js";
import type { CodebaseInformationGap } from "../contracts/codebase-analysis-result.types.js";

export const REPOSITORY_ANALYZER_ID = "repository";

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".java": "Java",
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".cs": "C#",
  ".rb": "Ruby",
};

// filename → { ecosystem label, whether Phase 8.5A ships a real analyzer for it }
const BUILD_DESCRIPTOR_TABLE: Array<{ pattern: RegExp; label: string; ecosystem: string; supported: boolean }> = [
  { pattern: /^pom\.xml$/, label: "pom.xml", ecosystem: "Maven", supported: true },
  { pattern: /^package\.json$/, label: "package.json", ecosystem: "npm", supported: true },
  { pattern: /^build\.gradle(\.kts)?$/, label: "build.gradle", ecosystem: "Gradle", supported: false },
  { pattern: /\.csproj$/, label: "*.csproj", ecosystem: ".NET", supported: false },
  { pattern: /^requirements\.txt$/, label: "requirements.txt", ecosystem: "Python (pip)", supported: false },
  { pattern: /^go\.mod$/, label: "go.mod", ecosystem: "Go", supported: false },
];

export interface RepositoryAnalyzerOutput {
  detectedLanguages: string[];
  buildDescriptors: string[];
  gaps: CodebaseInformationGap[];
}

export const repositoryAnalyzer: CodebaseAnalyzer<RepositoryAnalyzerOutput> = {
  id: REPOSITORY_ANALYZER_ID,
  name: "Repository / Filesystem Analyzer",
  version: "1.0.0",
  supports: () => true,
  async analyze(context: CodebaseAnalyzerContext): Promise<RepositoryAnalyzerOutput> {
    const languages = new Set<string>();
    const descriptors = new Set<string>();
    const unsupportedEcosystems = new Set<string>();

    for (const file of context.files) {
      const language = EXTENSION_LANGUAGE_MAP[file.ext];
      if (language) languages.add(language);

      const basename = path.basename(file.relativePath);
      for (const entry of BUILD_DESCRIPTOR_TABLE) {
        if (!entry.pattern.test(basename)) continue;
        descriptors.add(entry.label);
        if (!entry.supported) unsupportedEcosystems.add(entry.ecosystem);
      }
    }

    let gapCounter = 0;
    const gaps: CodebaseInformationGap[] = [...unsupportedEcosystems].sort().map((ecosystem) => ({
      id: `CODEGAP-REPO-${++gapCounter}`,
      topic: "Unsupported build system",
      question: `Build system detected: ${ecosystem}. Analyzer support: unavailable.`,
      importance: "low",
      evidenceRefs: [],
    }));

    return { detectedLanguages: [...languages].sort(), buildDescriptors: [...descriptors].sort(), gaps };
  },
};
