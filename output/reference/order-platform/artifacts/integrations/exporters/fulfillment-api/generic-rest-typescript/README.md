# Generated Integration Client

> This output is implementation scaffolding generated from the currently known IntegrationDefinition. It does not establish that the integration is production-ready, secure, authenticated, deployed, or operational.

## Source Integration

- **The Order Processor submits orders to the Fulfillment API.** (`INT-001`, version 1.0)
- Purpose: The Order Processor submits orders to the Fulfillment API.

## Export Target

`generic-rest-typescript` (exporter version 1.0.0)

## Readiness

Status: **ready**

- _(info)_ 1 data contract field(s) have unresolved requiredness; represented as optional per the documented convention.

## Explicitly Known

- POST /v1/orders — REST over HTTPS
- Protocol: https
- Authentication mechanism: api-key

## Unresolved Information

- 1 data contract field(s) have unresolved requiredness; represented as optional per the documented convention.

## Authentication

- Mechanism: api-key
- Placement: header ("X-API-Key")
- No credential values are included anywhere in this bundle.

## Security Requirements

- **SECREQ-001**: Credentials for "The Order Processor submits orders to the Fulfillment API." (mechanism: api-key) must not be embedded directly in generated application code or static configuration committed to source control.
- **SECREQ-002**: Interaction with the system behind "The Order Processor submits orders to the Fulfillment API." crosses a trust boundary; requests and responses should be validated and protection requirements confirmed before implementation.

Risks:
- **RISK-001**: Credential material for "The Order Processor submits orders to the Fulfillment API." requires protection; improper handling could expose access to the target system.

## Data Contracts

- **Response** (response): fulfillmentId, status
- **Request** (request): orderId, customerId, amount, items (array, required)

An OpenAPI document for this integration already exists: `artifacts/integrations/the-order-processor-submits-orders-to-the-fulfillment-api.openapi.json`.

## Generated Files

- `client.ts`
- `types.ts`
- `config.ts`

## Implementation Required

- A real `HttpTransport` implementation (client.ts declares the interface only).
- Applying the authentication strategy to outgoing requests.

## Traceability

Related workflows: WF-001
Evidence references: 1
