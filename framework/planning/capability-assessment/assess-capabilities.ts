/**
 * Generic capability assessment loop — zero capability-ID branching, so the
 * registry/orchestrator never need to know what any specific capability
 * means (task item 19). A capability that implements the optional
 * `assess()` contract gets a real structured assessment; every other
 * capability falls back to `legacyKeywordAssessment()`, which wraps its
 * existing `supports()` boolean — the exact same call `capability-runner.ts`
 * already gates execution on — so the legacy path never invents a second
 * source of truth for selection.
 */

import type { StitchfyCapability } from "../../core/contracts/capability.js";
import type { SolutionContext } from "../../core/contracts/context.js";
import type { CapabilityAssessment } from "./capability-assessment.types.js";
import type { CapabilityRegistry } from "../../core/registry/capability-registry.js";

export function legacyKeywordAssessment(
  capability: StitchfyCapability,
  context: SolutionContext
): CapabilityAssessment {
  const isSupported = capability.supports(context);

  return {
    capabilityId: capability.id,
    status: isSupported ? "recommended" : "not-recommended",
    confidence: "low",
    reasons: isSupported
      ? [
          {
            code: "legacy-keyword-match",
            description: `${capability.name} matched its legacy keyword heuristic against BusinessContext. Not yet migrated to structured assessment — see docs/architecture/ROADMAP.md.`,
            evidenceRefs: [],
          },
        ]
      : [],
    relatedProcessIds: [],
    relatedRequirementIds: [],
    relatedOutcomeIds: [],
    relatedSystemIds: [],
    relatedConstraintIds: [],
    blockingGapIds: [],
    method: "legacy-keyword",
  };
}

export function assessCapability(
  capability: StitchfyCapability,
  context: SolutionContext
): CapabilityAssessment {
  return capability.assess?.(context) ?? legacyKeywordAssessment(capability, context);
}

export function assessAllCapabilities(
  registry: CapabilityRegistry,
  context: SolutionContext
): CapabilityAssessment[] {
  return registry.getAll().map((capability) => assessCapability(capability, context));
}
