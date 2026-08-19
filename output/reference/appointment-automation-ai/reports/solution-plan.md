# Solution Plan

_Generated: 2026-08-19T21:51:02.428Z_

## Business Context

- **Business:** Riverside Wellness Studio (Service business (appointments))
- Goals: 3
- Actors: 4
- Processes: 1
- Requirements: 4
- Systems: 2
- Information gaps: 1 (0 blocking)

## Recommended Capabilities

### website

- **Status:** recommended
- **Confidence:** low
- **Method:** legacy-keyword

**Why:**
- Website matched its legacy keyword heuristic against BusinessContext. Not yet migrated to structured assessment — see docs/architecture/ROADMAP.md.

**Processes involved:** none
**Requirements involved:** none
**Systems involved:** none

### workflow-automation

- **Status:** recommended
- **Confidence:** high
- **Method:** structured

**Why:**
- Process "Appointment Booking" already lists 4 automation candidate(s): Online appointment requests, Calendar synchronization, Automated confirmations and reminders, An AI assistant that answers routine questions and checks availability.
- Process "Appointment Booking" spans 2 systems — a common automation/integration trigger.
- Process "Appointment Booking" involves 2 actors — a hand-off between people.
- Requirement "Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation." is typed "operational".
- Requirement "Customer personal information must not appear in operational logs." is typed "operational".
- Requirement "Operations must be notified if automated confirmation or reminder delivery fails." is typed "automation".

**Processes involved:** Appointment Booking (PROC-001)
**Requirements involved:** Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation. (REQ-001), Customer personal information must not appear in operational logs. (REQ-002), Operations must be notified if automated confirmation or reminder delivery fails. (REQ-003)
**Systems involved:** Google Calendar (SYS-001), WhatsApp (SYS-002)

**Automation candidates:**
- Online appointment requests (from process: Appointment Booking)
- Calendar synchronization (from process: Appointment Booking)
- Automated confirmations and reminders (from process: Appointment Booking)
- An AI assistant that answers routine questions and checks availability (from process: Appointment Booking)

**Human approval considerations:**
- Trigger: "Every conflicting request is reviewed and approved by a front-desk employee before confirmation"
  Approver: Front-desk employee — Desired outcome "Every conflicting request is reviewed and approved by a front-desk employee before confirmation" explicitly requires human oversight — preserved rather than automated away.
- Trigger: "Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation."
  Approver: Front-desk employee — Requirement "Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation." explicitly requires human oversight — preserved rather than automated away.

**Information gaps:** none

**Assumptions:**
- Architectural plan only — no external system (e.g. calendar, messaging, SaaS API) is actually integrated in this phase.
- Requirement↔process correlation beyond explicit shared ids is not attempted (no fuzzy matching) — see docs/architecture/ARCHITECTURE.md Phase 1.5.

### integrations

- **Status:** recommended
- **Confidence:** high
- **Method:** structured

**Why:**
- Discovery lists an explicit integration need: "The booking system checks and reserves availability in Google Calendar.".
- Process "Appointment Booking" spans 2 systems — a candidate system boundary.

**Processes involved:** Appointment Booking (PROC-001)
**Requirements involved:** none
**Systems involved:** Google Calendar (SYS-001), WhatsApp (SYS-002)

### ai-agents

- **Status:** recommended
- **Confidence:** high
- **Method:** structured

**Why:**
- AI Agent Need "AINEED-001" describes 7 explicit task(s): "Customers should be able to ask the assistant questions about services and studio policies.".
- Requirement "Workflow, integration, and AI assistant activity must remain operationally visible." is typed "ai".
- Desired outcome "Workflow, integration, and AI assistant activity are all observable in operation" uses explicit AI terminology.

**Processes involved:** none
**Requirements involved:** Workflow, integration, and AI assistant activity must remain operationally visible. (REQ-004)
**Systems involved:** none

### security-governance

- **Status:** recommended
- **Confidence:** high
- **Method:** structured

**Why:**
- Data entity "Customer name, phone number, and appointment history (personal customer information) collected during booking" is marked sensitive.
- Business rule "A conflicting appointment request must always be approved by a front-desk employee before confirmation" describes access, audit, retention, or approval behavior.

**Processes involved:** none
**Requirements involved:** none
**Systems involved:** none

### observability

- **Status:** recommended
- **Confidence:** medium
- **Method:** structured

**Why:**
- Business process "Appointment Booking" has 4 steps — likely to produce workflow operational visibility needs.
- Integration need "The booking system checks and reserves availability in Google Calendar." is likely to produce an external-boundary operation worth observing.
- AI Agent Need "AINEED-001" is likely to produce agent/tool operational visibility needs.

**Processes involved:** Appointment Booking (PROC-001)
**Requirements involved:** none
**Systems involved:** none

### cloud

- **Status:** needs-review
- **Confidence:** low
- **Method:** structured

**Why:**
- AI Agent Need "AINEED-001" implies solution-owned orchestration logic that requires a runtime, even though where it runs is not yet known.

**Processes involved:** none
**Requirements involved:** none
**Systems involved:** none

## Other Capability Assessments

| Capability | Status | Confidence | Method |
|---|---|---|---|
| modernization | not-recommended | high | structured |

## Unresolved Information

None.

## Traceability Summary

- 9 link(s) total
  - performed-by: 2
  - uses-system: 2
  - affects: 3
  - constrained-by: 2

_Full detail: `output/context/business-context.json`, `output/blueprints/solution-blueprint.v1.json`._
