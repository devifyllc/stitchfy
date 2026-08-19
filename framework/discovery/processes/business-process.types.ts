/**
 * Evolved in Phase 1 from a flat {actors: string[], painPoints: string[]}
 * skeleton into a structured domain representation — not BPMN, just enough
 * to drive later capability decisions and traceability. actorIds/systemIds/
 * painPointIds/businessRuleIds reference other discovery entities by id
 * (see processes.extractor.ts for how those references are resolved);
 * trigger/steps/inputs/outputs/manualSteps/automationCandidates are
 * process-intrinsic and have no entity of their own.
 */

import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export interface BusinessProcess {
  id: string;
  name: string;
  description: string;
  actorIds: string[];
  trigger: string;
  steps: string[];
  systemIds: string[];
  inputs: string[];
  outputs: string[];
  painPointIds: string[];
  businessRuleIds: string[];
  manualSteps: string[];
  automationCandidates: string[];
  metadata: DiscoveryMetadata;
}
