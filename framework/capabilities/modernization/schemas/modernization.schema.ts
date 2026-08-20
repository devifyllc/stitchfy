import { z } from "zod";
import { EvidenceReferenceSchema, ArchitectureReferenceSchema } from "../../../schemas/planning/planning.schema.js";
import { InformationGapSchema } from "../../../schemas/discovery/discovery-result.schema.js";
import { RiskAssessmentSchema } from "../../../planning/risk-assessment/risk-assessment.schema.js";
import { CodebaseEvidenceReferenceSchema } from "../../../analysis/codebase/contracts/codebase-analysis-result.schema.js";

const ModernizationDriverSchema = z.enum([
  "maintainability",
  "supportability",
  "reliability",
  "security",
  "integration",
  "delivery-speed",
  "scalability",
  "operational-cost",
  "technical-debt",
  "platform-lifecycle",
  "business-change",
  "unknown",
]);

// ─── Planning ────────────────────────────────────────────────────────────────

const ModernizationPlanSchema = z.object({
  modernizationNeedIds: z.array(z.string()),
  systemIds: z.array(z.string()),
  processIds: z.array(z.string()),
  integrationIds: z.array(z.string()),
  candidateSystemIds: z.array(z.string()),
  dependencyIds: z.array(z.string()),
  preservationRequirementIds: z.array(z.string()),
  informationGapIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

// ─── System profile ─────────────────────────────────────────────────────────

const SystemModernizationProfileSchema = z.object({
  id: z.string().min(1),
  systemId: z.string().min(1),
  modernizationNeedIds: z.array(z.string()),
  role: z.string(),
  lifecycleStatus: z.enum(["supported", "unsupported", "end-of-life", "unknown"]),
  modernizationDrivers: z.array(ModernizationDriverSchema),
  technicalDebtIds: z.array(z.string()),
  dependencyIds: z.array(z.string()),
  preservationRequirementIds: z.array(z.string()),
  constraintIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
  status: z.enum(["candidate", "retain", "needs-review", "out-of-scope"]),
  codebaseAnalysis: z
    .object({
      analysisId: z.string().min(1),
      frameworkFactIds: z.array(z.string()),
      runtimeFactIds: z.array(z.string()),
      dependencyFactIds: z.array(z.string()),
    })
    .optional(),
});

// ─── Technical debt ─────────────────────────────────────────────────────────

const TechnicalDebtItemSchema = z.object({
  id: z.string().min(1),
  systemId: z.string().min(1),
  category: z.enum([
    "architecture",
    "dependencies",
    "platform",
    "integration",
    "data",
    "deployment",
    "testing",
    "observability",
    "security",
    "maintainability",
    "manual-process",
    "unknown",
  ]),
  description: z.string().min(1),
  impact: z.enum(["low", "medium", "high", "unknown"]),
  evidenceRefs: z.array(EvidenceReferenceSchema),
  codebaseEvidenceRefs: z.array(CodebaseEvidenceReferenceSchema).optional(),
});

// ─── System dependencies ────────────────────────────────────────────────────

const SystemDependencySchema = z.object({
  id: z.string().min(1),
  sourceSystemId: z.string().min(1),
  targetSystemId: z.string().min(1),
  type: z.enum(["api", "database", "file", "messaging", "shared-data", "runtime", "manual", "unknown"]),
  direction: z.enum(["outbound", "inbound", "bidirectional", "unknown"]),
  integrationId: z.string().optional(),
  description: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Preservation ────────────────────────────────────────────────────────────

const PreservationRequirementSchema = z.object({
  id: z.string().min(1),
  systemId: z.string().min(1),
  type: z.enum(["business-behavior", "business-rule", "integration-contract", "data", "security", "operational", "user-experience", "compatibility", "unknown"]),
  description: z.string().min(1),
  sourceArchitectureRefs: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
  relatedSecurityRequirementIds: z.array(z.string()).optional(),
  relatedObservabilityObjectiveIds: z.array(z.string()).optional(),
});

// ─── Seams ───────────────────────────────────────────────────────────────────

const ModernizationSeamSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["integration-boundary", "system-boundary", "data-boundary", "runtime-boundary", "unknown"]),
  description: z.string().min(1),
  architectureRefs: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Migration constraints ───────────────────────────────────────────────────

const MigrationConstraintSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["downtime", "compatibility", "data-migration", "release-window", "budget", "business-continuity", "regulatory", "external-dependency", "target-platform", "unknown"]),
  description: z.string().min(1),
  relatedConstraintId: z.string().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Strategy ────────────────────────────────────────────────────────────────

const ModernizationStrategySchema = z.enum(["retain", "retire", "replace", "rehost", "replatform", "refactor", "rearchitect", "encapsulate", "unknown"]);

const ModernizationStrategyOptionSchema = z.object({
  strategy: ModernizationStrategySchema,
  status: z.enum(["explicit", "candidate", "not-supported", "needs-review"]),
  rationale: z.string(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
  prerequisiteIds: z.array(z.string()),
  riskIds: z.array(z.string()),
});

const MigrationApproachSchema = z.enum(["incremental", "parallel", "big-bang", "coexistence", "unknown"]);

const ModernizationDeltaSchema = z.object({
  id: z.string().min(1),
  systemId: z.string().min(1),
  category: z.enum(["runtime", "integration", "data", "deployment", "security", "observability", "business-behavior", "unknown"]),
  currentState: z.string().min(1),
  targetState: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const MigrationCandidateSchema = z.object({
  id: z.string().min(1),
  systemId: z.string().min(1),
  status: z.enum(["candidate", "retain", "needs-review", "blocked"]),
  driverIds: z.array(z.string()),
  strategyOptions: z.array(ModernizationStrategyOptionSchema),
  approach: MigrationApproachSchema,
  dependencyIds: z.array(z.string()),
  preservationRequirementIds: z.array(z.string()),
  riskIds: z.array(z.string()),
  informationGapIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Target state ────────────────────────────────────────────────────────────

const TargetStateRequirementSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["runtime", "integration", "data", "security", "observability", "deployment", "business-behavior", "compatibility", "unknown"]),
  description: z.string().min(1),
  explicit: z.boolean(),
  relatedSystemIds: z.array(z.string()),
  architectureRefs: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

// ─── Validation ──────────────────────────────────────────────────────────────

const MigrationValidationRequirementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["behavior", "integration", "data", "security", "performance", "operational", "compatibility", "unknown"]),
  description: z.string().min(1),
  preservationRequirementIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
  codebaseEvidenceRefs: z.array(CodebaseEvidenceReferenceSchema).optional(),
});

// ─── Codebase evidence conflicts (Phase 8.5A) ──────────────────────────────

const CodebaseEvidenceConflictSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  discoveryEvidence: z.array(EvidenceReferenceSchema),
  codebaseEvidence: z.array(CodebaseEvidenceReferenceSchema),
  description: z.string().min(1),
  resolution: z.enum(["unresolved", "prefer-discovery", "prefer-codebase", "confirmed"]),
});

// ─── Roadmap ─────────────────────────────────────────────────────────────────

const ModernizationWorkstreamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  systemIds: z.array(z.string()),
  candidateIds: z.array(z.string()),
  objective: z.string().min(1),
  prerequisiteIds: z.array(z.string()),
  sequence: z.number().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const RoadmapDependencySchema = z.object({
  id: z.string().min(1),
  fromWorkstreamId: z.string().min(1),
  toWorkstreamId: z.string().min(1),
  description: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

const ModernizationRoadmapSchema = z.object({
  candidateIds: z.array(z.string()),
  workstreams: z.array(ModernizationWorkstreamSchema),
  dependencies: z.array(RoadmapDependencySchema),
  validationRequirementIds: z.array(z.string()),
  informationGapIds: z.array(z.string()),
  status: z.enum(["draft", "needs-review", "complete"]),
});

// ─── ModernizationArchitecture ──────────────────────────────────────────────

export const ModernizationArchitectureSchema = z.object({
  version: z.string().min(1),
  profiles: z.array(SystemModernizationProfileSchema),
  dependencies: z.array(SystemDependencySchema),
  technicalDebt: z.array(TechnicalDebtItemSchema),
  preservationRequirements: z.array(PreservationRequirementSchema),
  seams: z.array(ModernizationSeamSchema),
  migrationConstraints: z.array(MigrationConstraintSchema),
  migrationCandidates: z.array(MigrationCandidateSchema),
  modernizationDeltas: z.array(ModernizationDeltaSchema),
  targetStateRequirements: z.array(TargetStateRequirementSchema),
  validationRequirements: z.array(MigrationValidationRequirementSchema),
  risks: z.array(RiskAssessmentSchema),
  roadmap: ModernizationRoadmapSchema,
  informationGaps: z.array(InformationGapSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema),
  codebaseEvidenceConflicts: z.array(CodebaseEvidenceConflictSchema),
  status: z.enum(["draft", "needs-review", "complete"]),
  statusReasons: z.array(z.string()),
});

const ImplementationArtifactSchema = z.object({
  id: z.string().min(1),
  capabilityId: z.string().min(1),
  type: z.enum(["blueprint", "business-context", "code", "config", "document", "report"]),
  path: z.string().optional(),
  content: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  generatedAt: z.string().min(1),
});

// ─── Phase 8.5B — Modernization Exporters ──────────────────────────────────

const ModernizationReadinessReasonSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["info", "warning", "blocking"]),
  architectureRefs: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema).optional(),
});

