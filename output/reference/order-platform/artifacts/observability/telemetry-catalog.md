# Telemetry Catalog

> `implemented: true` on this capability means Stitchfy generated and validated a vendor-neutral observability and operational architecture for the currently known solution. It does not mean telemetry is being collected, logging exists, dashboards are deployed, alerts are active, tracing is installed, an SLO is being met, or production operations are ready.

## SIGNAL-001 — Order Submission Workflow started

Type:
event

Source:
workflow/WF-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- workflowId
- outcome

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-002 — Order Submission Workflow completed

Type:
event

Source:
workflow/WF-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- workflowId
- outcome

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-003 — Order Submission Workflow failed

Type:
event

Source:
workflow/WF-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- workflowId
- outcome

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-004 — The Order Processor validates the order and forwards it to the Fulfillment API attempted

Type:
event

Source:
integration/INT-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- integrationId
- operationId
- outcome

Prohibited data:
- credential/API-key material

Evidence:
1 reference(s)

## SIGNAL-005 — The Order Processor validates the order and forwards it to the Fulfillment API succeeded

Type:
event

Source:
integration/INT-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- integrationId
- operationId
- outcome
- httpMethod
- httpPath

Prohibited data:
- credential/API-key material

Evidence:
1 reference(s)

## SIGNAL-006 — The Order Processor validates the order and forwards it to the Fulfillment API failed

Type:
event

Source:
integration/INT-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- integrationId
- operationId
- outcome
- httpMethod
- httpPath

Prohibited data:
- credential/API-key material

Evidence:
1 reference(s)
