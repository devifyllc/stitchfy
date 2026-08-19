/**
 * ArchitectureReference — points a requirement/control/risk at a part of
 * the *generated* solution architecture (a workflow, a step, an
 * integration, ...), as distinct from EvidenceReference, which points at
 * the DiscoveryResult entity that justified making the decision at all.
 *
 * EvidenceReference answers "why did we make this decision?"
 * ArchitectureReference answers "what part of the proposed architecture
 * does this requirement apply to?" — kept as two separate contracts
 * because conflating them would make it ambiguous which question either
 * one is answering (task item 7).
 */

export type ArchitectureEntityType =
  | "workflow"
  | "workflow-step"
  | "integration"
  | "system"
  | "data-contract"
  | "process"
  | "requirement"
  | "approval"
  /** Added Phase 6 — the generated AI agent architecture itself. */
  | "ai-agent"
  | "ai-tool";

export interface ArchitectureReference {
  entityType: ArchitectureEntityType;
  entityId: string;
}
