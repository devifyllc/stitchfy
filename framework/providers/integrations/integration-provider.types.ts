/**
 * Vendor-neutral integration provider contract for the Integrations
 * capability (REST APIs, webhooks, SaaS connectors).
 *
 * This is the *runtime* seam (execute/connect) — still unimplemented, no
 * concrete provider exists. For the *generation-time* seam (converting a
 * validated IntegrationDefinition into implementation scaffolding, no
 * network calls), see framework/capabilities/integrations/exporters/README.md
 * (Phase 5.5A) — deliberately a separate, non-overlapping contract.
 */

import type { Provider } from "../../core/contracts/provider.js";

export type IntegrationHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface IntegrationRequest {
  method: IntegrationHttpMethod;
  path: string;
  body?: unknown;
}

export interface IntegrationResponse {
  status: number;
  body: unknown;
}

export interface IntegrationProvider extends Provider {
  call(request: IntegrationRequest): Promise<IntegrationResponse>;
}