const ModernizationExportReadinessSchema = z.object({
  modernizationCandidateId: z.string().min(1),
  exporterId: z.string().min(1),
  status: z.enum(["ready", "needs-review", "blocked", "unsupported"]),
  reasons: z.array(ModernizationReadinessReasonSchema),
  preservationRequirementIds: z.array(z.string()),
  validationRequirementIds: z.array(z.string()),
  informationGapIds: z.array(z.string()),
  codebaseFactIds: z.array(z.string()),
  conflictIds: z.array(z.string()),
});

const ModernizationStateSummarySchema = z.object({
  runtime: z.string().optional(),
  frameworks: z.array(z.string()),
  packaging: z.string().optional(),
  notes: z.array(z.string()),
});

const MigrationRecipeStepSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["build", "dependency", "configuration", "source", "runtime", "packaging", "validation", "deployment", "manual-review"]),
  description: z.string().min(1),
  changeProposalIds: z.array(z.string()),
  prerequisiteIds: z.array(z.string()),
  preservationRequirementIds: z.array(z.string()),
  validationRequirementIds: z.array(z.string()),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
  confidence: z.enum(["explicit", "derived", "requires-review"]),
});

const MigrationRecipeSchema = z.object({
  id: z.string().min(1),
  modernizationCandidateId: z.string().min(1),
  systemId: z.string().min(1),
  strategy: ModernizationStrategySchema,
  currentState: ModernizationStateSummarySchema,
  targetState: ModernizationStateSummarySchema,
  steps: z.array(MigrationRecipeStepSchema),
  preservationRequirementIds: z.array(z.string()),
  validationRequirementIds: z.array(z.string()),
  informationGapIds: z.array(z.string()),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
  status: z.enum(["draft", "needs-review", "ready"]),
});

