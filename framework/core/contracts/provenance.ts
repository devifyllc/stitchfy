/**
 * Provenance model — lets every discovery object distinguish (1) information
 * explicitly provided by the user, (2) information deterministically derived
 * from that information, (3) information inferred by an AI model, and
 * (4) missing information (represented separately — see
 * framework/discovery/gaps/information-gap.types.ts, not by a metadata
 * object at all, since there's no object to attach one to).
 *
 * `sourceType` records *how* a value was obtained; `inferred` separately
 * flags *AI* involvement specifically, so "derived" (deterministic rule,
 * e.g. combining two explicit fields) is never confused with "inferred"
 * (an AI model's guess) even though both are non-"input". A capability must
 * never silently treat an inferred value as an explicit business fact.
 */

export type SourceType = "input" | "derived" | "user" | "system";

export interface SourceReference {
  sourceType: SourceType;
  section?: string;
  text?: string;
}

export interface DiscoveryMetadata {
  confidence: number;
  sources: SourceReference[];
  inferred: boolean;
}

export function explicitMetadata(section: string, text?: string): DiscoveryMetadata {
  return { confidence: 1, sources: [{ sourceType: "input", section, text }], inferred: false };
}

export function derivedMetadata(section: string, text: string | undefined, confidence: number): DiscoveryMetadata {
  return { confidence, sources: [{ sourceType: "derived", section, text }], inferred: false };
}
