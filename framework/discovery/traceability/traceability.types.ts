/**
 * Minimal generic relation model — deliberately not a graph database. Every
 * link is built only from relation IDs already stored on a typed discovery
 * object (see traceability.extractor.ts), so a link is always explainable
 * back to an explicit field rather than a fuzzy/semantic match.
 */

export type TraceabilityRelationship =
  | "addresses"
  | "derived-from"
  | "affects"
  | "depends-on"
  | "performed-by"
  | "uses-system"
  | "constrained-by";

export interface TraceabilityLink {
  fromId: string;
  toId: string;
  relationship: TraceabilityRelationship;
}
