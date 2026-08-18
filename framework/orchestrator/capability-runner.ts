/**
 * CapabilityRunner — executes a single capability stage, mirroring the shape
 * of agent-runner.ts's runAgent() but for StitchfyCapability instead of the
 * website-blueprint-specific AgentConfig.
 */

import type { StitchfyCapability } from "../core/contracts/capability.js";
import type { SolutionContext } from "../core/contracts/context.js";
import type { CapabilityExecutionResult } from "../schemas/capability/capability-result.types.js";
import { logAuditEvent } from "../governance/audit/audit-logger.js";

export async function runCapability(
  capability: StitchfyCapability,
  context: SolutionContext
): Promise<CapabilityExecutionResult> {
  if (!capability.supports(context)) {
    return {
      capabilityId: capability.id,
      capabilityName: capability.name,
      status: "skipped",
      success: true,
      summary: "Not applicable to this business context",
    };
  }

  const start = Date.now();
  logAuditEvent({ actor: "capability-runner", action: "capability.started", capabilityId: capability.id });

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
    };
  }
}
