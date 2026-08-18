/**
 * TODO: no extraction agent yet — this is the shape the Legacy Modernization
 * capability's system inventory will eventually populate.
 */
export type SystemCriticality = "low" | "medium" | "high";

export interface SystemInventoryItem {
  id: string;
  name: string;
  type: string;
  vendor?: string;
  criticality: SystemCriticality;
  integrations: string[];
}
