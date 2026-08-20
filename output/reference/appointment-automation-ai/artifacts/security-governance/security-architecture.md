# Security Architecture

_Status: **needs-review** (3 unresolved information gap(s))_

> `implemented: true` on this capability means Stitchfy generated and validated a security/governance architecture for the currently known solution. It does not mean the resulting system is secure, compliant, certified, penetration-tested, or production-ready.

## Scope

1 trust boundary(ies), 4 security requirement(s), 1 data protection requirement(s), 2 risk(s) identified from the generated solution.

## Systems and Trust Boundaries

- **unknown source → Google Calendar (SYS-001)** — classification: third-party

## Identity and Authentication

No explicit identity requirements identified.

## Authorization

No explicit authorization requirements identified.

## Data Protection

- Classification: **confidential** — encryption in transit: unknown, encryption at rest: unknown

## Integration Security

- **INT-001 (INT-001)**
  - Credentials for "The booking system checks and reserves availability in Google Calendar." (mechanism: oauth2) must not be embedded directly in generated application code or static configuration committed to source control.
  - Interaction with the system behind "The booking system checks and reserves availability in Google Calendar." crosses a trust boundary; requests and responses should be validated and protection requirements confirmed before implementation.

## Secrets

- Credentials for "The booking system checks and reserves availability in Google Calendar." (mechanism: oauth2) must not be embedded directly in generated application code or static configuration committed to source control.

## Privacy Considerations

- Data associated with "The booking system checks and reserves availability in Google Calendar." may cross a third-party boundary while its classification remains unresolved; exposure could result in a privacy issue.

## Auditability

- Approval decisions for "Every conflicting request is reviewed and approved by a front-desk employee before confirmation" should be auditable.
- Approval decisions for "Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation." should be auditable.

## Human Oversight

- Every conflicting request is reviewed and approved by a front-desk employee before confirmation
- Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation.

## Open Security Questions

- **Notification channel**: What channel should be used for: "Confirmed appointments are recorded and a reminder is sent before the appointment"? _(already tracked upstream)_
- **Integration source system**: What system will initiate: The booking system checks and reserves availability in Google Calendar.? _(already tracked upstream)_
- **Integration failure handling**: What should happen if Google Calendar is unavailable during "The booking system checks and reserves availability in Google Calendar."? _(already tracked upstream)_
- **AI provider data handling**: May data handled by agent "Riverside Wellness Studio Assistant" be sent to an external AI model provider? No provider has been selected yet.

## Traceability

Security requirements: 4, Trust boundaries: 1, Risks: 2, Evidence references: 5
