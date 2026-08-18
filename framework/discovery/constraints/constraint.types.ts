/**
 * TODO: no extraction agent yet — populated manually or derived from
 * BusinessContext.constraints by a future discovery agent.
 */
export type ConstraintCategory = "budget" | "timeline" | "technical" | "regulatory" | "organizational";

export interface Constraint {
  id: string;
  category: ConstraintCategory;
  description: string;
}
