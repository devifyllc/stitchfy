/**
 * Generated from IntegrationDefinition "INT-001" (generic-rest-typescript exporter).
 * See README.md for what is resolved and what still requires implementation.
 */

/**
 * From IntegrationDefinition dataContract "Request" (request). Field names below are
 * derived from the source's free-text field descriptions, not verified against the target
 * API's real wire format — confirm actual field names and casing before use.
 */
export interface TheOrderProcessorValidatesTheOrderAndForwardsItToTheFulfillmentApiRequest {
  /** From: "orderId" */
  orderId: string;
  /** From: "customerId" */
  customerId: string;
  /** From: "amount" */
  amount: number;
  /** From: "items (array, required)" */
  itemsArrayRequired?: unknown;
}

/**
 * From IntegrationDefinition dataContract "Response" (response). Field names below are
 * derived from the source's free-text field descriptions, not verified against the target
 * API's real wire format — confirm actual field names and casing before use.
 */
export interface TheOrderProcessorValidatesTheOrderAndForwardsItToTheFulfillmentApiResponse {
  /** From: "fulfillmentId" */
  fulfillmentId: string;
  /** From: "status" */
  status: string;
}
