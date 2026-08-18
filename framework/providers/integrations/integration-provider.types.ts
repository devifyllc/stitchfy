/**
 * Vendor-neutral integration provider contract for the Integrations
 * capability (REST APIs, webhooks, SaaS connectors).
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
