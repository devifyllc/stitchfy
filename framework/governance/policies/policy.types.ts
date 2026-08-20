/**
 * Placeholder policy domain model. TODO: a real condition/expression
 * language is deferred until a concrete policy engine is chosen — this
 * establishes where that decision will live.
 */

export type PolicyEffect = "allow" | "deny" | "require-approval";

export interface PolicyRule {
  id: string;
  description: string;
  effect: PolicyEffect;
}

export interface Policy {
  id: string;
  name: string;
  rules: PolicyRule[];
}
