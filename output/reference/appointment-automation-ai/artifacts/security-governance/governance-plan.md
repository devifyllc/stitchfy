# Governance Plan

_Status: **needs-review**_

> `implemented: true` on this capability means Stitchfy generated and validated a security/governance architecture for the currently known solution. It does not mean the resulting system is secure, compliant, certified, penetration-tested, or production-ready.

## Human Approval Controls

- Every conflicting request is reviewed and approved by a front-desk employee before confirmation — Appointment Booking Workflow (WF-001)
- Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation. — Appointment Booking Workflow (WF-001)

## Decision Controls

- The decision "Every conflicting request is reviewed and approved by a front-desk employee before confirmation" must remain deterministic and traceable to its source evidence.
- The decision "Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation." must remain deterministic and traceable to its source evidence.

## Audit Requirements

- Approval decisions for "Every conflicting request is reviewed and approved by a front-desk employee before confirmation" should be auditable.
- Approval decisions for "Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation." should be auditable.

## Privacy Considerations

- Customer or business data may cross a third-party boundary; privacy requirements should be reviewed.

## Compliance Considerations

None explicitly stated.

## Unresolved Governance Questions

- WFGAP-001
- INTGAP-001
- INTGAP-002

## Policies

- Appointments cannot overlap for the same employee
- A conflicting appointment request must always be approved by a front-desk employee before confirmation
