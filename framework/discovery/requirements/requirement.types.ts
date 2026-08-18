/**
 * TODO: no extraction agent yet — populated manually or derived from
 * BusinessContext.goals/desiredOutcomes by a future discovery agent.
 */
export type RequirementPriority = "must" | "should" | "could" | "wont";

export interface RequirementItem {
  id: string;
  description: string;
  priority: RequirementPriority;
  source: string;
}
