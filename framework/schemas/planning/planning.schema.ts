/**
 * Zod schemas for the Phase 1.5 explainable planning model
 * (framework/planning/capability-assessment/). Mirrors the pattern in
 * framework/schemas/discovery/discovery-result.schema.ts: piece schemas
 * exported individually and composed, so solution-blueprint.schema.ts can
 * reuse SolutionPlanSchema for the new optional `planning` field.
 *
 * Also home to ArchitectureReferenceSchema (Phase 5) — a distinct reference
 * primitive from EvidenceReference (see framework/core/contracts/architecture-reference.ts)
 * kept alongside it since both are cross-capability reference contracts.
 */

import { z } from "zod";

export const EvidenceReferenceSchema = z.object({
  entityType: z.enum([
    "goal",
    "pain-point",
    "outcome",
    "process",
    "requirement",
    "system",
    "constraint",
    "business-rule",
    "integration",
    "information-gap",
    "actor",
    "data-entity",
    "ai-agent-need",
    "deployment-need",
    "modernization-need",
  ]),
  entityId: z.string().min(1),
  description: z.string().optional(),
});

export const ArchitectureReferenceSchema = z.object({
  entityType: z.enum([
    "workflow",
    "workflow-step",
    "integration",
    "system",
    "data-contract",
    "process",
    "requirement",
    "approval",
    "ai-agent",
    "ai-tool",
    "deployment-unit",
  ]),
  entityId: z.string().min(1),
});

export const AssessmentReasonSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

export const CapabilityAssessmentSchema = z.object({
  capabilityId: z.string().min(1),
  status: z.enum(["recommended", "not-recommended", "needs-review", "blocked"]),
  confidence: z.enum(["low", "medium", "high"]),
  reasons: z.array(AssessmentReasonSchema),
  relatedProcessIds: z.array(z.string()),
  relatedRequirementIds: z.array(z.string()),
  relatedOutcomeIds: z.array(z.string()),
  relatedSystemIds: z.array(z.string()),
  relatedConstraintIds: z.array(z.string()),
  blockingGapIds: z.array(z.string()),
  method: z.enum(["structured", "legacy-keyword", "explicit-request"]),
});

export const SolutionDecisionSchema = z.object({
  id: z.string().min(1),
  capabilityId: z.string().min(1),
  decision: z.enum(["selected", "not-selected", "deferred", "blocked"]),
  rationale: z.array(z.string()),
  evidenceRefs: z.array(EvidenceReferenceSchema),
});

export const SolutionPlanSchema = z.object({
  generatedAt: z.string().min(1),
  assessments: z.array(CapabilityAssessmentSchema),
  selectedCapabilities: z.array(z.string()),
  decisions: z.array(SolutionDecisionSchema),
  unresolvedGaps: z.array(z.string()),
});
