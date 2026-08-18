/**
 * Shared error types for the solution-engineering pipeline. Keeping these
 * distinct (rather than throwing bare Error/string) lets the orchestrator and
 * reporting layer distinguish "a capability failed" from "a provider isn't
 * configured" from "output failed validation" without string-matching.
 */

export class StitchfyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StitchfyError";
  }
}

export class CapabilityError extends StitchfyError {
  public readonly capabilityId: string;

  constructor(capabilityId: string, message: string) {
    super(`[${capabilityId}] ${message}`);
    this.name = "CapabilityError";
    this.capabilityId = capabilityId;
  }
}

export class ProviderError extends StitchfyError {
  public readonly providerId: string;

  constructor(providerId: string, message: string) {
    super(`[${providerId}] ${message}`);
    this.name = "ProviderError";
    this.providerId = providerId;
  }
}

export class ValidationError extends StitchfyError {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(`Validation failed: ${errors.join("; ")}`);
    this.name = "ValidationError";
    this.errors = errors;
  }
}
