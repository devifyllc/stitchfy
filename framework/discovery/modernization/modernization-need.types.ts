import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export type ModernizationDriver =
  | "maintainability"
  | "supportability"
  | "reliability"
  | "security"
  | "integration"
  | "delivery-speed"
  | "scalability"
  | "operational-cost"
  | "technical-debt"
  | "platform-lifecycle"
  | "business-change"
  | "unknown";

/**
 * Deliberately an aggregate, not a per-bullet atom like DeploymentNeed
 * (Phase 7B) — the shape itself (systemIds/drivers/desiredOutcomes/
 * preservationNeeds/constraints all as arrays on one record) is the given
 * interface's own design. Exactly one ModernizationNeed is produced per
 * document (see modernization-needs.extractor.ts header) — not split per
 * system, since nothing in the source text reliably distinguishes multiple
 * concurrent modernization efforts.
 */
export interface ModernizationNeed {
  id: string;
  systemIds: string[];
  drivers: ModernizationDriver[];
  desiredOutcomes: string[];
  preservationNeeds: string[];
  constraints: string[];
  /** Raw "Technical Debt" heading bullets — re-scanned by the capability layer's TechnicalDebtItem generator, never auto-attributed to a system unless unambiguous. */
  technicalDebtSignals: string[];
  metadata: DiscoveryMetadata;
}
