import type { CodebaseEvidenceReference } from "../../../analysis/codebase/contracts/codebase-evidence.types.js";
import type { ModernizationStrategy } from "../schemas/modernization.types.js";

/** New, task-invited (item 11's own sketch references it without defining it). */
export interface ModernizationStateSummary {
  runtime?: string;
  frameworks: string[];
  packaging?: string;
  notes: string[];
}

export type MigrationRecipeStepCategory = "build" | "dependency" | "configuration" | "source" | "runtime" | "packaging" | "validation" | "deployment" | "manual-review";
export type MigrationRecipeStepConfidence = "explicit" | "derived" | "requires-review";

/** No dates, no duration estimates (task item 12). Logical order only where technically deterministic (task item 13). */
export interface MigrationRecipeStep {
  id: string;
  category: MigrationRecipeStepCategory;
  description: string;
  changeProposalIds: string[];
  prerequisiteIds: string[];
  preservationRequirementIds: string[];
  validationRequirementIds: string[];
  evidenceRefs: CodebaseEvidenceReference[];
  confidence: MigrationRecipeStepConfidence;
}

export type MigrationRecipeStatus = "draft" | "needs-review" | "ready";

export interface MigrationRecipe {
  id: string;
  modernizationCandidateId: string;
  systemId: string;
  strategy: ModernizationStrategy;
  currentState: ModernizationStateSummary;
  targetState: ModernizationStateSummary;
  steps: MigrationRecipeStep[];
  preservationRequirementIds: string[];
  validationRequirementIds: string[];
  informationGapIds: string[];
  evidenceRefs: CodebaseEvidenceReference[];
  status: MigrationRecipeStatus;
}
