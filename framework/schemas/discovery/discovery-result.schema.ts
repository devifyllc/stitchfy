/**
 * Zod schemas for the Phase 1 discovery domain model. Each piece schema is
 * exported individually so both business-context-writer.ts (validates the
 * full DiscoveryResult before writing business-context.json) and
 * solution-blueprint.schema.ts (validates the same shapes embedded in
 * SolutionBlueprint.{requirements,processes,actors,systems,constraints,
 * businessRules,informationGaps,traceability}) reuse them instead of each
 * redefining their own copy.
 */

import { z } from "zod";

// ─── provenance ─────────────────────────────────────────────────────────────

export const SourceReferenceSchema = z.object({
  sourceType: z.enum(["input", "derived", "user", "system"]),
  section: z.string().optional(),
  text: z.string().optional(),
});

export const DiscoveryMetadataSchema = z.object({
  confidence: z.number().min(0, "confidence must be >= 0").max(1, "confidence must be <= 1"),
  sources: z.array(SourceReferenceSchema),
  inferred: z.boolean(),
});

// ─── business-level entities ────────────────────────────────────────────────

export const BusinessGoalSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  metadata: DiscoveryMetadataSchema,
});

export const PainPointSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  relatedProcessIds: z.array(z.string()),
  metadata: DiscoveryMetadataSchema,
});

export const DesiredOutcomeSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  relatedGoalIds: z.array(z.string()),
  metadata: DiscoveryMetadataSchema,
});

export const BusinessActorSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  description: z.string(),
  relatedProcessIds: z.array(z.string()),
  metadata: DiscoveryMetadataSchema,
});

export const BusinessRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  relatedProcessIds: z.array(z.string()),
  metadata: DiscoveryMetadataSchema,
});

export const DataEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  sensitive: z.boolean(),
  metadata: DiscoveryMetadataSchema,
});

export const IntegrationNeedSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  relatedSystemIds: z.array(z.string()),
  details: z.record(z.string(), z.string()).optional(),
  metadata: DiscoveryMetadataSchema,
});

// ─── processes ───────────────────────────────────────────────────────────────

export const BusinessProcessSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  actorIds: z.array(z.string()),
  trigger: z.string(),
  steps: z.array(z.string()),
  systemIds: z.array(z.string()),
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
  painPointIds: z.array(z.string()),
  businessRuleIds: z.array(z.string()),
  manualSteps: z.array(z.string()),
  automationCandidates: z.array(z.string()),
  metadata: DiscoveryMetadataSchema,
});

// ─── AI agent needs ──────────────────────────────────────────────────────────

export const AIAgentNeedSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  actorIds: z.array(z.string()),
  tasks: z.array(z.string()),
  relatedProcessIds: z.array(z.string()),
  relatedRequirementIds: z.array(z.string()),
  relatedOutcomeIds: z.array(z.string()),
  desiredCapabilities: z.array(
    z.enum([
      "conversation",
      "generation",
      "summarization",
      "classification",
      "extraction",
      "decision-support",
      "tool-use",
      "retrieval",
      "orchestration",
      "unknown",
    ])
  ),
  humanOversightRequired: z.union([z.boolean(), z.literal("unknown")]),
  metadata: DiscoveryMetadataSchema,
});

// ─── deployment needs ──────────────────────────────────────────────────────

export const DeploymentNeedSchema = z.object({
  id: z.string().min(1),
  category: z.enum([
    "hosting",
    "runtime",
    "compute",
    "storage",
    "persistence",
    "network",
    "environment",
    "scalability",
    "resilience",
    "availability",
    "location",
    "unknown",
  ]),
  description: z.string().min(1),
  relatedSystemIds: z.array(z.string()),
  relatedRequirementIds: z.array(z.string()),
  metadata: DiscoveryMetadataSchema,
});

// ─── modernization needs ────────────────────────────────────────────────────

export const ModernizationNeedSchema = z.object({
  id: z.string().min(1),
  systemIds: z.array(z.string()),
  drivers: z.array(
    z.enum([
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
    ])
  ),
  desiredOutcomes: z.array(z.string()),
  preservationNeeds: z.array(z.string()),
  constraints: z.array(z.string()),
  technicalDebtSignals: z.array(z.string()),
  metadata: DiscoveryMetadataSchema,
});

// ─── requirements ────────────────────────────────────────────────────────────

export const RequirementItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["functional", "non-functional", "integration", "security", "automation", "data", "operational", "ai"]),
  priority: z.enum(["must", "should", "could", "wont"]),
  relatedGoalIds: z.array(z.string()),
  relatedPainPointIds: z.array(z.string()),
  relatedProcessIds: z.array(z.string()),
  relatedOutcomeIds: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  metadata: DiscoveryMetadataSchema,
});

// ─── systems ─────────────────────────────────────────────────────────────────

export const SystemInventoryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["application", "saas", "database", "api", "spreadsheet", "manual", "legacy", "cloud-service", "unknown"]),
  purpose: z.string(),
  owner: z.string().optional(),
  technology: z.string().optional(),
  external: z.boolean().optional(),
  integrations: z.array(z.string()),
  dataHandled: z.array(z.string()),
  criticality: z.enum(["low", "medium", "high"]).optional(),
  metadata: DiscoveryMetadataSchema,
});

// ─── constraints ─────────────────────────────────────────────────────────────

export const ConstraintSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "technical",
    "business",
    "regulatory",
    "security",
    "budget",
    "timeline",
    "operational",
    "data",
    "integration",
    "unknown",
  ]),
  description: z.string().min(1),
  metadata: DiscoveryMetadataSchema,
});

// ─── gaps / traceability ─────────────────────────────────────────────────────

export const InformationGapSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  question: z.string().min(1),
  importance: z.enum(["low", "medium", "high"]),
  blocking: z.boolean(),
  relatedCapabilityIds: z.array(z.string()),
});

export const TraceabilityLinkSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  relationship: z.enum([
    "addresses",
    "derived-from",
    "affects",
    "depends-on",
    "performed-by",
    "uses-system",
    "constrained-by",
  ]),
});

// ─── root ────────────────────────────────────────────────────────────────────

export const DiscoveryResultSchema = z.object({
  businessName: z.string().min(1, "businessName is required"),
  industry: z.string(),
  goals: z.array(BusinessGoalSchema),
  painPoints: z.array(PainPointSchema),
  desiredOutcomes: z.array(DesiredOutcomeSchema),
  actors: z.array(BusinessActorSchema),
  processes: z.array(BusinessProcessSchema),
  requirements: z.array(RequirementItemSchema),
  systems: z.array(SystemInventoryItemSchema),
  integrationNeeds: z.array(IntegrationNeedSchema),
  dataEntities: z.array(DataEntitySchema),
  constraints: z.array(ConstraintSchema),
  businessRules: z.array(BusinessRuleSchema),
  informationGaps: z.array(InformationGapSchema),
  traceability: z.array(TraceabilityLinkSchema),
  aiAgentNeeds: z.array(AIAgentNeedSchema),
  deploymentNeeds: z.array(DeploymentNeedSchema),
  modernizationNeeds: z.array(ModernizationNeedSchema),
});
