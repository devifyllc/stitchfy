/**
 * Generic validation result shared across capabilities, governance, and the
 * solution-blueprint pipeline. Generalizes the ValidationResult shape already
 * used ad hoc in blueprint.schema.ts / validate-input.ts so new capabilities
 * don't each redefine their own success/failure envelope.
 */

export interface ValidationSuccess<T = unknown> {
  ok: true;
  data?: T;
  warnings?: string[];
}

export interface ValidationFailure {
  ok: false;
  errors: string[];
  warnings?: string[];
}

export type ValidationResult<T = unknown> = ValidationSuccess<T> | ValidationFailure;

export function validationOk<T>(data?: T, warnings?: string[]): ValidationSuccess<T> {
  return { ok: true, data, warnings };
}

export function validationFail(errors: string[], warnings?: string[]): ValidationFailure {
  return { ok: false, errors, warnings };
}
