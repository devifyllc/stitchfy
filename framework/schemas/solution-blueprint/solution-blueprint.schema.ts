/**
 * Zod schema for the SolutionBlueprint. Mirrors solution-blueprint.types.ts
 * 1:1, following the same actionable-error-message style as
 * framework/schemas/blueprint.schema.ts. Nearly every section is optional —
 * it's only required once the corresponding capability has actually run.
 */

import { z } from "zod";
import { WorkflowAutomationSectionSchema } from "../../capabilities/workflow-automation/schemas/workflow-automation.schema.js";
import { AIAgentsSectionSchema } from "../../capabilities/ai-agents/schemas/ai-agents.schema.js";
import { IntegrationsSectionSchema } from "../../capabilities/integrations/schemas/integrations.schema.js";
import { CloudArchitectureSectionSchema } from "../../capabilities/cloud/schemas/cloud.schema.js";
import {
  SecurityArchitectureSchema,
  GovernancePlanSchema,
} from "../../capabilities/security-governance/schemas/security-governance.schema.js";
import { RiskAssessmentSchema } from "../../planning/risk-assessment/risk-assessment.schema.js";
import { ObservabilitySectionSchema } from "../../capabilities/observability/schemas/observability.schema.js";
import { ModernizationSectionSchema } from "../../capabilities/modernization/schemas/modernization.schema.js";
import { BusinessContextSchema } from "../business-context/business-context.schema.js";
import {
  RequirementItemSchema,
  BusinessProcessSchema,
  BusinessActorSchema,
  SystemInventoryItemSchema,
  ConstraintSchema,
  BusinessRuleSchema,
  InformationGapSchema,
  TraceabilityLinkSchema,
} from "../discovery/discovery-result.schema.js";
import { CapabilityAssessmentSchema, SolutionPlanSchema } from "../planning/planning.schema.js";

// ─── project (reused shape from blueprint.schema.ts, kept local since that
// file doesn't export its ProjectSchema) ───────────────────────────────────

const ProjectSchema = z.object({
  schemaVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  sourceFile: z.string().min(1),
  frameworkVersion: z.string().min(1),
});

// ─── requirements / processes / actors / systems / constraints are the
// Phase 1 discovery schemas, imported above and reused as-is — see
// framework/schemas/discovery/discovery-result.schema.ts ───────────────────

// ─── capabilities / artifacts / risks ──────────────────────────────────────

const CapabilityExecutionResultSchema = z.object({
  capabilityId: z.string().min(1),
  capabilityName: z.string().min(1),
  status: z.enum(["executed", "skipped", "failed"]),
  success: z.boolean(),
  summary: z.string().optional(),
  error: z.string().optional(),
  durationMs: z.number().optional(),
  output: z.unknown().optional(),
  assessment: CapabilityAssessmentSchema.optional(),
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

// ─── deployment / qa ────────────────────────────────────────────────────────

const DeploymentInfoSchema = z.object({
  environments: z.array(z.string()),
  strategy: z.string(),
  notes: z.array(z.string()),
});

const SolutionQASchema = z.object({
  expectedReports: z.array(z.string()),
  knownLimitations: z.array(z.string()),
});

// ─── Root ───────────────────────────────────────────────────────────────────

export const SolutionBlueprintSchema = z.object({
  project: ProjectSchema,
  business: BusinessContextSchema,
  requirements: z.array(RequirementItemSchema).optional(),
  processes: z.array(BusinessProcessSchema).optional(),
  actors: z.array(BusinessActorSchema).optional(),
  systems: z.array(SystemInventoryItemSchema).optional(),
  constraints: z.array(ConstraintSchema).optional(),
  businessRules: z.array(BusinessRuleSchema).optional(),
  informationGaps: z.array(InformationGapSchema).optional(),
  traceability: z.array(TraceabilityLinkSchema).optional(),
  planning: SolutionPlanSchema.optional(),
  capabilities: z.array(CapabilityExecutionResultSchema).optional(),
  architecture: CloudArchitectureSectionSchema.optional(),
  integrations: IntegrationsSectionSchema.optional(),
  automation: WorkflowAutomationSectionSchema.optional(),
  ai: AIAgentsSectionSchema.optional(),
  security: SecurityArchitectureSchema.optional(),
  governance: GovernancePlanSchema.optional(),
  observability: ObservabilitySectionSchema.optional(),
  modernization: ModernizationSectionSchema.optional(),
  deployment: DeploymentInfoSchema.optional(),
  risks: z.array(RiskAssessmentSchema).optional(),
  artifacts: z.array(ImplementationArtifactSchema).optional(),
  qa: SolutionQASchema.optional(),
});

export type SolutionBlueprintValidationSuccess = {
  ok: true;
  blueprint: import("./solution-blueprint.types.js").SolutionBlueprint;
};
export type SolutionBlueprintValidationFailure = { ok: false; errors: string[] };
export type SolutionBlueprintValidationResult =
  | SolutionBlueprintValidationSuccess
  | SolutionBlueprintValidationFailure;

export function validateSolutionBlueprint(data: unknown): SolutionBlueprintValidationResult {
  const result = SolutionBlueprintSchema.safeParse(data);

  if (result.success) {
    return { ok: true, blueprint: result.data as import("./solution-blueprint.types.js").SolutionBlueprint };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    const section = String(issue.path[0] ?? "root");
    return `[${section}] ${path ? `${path}: ` : ""}${issue.message}`;
  });

  return { ok: false, errors };
}
