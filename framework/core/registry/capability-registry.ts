/**
 * CapabilityRegistry — capabilities register themselves here instead of
 * being wired into the orchestrator by name. New capabilities plug in by
 * adding a `register()` call in default-capabilities.ts; the orchestrator
 * never needs a switch statement over capability ids.
 */

import type { StitchfyCapability } from "../contracts/capability.js";
import type { SolutionContext } from "../contracts/context.js";

export class CapabilityRegistry {
  private capabilities = new Map<string, StitchfyCapability>();

  register(capability: StitchfyCapability): void {
    if (this.capabilities.has(capability.id)) {
      throw new Error(`CapabilityRegistry: "${capability.id}" is already registered`);
    }
    this.capabilities.set(capability.id, capability);
  }

  get(id: string): StitchfyCapability | undefined {
    return this.capabilities.get(id);
  }

  getAll(): StitchfyCapability[] {
    return [...this.capabilities.values()];
  }

  getSupported(context: SolutionContext): StitchfyCapability[] {
    return this.getAll().filter((capability) => capability.supports(context));
  }
}
