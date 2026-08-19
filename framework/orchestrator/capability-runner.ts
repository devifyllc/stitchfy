/**
 * CapabilityRunner — executes a single capability stage, mirroring the shape
 * of agent-runner.ts's runAgent() but for StitchfyCapability instead of the
 * website-blueprint-specific AgentConfig.
 */

import type { StitchfyCapability } from "../core/contracts/capability.js";
import type { SolutionContext } from "../core/contracts/context.js";
import type { CapabilityExecutionResult } from "../schemas/capability/capability-result.types.js";
import type { CapabilityAssessment } from "../planning/capability-assessment/capability-assessment.types.js";
import { assessCapability } from "../planning/capability-assessment/assess-capabilities.js";
import { logAuditEvent } from "../governance/audit/audit-logger.js";

/**
 * The planning stage (solution-orchestrator.ts) already computed every
 * capability's assessment into context.capabilityAssessments before this
 * runs — this looks it up rather than recomputing selection logic. The
 * fallback only exists for direct/test callers that skip the planning
 * stage; it delegates to the exact same assessCapability() the planning
 * stage uses, so there is still only one place selection rules live.
 */
function resolveAssessment(capability: StitchfyCapability, context: SolutionContext): CapabilityAssessment {
  return (
    context.capabilityAssessments?.find((a) => a.capabilityId === capability.id) ??
    assessCapability(capability, context)
  );
}

export async function runCapability(
  capability: StitchfyCapability,
  context: SolutionContext
): Promise<CapabilityExecutionResult> {
  const assessment = resolveAssessment(capability, context);

  if (!capability.supports(context)) {
    return {
      capabilityId: capability.id,
      capabilityName: capability.name,
      status: "skipped",
      success: true,
      summary: "Not applicable to this business context",
      assessment,
    };
  }

  const start = Date.now();
  logAuditEvent({
    actor: "capability-runner",
    action: "capability.started",
    capabilityId: capability.id,
    details: { status: assessment.status, confidence: assessment.confidence, method: assessment.method },
  });

  try {
    const input = await capability.plan(context);
    const output = await capability.execute(input, context);
    const validation = await capability.validate(output, context);
    const durationMs = Date.now() - start;

    logAuditEvent({ actor: "capability-runner", action: "capability.completed", capabilityId: capability.id });

    return {
      capabilityId: capability.id,
      capabilityName: capability.name,
      status: "executed",
      success: validation.ok,
      summary: validation.ok ? "Executed" : undefined,
      error: validation.ok ? undefined : validation.errors.join("; "),
      durationMs,
      output,
      assessment,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    logAuditEvent({
      actor: "capability-runner",
      action: "capability.failed",
      capabilityId: capability.id,
      details: { error },
    });

    return {
      capabilityId: capability.id,
      capabilityName: capability.name,
      status: "failed",
      success: false,
      error,
      durationMs,
      assessment,
    };
  }
}
