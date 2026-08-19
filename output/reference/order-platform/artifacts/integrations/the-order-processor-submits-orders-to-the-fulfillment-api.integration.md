# Integration: The Order Processor submits orders to the Fulfillment API.

_Status: **needs-review** (source system unknown)_

> `implemented: true` on this capability means Stitchfy generated and validated this vendor-neutral integration specification — it does not mean Stitchfy connected to or exchanged data with the external system.

## Purpose

The Order Processor submits orders to the Fulfillment API.

## Source System

_Unknown — not stated by Discovery._

## Target System

Fulfillment API (SYS-001)

## Related Workflow

- WF-001

```mermaid
flowchart LR
    WF_001["WF-001"]
    SRC["Unknown Source"]
    TGT["Fulfillment API"]
    WF_001 --> SRC
    SRC -->|"The Order Processor submits orders to the Fulfillment API."| TGT
```

## Operations

- **The Order Processor validates the order and forwards it to the Fulfillment API** _(unknown)_ — The Order Processor validates the order and forwards it to the Fulfillment API

## Interaction Pattern

- Direction: unknown
- Pattern: request-response
- Protocol: https
- REST: POST /v1/orders

## Data Exchanged

- **Response** (response, sensitivity: unknown): fulfillmentId, status
- **Request** (request, sensitivity: unknown): orderId, customerId, amount, items (array, required)

## Authentication

Mechanism: api-key

## Reliability

- Retry required: unknown
- Idempotency required: unknown
- Timeout required: unknown
- Ordering required: true

## Error Handling

No explicit failure-handling policy discovered.

## Security Considerations

- Encryption in transit: true
- Contains sensitive data: unknown
- Secrets required: true
- Audit required: unknown

## Information Gaps

- **Integration source system**: What system will initiate: The Order Processor submits orders to the Fulfillment API.?
- **Integration failure handling**: What should happen if Fulfillment API is unavailable during "The Order Processor submits orders to the Fulfillment API."?

## Traceability

Related processes: none
Related requirements: API keys and customer order payloads must not appear in operational logs. (REQ-005)
Evidence: 1 reference(s)
