/**
 * Placeholder guardrail domain model, primarily for the AI Agents capability
 * (tool permissions, output constraints) and Security & Governance.
 */

export type GuardrailSeverity = "info" | "warning" | "blocking";

export interface Guardrail {
  id: string;
  description: string;
  severity: GuardrailSeverity;
}

export interface GuardrailViolation {
  guardrailId: string;
  message: string;
  severity: GuardrailSeverity;
  detectedAt: string;
}
