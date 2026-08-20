import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { CodebaseEvidenceReference } from "../../../analysis/codebase/contracts/codebase-evidence.types.js";

export type TestImpactCategory = "build" | "startup" | "business-behavior" | "integration" | "data" | "security" | "runtime" | "configuration" | "observability" | "deployment";

/** No fabricated acceptance criteria — `expectedBehavior` stays undefined unless architecture/evidence provides it (task item 37/88). */
export interface TestImpactArea {
  id: string;
  category: TestImpactCategory;
  description: string;
  affectedArchitectureRefs: ArchitectureReference[];
  affectedFiles: string[];
  expectedBehavior?: string;
  evidenceRefs: CodebaseEvidenceReference[];
}

export interface TestImpactSpecification {
  id: string;
  modernizationCandidateId: string;
  testAreas: TestImpactArea[];
  preservationRequirementIds: string[];
  migrationValidationRequirementIds: string[];
  informationGapIds: string[];
  evidenceRefs: CodebaseEvidenceReference[];
}

/** New, task-invited (item 43's own text only names example gates without a shape). Generated only for areas that actually exist — never an automatic deployment/cutover gate. */
export interface MigrationValidationGate {
  id: string;
  name: string;
  description: string;
  testImpactAreaIds: string[];
  status: "unresolved" | "defined";
}

export interface MigrationValidationPlan {
  candidateId: string;
  existingValidationRequirementIds: string[];
  testImpactSpecificationId: string;
  validationGates: MigrationValidationGate[];
  unresolvedCriteria: string[];
}
