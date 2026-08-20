import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";

export interface IntegrationNeed {
  id: string;
  description: string;
  relatedSystemIds: string[];
  /**
   * Explicit "Label: Value" lines captured verbatim when the source
   * provides more than a one-line description (e.g. "Integration method:
   * REST over HTTPS", "Endpoint: POST /v1/orders") — see
   * integration-needs.extractor.ts. Undefined for a plain single-line
   * entry. Phase 4 (framework/capabilities/integrations/) does its own
   * deterministic regex extraction over these strings; nothing here is
   * inferred — only what's literally stated is captured.
   */
  details?: Record<string, string>;
  metadata: DiscoveryMetadata;
}
