/**
 * Generated from IntegrationDefinition "INT-001" (generic-rest-typescript exporter).
 * This is implementation scaffolding — Stitchfy does not execute this client.
 * See README.md for what is resolved and what still requires implementation.
 */

import type { FulfillmentApiClientConfig } from "./config.js";
import type { TheOrderProcessorValidatesTheOrderAndForwardsItToTheFulfillmentApiRequest, TheOrderProcessorValidatesTheOrderAndForwardsItToTheFulfillmentApiResponse } from "./types.js";

export interface HttpRequest<TBody = unknown> {
  method: string;
  path: string;
  body?: TBody;
  headers?: Record<string, string>;
}

export interface HttpResponse<TBody = unknown> {
  status: number;
  body: TBody;
}

export interface HttpTransport {
  request<TRequestBody, TResponseBody>(request: HttpRequest<TRequestBody>): Promise<HttpResponse<TResponseBody>>;
}

// Authentication mechanism: api-key. Placement: header ("X-API-Key").
export interface AuthenticationStrategy {
  apply(request: HttpRequest): HttpRequest;
}

export class FulfillmentApiClient {
  constructor(private readonly config: FulfillmentApiClientConfig) {}

  /**
   * Generated from REST POST /v1/orders.
   */
  async theOrderProcessorValidatesTheOrderAndForwardsItToTheFulfillmentApi(request: TheOrderProcessorValidatesTheOrderAndForwardsItToTheFulfillmentApiRequest): Promise<TheOrderProcessorValidatesTheOrderAndForwardsItToTheFulfillmentApiResponse> {
    // Generated from IntegrationDefinition. Authentication application may remain unresolved.
    throw new Error("Transport implementation not configured.");
  }

}
