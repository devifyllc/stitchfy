/**
 * BusinessContext — the discovery-layer counterpart to BusinessData
 * (framework/schemas/blueprint.types.ts). BusinessData captures what the
 * website pipeline needs (contact info, hours, services). BusinessContext
 * captures the broader solution-engineering picture: goals, users,
 * processes, pain points, existing systems, rules, integrations, data,
 * constraints, and desired outcomes — the input the Solution Architect and
 * capability `supports()` checks reason over.
 */

export interface BusinessContext {
  businessName: string;
  industry: string;
  goals: string[];
  users: string[];
  processes: string[];
  painPoints: string[];
  existingSystems: string[];
  businessRules: string[];
  integrations: string[];
  data: string[];
  constraints: string[];
  desiredOutcomes: string[];
  missingInformation: string[];
}
