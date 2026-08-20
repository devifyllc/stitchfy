import { z } from "zod";

export const CodebaseEvidenceReferenceSchema = z.object({
  analyzerId: z.string().min(1),
  filePath: z.string().min(1),
  line: z.number().optional(),
  symbol: z.string().optional(),
  factId: z.string().optional(),
  evidenceType: z.enum(["manifest", "build-file", "source", "configuration", "filesystem"]),
});

export const CodebaseFactMetadataSchema = z.object({
  provenance: z.enum(["observed", "derived"]),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
});

const BuildSystemCoordinatesSchema = z.object({
  group: z.string().optional(),
  name: z.string().min(1),
  version: z.string().optional(),
});

export const RepositoryInventorySchema = z.object({
  name: z.string().min(1),
  rootMarker: z.string(),
  detectedLanguages: z.array(z.string()),
  buildDescriptors: z.array(z.string()),
  moduleCount: z.number(),
  analyzedFileCount: z.number(),
  ignoredFileCount: z.number(),
  analyzersUsed: z.array(z.string()),
});

export const BuildSystemFactSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["maven", "npm", "gradle", "unknown"]),
  descriptorPath: z.string().min(1),
  moduleId: z.string().optional(),
  coordinates: BuildSystemCoordinatesSchema.optional(),
  parentCoordinates: BuildSystemCoordinatesSchema.optional(),
  packaging: z.string().optional(),
  compilerSource: z.string().optional(),
  compilerTarget: z.string().optional(),
  compilerRelease: z.string().optional(),
  pluginCoordinates: z.array(BuildSystemCoordinatesSchema),
  profiles: z.array(z.string()),
  metadata: CodebaseFactMetadataSchema,
});

export const CodeModuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  relativePath: z.string(),
  buildSystemIds: z.array(z.string()),
});

export const CodeDependencyFactSchema = z.object({
  id: z.string().min(1),
  ecosystem: z.enum(["maven", "npm", "unknown"]),
  moduleId: z.string().optional(),
  group: z.string().optional(),
  name: z.string().min(1),
  version: z.string().optional(),
  scope: z.string().optional(),
  direct: z.union([z.boolean(), z.literal("unknown")]),
  metadata: CodebaseFactMetadataSchema,
});

export const FrameworkFactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().optional(),
  detectionMethod: z.enum(["dependency", "import", "annotation", "plugin", "configuration", "unknown"]),
  moduleIds: z.array(z.string()),
  metadata: CodebaseFactMetadataSchema,
});

export const RuntimeFactSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["java", "node", "application-server", "servlet-container", "unknown"]),
  name: z.string().optional(),
  version: z.string().optional(),
  detectionMethod: z.enum(["manifest", "compiler-config", "descriptor", "dependency", "unknown"]),
  metadata: CodebaseFactMetadataSchema,
});

export const SourceStructureFactSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().optional(),
  packageName: z.string().optional(),
  symbolName: z.string().optional(),
  symbolKind: z.enum(["class", "interface", "enum", "record", "annotation", "unknown"]),
  annotations: z.array(z.string()),
  extends: z.array(z.string()).optional(),
  implements: z.array(z.string()).optional(),
  metadata: CodebaseFactMetadataSchema,
});

export const ConfigurationFactSchema = z.object({
  id: z.string().min(1),
  relativePath: z.string().min(1),
  kind: z.string().min(1),
});

export const CodebaseInformationGapSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  question: z.string().min(1),
  importance: z.enum(["low", "medium", "high"]),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
});

export const AnalyzerDiagnosticSchema = z.object({
  analyzerId: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
  filePath: z.string().optional(),
});

export const CodebaseAnalysisResultSchema = z.object({
  schemaVersion: z.literal("1.0"),
  repository: RepositoryInventorySchema,
  buildSystems: z.array(BuildSystemFactSchema),
  modules: z.array(CodeModuleSchema),
  dependencies: z.array(CodeDependencyFactSchema),
  frameworks: z.array(FrameworkFactSchema),
  runtimes: z.array(RuntimeFactSchema),
  sourceStructure: z.array(SourceStructureFactSchema),
  configurationFacts: z.array(ConfigurationFactSchema),
  informationGaps: z.array(CodebaseInformationGapSchema),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
  diagnostics: z.array(AnalyzerDiagnosticSchema),
  status: z.enum(["complete", "partial", "unsupported"]),
});
