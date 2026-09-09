/**
 * Builds one CapabilityCard per entry in SolutionBlueprint.capabilities,
 * joined with its SolutionPlan.assessments entry (same capabilityId).
 *
 * Two independent status axes are kept side by side rather than collapsed:
 * `assessmentStatus` (recommended/not-recommended/needs-review/blocked —
 * "should this be part of the solution") and `executionStatus`
 * (executed/skipped/failed — "did the capability actually run"). Neither
 * is ever used to compute the other (task: "recommended" must never be
 * displayed as if it meant "executed").
 */

import type { SolutionBlueprint } from "../../schemas/solution-blueprint/solution-blueprint.types.js";
import type { CapabilityAssessment } from "../../planning/capability-assessment/capability-assessment.types.js";
import type { CapabilityExecutionResult } from "../../schemas/capability/capability-result.types.js";
import type { ImplementationArtifact } from "../../core/contracts/artifact.js";
import type { CapabilityCard, EntityIndexEntry, SummaryMetric } from "./types.js";
import { toReportEvidenceRefs } from "./evidence.js";
import { pluralize } from "./format.js";

type Output = Record<string, unknown> | undefined;

function len(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function metric(singularLabel: string, value: number): SummaryMetric | undefined {
  return value > 0 ? { label: pluralize(singularLabel, value), value } : undefined;
}

function get(obj: Output, key: string): unknown {
  return obj ? obj[key] : undefined;
}

/**
 * One extractor per known capability id — each reads only real array
 * lengths already present on that capability's typed output. A capability
 * id not present here still gets a card (via the generic fallback below);
 * it just won't get a curated metrics breakdown until one is added here.
 */
const METRIC_EXTRACTORS: Record<string, (output: Output) => (SummaryMetric | undefined)[]> = {
  website: (o) => [metric("page", len(get(o, "pages")))],
  "workflow-automation": (o) => [
    metric("workflow", len(get(o, "workflows"))),
    metric("human touchpoint", len(get(get(o, "plan") as Output, "humanTouchpoints"))),
  ],
  integrations: (o) => [metric("integration", len(get(o, "integrations"))), metric("export bundle", len(get(o, "exports")))],
  "ai-agents": (o) => [metric("agent", len(get(o, "agents"))), metric("tool", len(get(o, "toolCatalog")))],
  "security-governance": (o) => {
    const security = get(o, "security") as Output;
    const governance = get(o, "governance") as Output;
    return [
      metric("security requirement", len(get(security, "requirements"))),
      metric("trust boundary", len(get(security, "trustBoundaries"))),
      metric("data protection requirement", len(get(security, "dataProtection"))),
      metric("risk", len(get(security, "risks"))),
      metric("governance policy", len(get(governance, "policies"))),
      metric("compliance consideration", len(get(governance, "complianceConsiderations"))),
    ];
  },
  observability: (o) => {
    const architecture = get(o, "architecture") as Output;
    return [
      metric("telemetry requirement", len(get(architecture, "telemetryRequirements"))),
      metric("signal", len(get(architecture, "signals"))),
      metric("alert requirement", len(get(architecture, "alertRequirements"))),
      metric("dashboard", len(get(architecture, "dashboardSpecifications"))),
      metric("operational objective", len(get(architecture, "operationalObjectives"))),
    ];
  },
  cloud: (o) => {
    const architecture = get(o, "architecture") as Output;
    return [
      metric("deployment unit", len(get(architecture, "deploymentUnits"))),
      metric("runtime requirement", len(get(architecture, "runtimeRequirements"))),
      metric("environment", len(get(architecture, "environmentRequirements"))),
      metric("scalability requirement", len(get(architecture, "scalabilityRequirements"))),
    ];
  },
  modernization: (o) => {
    const architecture = get(o, "architecture") as Output;
    return [
      metric("modernization candidate", len(get(architecture, "migrationCandidates"))),
      metric("dependency", len(get(architecture, "dependencies"))),
      metric("preservation requirement", len(get(architecture, "preservationRequirements"))),
      metric("migration constraint", len(get(architecture, "migrationConstraints"))),
      metric("risk", len(get(architecture, "risks"))),
      metric("validation requirement", len(get(architecture, "validationRequirements"))),
      metric("technical debt finding", len(get(architecture, "technicalDebt"))),
      metric("open question", len(get(architecture, "informationGaps"))),
    ];
  },
};

const SKIP_FALLBACK_KEYS = new Set(["artifacts", "notes", "evidenceRefs", "statusReasons", "implemented", "plan"]);

/** Generic fallback for a capability id with no curated extractor above — tolerates future capabilities (see docs/architecture/ARCHITECTURE.md "Schema Evolution"). */
function genericMetrics(output: Output): (SummaryMetric | undefined)[] {
  if (!output) return [];
  const metrics: (SummaryMetric | undefined)[] = [];
  const scan = (obj: Output) => {
    if (!obj) return;
    for (const [key, value] of Object.entries(obj)) {
      if (SKIP_FALLBACK_KEYS.has(key) || !Array.isArray(value)) continue;
      metrics.push(metric(key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase(), value.length));
    }
  };
  scan(output);
  scan(get(output, "architecture") as Output);
  return metrics;
}

function artifactPaths(output: Output): string[] {
  const artifacts = get(output, "artifacts") as ImplementationArtifact[] | undefined;
  if (!Array.isArray(artifacts)) return [];
  return artifacts.map((a) => a.path).filter((p): p is string => typeof p === "string");
}

export function buildCapabilityCards(
  blueprint: SolutionBlueprint,
  entityIndex: Record<string, EntityIndexEntry>
): CapabilityCard[] {
  const results = blueprint.capabilities ?? [];
  const assessmentsById = new Map<string, CapabilityAssessment>();
  for (const a of blueprint.planning?.assessments ?? []) assessmentsById.set(a.capabilityId, a);

  return results.map((result: CapabilityExecutionResult): CapabilityCard => {
    const assessment = assessmentsById.get(result.capabilityId);
    const output = (result.output ?? undefined) as Output;
    const extractor = METRIC_EXTRACTORS[result.capabilityId];
    const metrics = (extractor ? extractor(output) : genericMetrics(output)).filter(
      (m): m is SummaryMetric => m !== undefined
    );

    return {
      capabilityId: result.capabilityId,
      capabilityName: result.capabilityName,
      assessmentStatus: assessment?.status,
      assessmentConfidence: assessment?.confidence,
      assessmentMethod: assessment?.method,
      executionStatus: result.status,
      executionSuccess: result.success,
      summary: result.summary,
      error: result.error,
      reasons: (assessment?.reasons ?? []).map((r) => ({
        code: r.code,
        description: r.description,
        evidenceRefs: toReportEvidenceRefs(r.evidenceRefs, entityIndex),
      })),
      relatedSystemIds: assessment?.relatedSystemIds ?? [],
      relatedRequirementIds: assessment?.relatedRequirementIds ?? [],
      relatedOutcomeIds: assessment?.relatedOutcomeIds ?? [],
      relatedProcessIds: assessment?.relatedProcessIds ?? [],
      relatedConstraintIds: assessment?.relatedConstraintIds ?? [],
      blockingGapIds: assessment?.blockingGapIds ?? [],
      metrics,
      artifactPaths: artifactPaths(output),
      implemented: typeof get(output, "implemented") === "boolean" ? (get(output, "implemented") as boolean) : undefined,
      architectureStatus:
        typeof get(get(output, "architecture") as Output, "status") === "string"
          ? (get(get(output, "architecture") as Output, "status") as string)
          : undefined,
      statusReasons: Array.isArray(get(get(output, "architecture") as Output, "statusReasons"))
        ? (get(get(output, "architecture") as Output, "statusReasons") as string[])
        : undefined,
    };
  });
}
