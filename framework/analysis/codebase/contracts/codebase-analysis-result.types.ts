import type { CodebaseEvidenceReference, CodebaseFactMetadata } from "./codebase-evidence.types.js";
import type { AnalyzerDiagnostic } from "./codebase-analyzer.types.js";

// ─── Repository inventory ───────────────────────────────────────────────────

/**
 * Never persists the absolute local path, a Git remote URL, a username, or
 * a machine name — `name` is only ever the supplied directory's basename.
 */
export interface RepositoryInventory {
  name: string;
  rootMarker: string;
  detectedLanguages: string[];
  buildDescriptors: string[];
  moduleCount: number;
  analyzedFileCount: number;
  ignoredFileCount: number;
  analyzersUsed: string[];
}

// ─── Build systems ───────────────────────────────────────────────────────────

export type BuildSystemType = "maven" | "npm" | "gradle" | "unknown";

export interface BuildSystemCoordinates {
  group?: string;
  name: string;
  version?: string;
}

/**
 * One per descriptor file (pom.xml, package.json, ...). Covers Maven's full
 * checklist (coordinates/parent/packaging/compiler settings/plugins/
 * profiles) and doubles as npm's manifest-level fact.
 */
export interface BuildSystemFact {
  id: string;
  type: BuildSystemType;
  descriptorPath: string;
  moduleId?: string;
  coordinates?: BuildSystemCoordinates;
  parentCoordinates?: BuildSystemCoordinates;
  packaging?: string;
  compilerSource?: string;
  compilerTarget?: string;
  compilerRelease?: string;
  pluginCoordinates: BuildSystemCoordinates[];
  profiles: string[];
  metadata: CodebaseFactMetadata;
}

// ─── Modules ─────────────────────────────────────────────────────────────────

/** A build/code-organization fact only — never a system, microservice, or bounded context (task item 22/36). */
export interface CodeModule {
  id: string;
  name: string;
  relativePath: string;
  buildSystemIds: string[];
}

// ─── Dependencies ────────────────────────────────────────────────────────────

export type CodeDependencyEcosystem = "maven" | "npm" | "unknown";

/** Never marked vulnerable, obsolete, deprecated, or unsupported (task item 20). */
export interface CodeDependencyFact {
  id: string;
  ecosystem: CodeDependencyEcosystem;
  moduleId?: string;
  group?: string;
  name: string;
  version?: string;
  scope?: string;
  direct: true | false | "unknown";
  metadata: CodebaseFactMetadata;
}

// ─── Frameworks ──────────────────────────────────────────────────────────────

export type FrameworkDetectionMethod = "dependency" | "import" | "annotation" | "plugin" | "configuration" | "unknown";

/** Presence/version only — never lifecycle/support/vulnerability status (task item 29). */
export interface FrameworkFact {
  id: string;
  name: string;
  version?: string;
  detectionMethod: FrameworkDetectionMethod;
  moduleIds: string[];
  metadata: CodebaseFactMetadata;
}

// ─── Runtimes ────────────────────────────────────────────────────────────────

export type RuntimeFactType = "java" | "node" | "application-server" | "servlet-container" | "unknown";
export type RuntimeDetectionMethod = "manifest" | "compiler-config" | "descriptor" | "dependency" | "unknown";

export interface RuntimeFact {
  id: string;
  type: RuntimeFactType;
  name?: string;
  version?: string;
  detectionMethod: RuntimeDetectionMethod;
  metadata: CodebaseFactMetadata;
}

// ─── Source structure ────────────────────────────────────────────────────────

export type SourceSymbolKind = "class" | "interface" | "enum" | "record" | "annotation" | "unknown";

/** Never persists a complete source file — a structural summary only (task item 33/34). */
export interface SourceStructureFact {
  id: string;
  moduleId?: string;
  packageName?: string;
  symbolName?: string;
  symbolKind: SourceSymbolKind;
  annotations: string[];
  extends?: string[];
  implements?: string[];
  metadata: CodebaseFactMetadata;
}

// ─── Configuration inventory ─────────────────────────────────────────────────

/** Presence only — content is never parsed in this phase (task item 50/51). */
export interface ConfigurationFact {
  id: string;
  relativePath: string;
  kind: string;
}

// ─── Gaps ────────────────────────────────────────────────────────────────────

export type CodebaseGapImportance = "low" | "medium" | "high";

export interface CodebaseInformationGap {
  id: string;
  topic: string;
  question: string;
  importance: CodebaseGapImportance;
  evidenceRefs: CodebaseEvidenceReference[];
}

// ─── Result ──────────────────────────────────────────────────────────────────

export type CodebaseAnalysisStatus = "complete" | "partial" | "unsupported";

/** Stitchfy's own analysis aggregate — not a lockfile (task item 52). */
export interface DependencyManifest {
  systemId?: string;
  buildSystems: string[];
  directDependencies: CodeDependencyFact[];
  frameworks: FrameworkFact[];
  runtimes: RuntimeFact[];
  modules: CodeModule[];
  evidenceRefs: CodebaseEvidenceReference[];
}

export interface CodebaseAnalysisResult {
  schemaVersion: "1.0";
  repository: RepositoryInventory;
  buildSystems: BuildSystemFact[];
  modules: CodeModule[];
  dependencies: CodeDependencyFact[];
  frameworks: FrameworkFact[];
  runtimes: RuntimeFact[];
  sourceStructure: SourceStructureFact[];
  configurationFacts: ConfigurationFact[];
  informationGaps: CodebaseInformationGap[];
  evidenceRefs: CodebaseEvidenceReference[];
  diagnostics: AnalyzerDiagnostic[];
  status: CodebaseAnalysisStatus;
}