const DependencyCoordinateSchema = z.object({
  group: z.string().optional(),
  name: z.string().min(1),
  version: z.string().optional(),
});

const DependencyChangeProposalSchema = z.object({
  id: z.string().min(1),
  dependencyFactId: z.string().optional(),
  action: z.enum(["retain", "remove", "replace", "add", "review"]),
  currentDependency: DependencyCoordinateSchema.optional(),
  proposedDependency: DependencyCoordinateSchema.optional(),
  reason: z.string().min(1),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
  status: z.enum(["proposed", "needs-review", "blocked"]),
});

const ConfigurationChangeProposalSchema = z.object({
  id: z.string().min(1),
  filePath: z.string().min(1),
  configurationType: z.string().min(1),
  action: z.enum(["retain", "review", "remove", "replace", "add"]),
  description: z.string().min(1),
  targetConfiguration: z.string().optional(),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
  status: z.enum(["proposed", "needs-review", "blocked"]),
});

const BuildChangeProposalSchema = z.object({
  id: z.string().min(1),
  buildSystem: z.enum(["maven", "npm", "unknown"]),
  filePath: z.string().min(1),
  action: z.enum(["review", "modify", "retain"]),
  description: z.string().min(1),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
  status: z.enum(["proposed", "needs-review"]),
});

