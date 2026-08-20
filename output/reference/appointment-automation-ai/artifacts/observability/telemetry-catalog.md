# Telemetry Catalog

> `implemented: true` on this capability means Stitchfy generated and validated a vendor-neutral observability and operational architecture for the currently known solution. It does not mean telemetry is being collected, logging exists, dashboards are deployed, alerts are active, tracing is installed, an SLO is being met, or production operations are ready.

## SIGNAL-001 — Appointment Booking Workflow started

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

## SIGNAL-002 — Appointment Booking Workflow completed

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

## SIGNAL-003 — Appointment Booking Workflow failed

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

## SIGNAL-004 — Decision evaluated: Every conflicting request is reviewed and approved by a front-desk employee before confirmation

Type:
event

Source:
workflow-step/STEP-005

Provenance:
derived

Sensitivity:
internal

Required attributes:
- workflowId
- stepId
- outcome

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-005 — Decision evaluated: Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation.

Type:
event

Source:
workflow-step/STEP-008

Provenance:
derived

Sensitivity:
internal

Required attributes:
- workflowId
- stepId
- outcome

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-006 — Approval requested: Every conflicting request is reviewed and approved by a front-desk employee before confirmation

Type:
event

Source:
workflow-step/STEP-007

Provenance:
derived

Sensitivity:
internal

Required attributes:
- workflowId
- stepId

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-007 — Approval completed: Every conflicting request is reviewed and approved by a front-desk employee before confirmation

Type:
event

Source:
workflow-step/STEP-007

Provenance:
derived

Sensitivity:
internal

Required attributes:
- workflowId
- stepId
- outcome

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-008 — Approval requested: Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation.

Type:
event

Source:
workflow-step/STEP-010

Provenance:
derived

Sensitivity:
internal

Required attributes:
- workflowId
- stepId

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-009 — Approval completed: Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation.

Type:
event

Source:
workflow-step/STEP-010

Provenance:
derived

Sensitivity:
internal

Required attributes:
- workflowId
- stepId
- outcome

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-010 — Notification attempted: Confirmed appointments are recorded and a reminder is sent before the appointment

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

## SIGNAL-011 — The system checks Google Calendar for availability attempted

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

## SIGNAL-012 — The system checks Google Calendar for availability succeeded

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

## SIGNAL-013 — The system checks Google Calendar for availability failed

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

## SIGNAL-014 — Riverside Wellness Studio Assistant interaction started

Type:
event

Source:
ai-agent/AIAGENT-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- agentId
- outcome

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-015 — Riverside Wellness Studio Assistant interaction completed

Type:
event

Source:
ai-agent/AIAGENT-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- agentId
- outcome

Prohibited data:
- none identified

Evidence:
1 reference(s)

## SIGNAL-016 — Tool invocation: The system checks Google Calendar for availability requested

Type:
event

Source:
ai-tool/AITOOL-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- agentId
- toolId
- outcome

Prohibited data:
- none identified

Evidence:
2 reference(s)

## SIGNAL-017 — Tool invocation: The system checks Google Calendar for availability completed

Type:
event

Source:
ai-tool/AITOOL-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- agentId
- toolId
- outcome

Prohibited data:
- none identified

Evidence:
2 reference(s)

## SIGNAL-018 — Tool invocation: The system checks Google Calendar for availability failed

Type:
event

Source:
ai-tool/AITOOL-001

Provenance:
derived

Sensitivity:
internal

Required attributes:
- agentId
- toolId
- outcome

Prohibited data:
- none identified

Evidence:
2 reference(s)