const SourceTransformationCandidateSchema = z.object({
  id: z.string().min(1),
  filePath: z.string().min(1),
  symbol: z.string().optional(),
  category: z.enum(["namespace", "runtime-api", "framework-api", "server-specific-api", "configuration-reference", "unknown"]),
  observedState: z.string().min(1),
  proposedDirection: z.string().optional(),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
  status: z.enum(["review", "candidate", "blocked"]),
});

const ManualReviewItemSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  description: z.string().min(1),
  affectedFiles: z.array(z.string()),
  reason: z.string().min(1),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
});

const TransformationProposalSetSchema = z.object({
  candidateId: z.string().min(1),
  dependencyChanges: z.array(DependencyChangeProposalSchema),
  configurationChanges: z.array(ConfigurationChangeProposalSchema),
  buildChanges: z.array(BuildChangeProposalSchema),
  sourceCandidates: z.array(SourceTransformationCandidateSchema),
  manualReviews: z.array(ManualReviewItemSchema),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
});

const TestImpactAreaSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["build", "startup", "business-behavior", "integration", "data", "security", "runtime", "configuration", "observability", "deployment"]),
  description: z.string().min(1),
  affectedArchitectureRefs: z.array(ArchitectureReferenceSchema),
  affectedFiles: z.array(z.string()),
  expectedBehavior: z.string().optional(),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
});

const TestImpactSpecificationSchema = z.object({
  id: z.string().min(1),
  modernizationCandidateId: z.string().min(1),
  testAreas: z.array(TestImpactAreaSchema),
  preservationRequirementIds: z.array(z.string()),
  migrationValidationRequirementIds: z.array(z.string()),
  informationGapIds: z.array(z.string()),
  evidenceRefs: z.array(CodebaseEvidenceReferenceSchema),
});

const MigrationValidationGateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  testImpactAreaIds: z.array(z.string()),
  status: z.enum(["unresolved", "defined"]),
});

const MigrationValidationPlanSchema = z.object({
  candidateId: z.string().min(1),
  existingValidationRequirementIds: z.array(z.string()),
  testImpactSpecificationId: z.string().min(1),
  validationGates: z.array(MigrationValidationGateSchema),
  unresolvedCriteria: z.array(z.string()),
});

const GeneratedModernizationFileSchema = z.object({
  path: z.string().min(1),
  role: z.enum(["recipe", "dependency-plan", "configuration-plan", "source-review", "test-impact", "validation-plan", "manifest"]),
  format: z.enum(["json", "markdown"]),
  content: z.string().optional(),
});

const ModernizationExportBundleSchema = z.object({
  id: z.string().min(1),
  candidateId: z.string().min(1),
  exporterId: z.string().min(1),
  readiness: ModernizationExportReadinessSchema,
  recipe: MigrationRecipeSchema,
  transformations: TransformationProposalSetSchema,
  testImpact: TestImpactSpecificationSchema,
  validationPlan: MigrationValidationPlanSchema,
  files: z.array(GeneratedModernizationFileSchema),
  artifacts: z.array(ImplementationArtifactSchema),
  notes: z.array(z.string()),
});

export const ModernizationSectionSchema = z.object({
  implemented: z.boolean(),
  plan: ModernizationPlanSchema.optional(),
  architecture: ModernizationArchitectureSchema,
  artifacts: z.array(ImplementationArtifactSchema),
  notes: z.array(z.string()),
  exports: z.array(ModernizationExportBundleSchema).optional(),
});
