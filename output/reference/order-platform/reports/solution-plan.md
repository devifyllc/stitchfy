# Solution Plan

_Generated: 2026-08-19T21:51:02.944Z_

## Business Context

- **Business:** Northwind Order Platform (Retail software)
- Goals: 3
- Actors: 3
- Processes: 1
- Requirements: 6
- Systems: 1
- Information gaps: 4 (0 blocking)

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

- **Status:** needs-review
- **Confidence:** medium
- **Method:** structured

**Why:**
- Process "Order Submission" involves 2 actors — a hand-off between people.
- Requirement "API keys and customer order payloads must not appear in operational logs." is typed "integration".

**Processes involved:** Order Submission (PROC-001)
**Requirements involved:** API keys and customer order payloads must not appear in operational logs. (REQ-005)
**Systems involved:** none

**Automation candidates:**
- none

**Human approval considerations:**
- none identified

**Information gaps:** Business rules (GAP-003)

**Assumptions:**
- Architectural plan only — no external system (e.g. calendar, messaging, SaaS API) is actually integrated in this phase.
- Requirement↔process correlation beyond explicit shared ids is not attempted (no fuzzy matching) — see docs/architecture/ARCHITECTURE.md Phase 1.5.

### integrations

- **Status:** recommended
- **Confidence:** high
- **Method:** structured

**Why:**
- Discovery lists an explicit integration need: "The Order Processor submits orders to the Fulfillment API.".
- Requirement "API keys and customer order payloads must not appear in operational logs." is typed "integration".

**Processes involved:** none
**Requirements involved:** API keys and customer order payloads must not appear in operational logs. (REQ-005)
**Systems involved:** none

### security-governance

- **Status:** recommended
- **Confidence:** medium
- **Method:** structured

**Why:**
- Discovery flagged an unresolved gap relevant to security/governance: "Data".

**Processes involved:** none
**Requirements involved:** none
**Systems involved:** none

### observability

- **Status:** recommended
- **Confidence:** high
- **Method:** structured

**Why:**
- Requirement "Order-processing audit trails must be retained." describes an explicit operational concern.
- Business process "Order Submission" has 3 steps — likely to produce workflow operational visibility needs.
- Integration need "The Order Processor submits orders to the Fulfillment API." is likely to produce an external-boundary operation worth observing.

**Processes involved:** Order Submission (PROC-001)
**Requirements involved:** Order-processing audit trails must be retained. (REQ-006)
**Systems involved:** none

### cloud

- **Status:** recommended
- **Confidence:** medium
- **Method:** structured

**Why:**
- Deployment need "DEPLOY-001" (runtime): "The solution includes a solution-managed Order API that receives customer order requests.".
- Deployment need "DEPLOY-002" (network): "The Order API must be publicly reachable over HTTPS.".
- Deployment need "DEPLOY-003" (runtime): "The solution includes a solution-managed Order Processor that processes accepted orders in the background.".
- Deployment need "DEPLOY-004" (network): "The Order Processor must not expose a public endpoint.".
- Deployment need "DEPLOY-005" (environment): "The business requires separate Test and Production environments.".
- Deployment need "DEPLOY-006" (persistence): "Order processing state must persist and survive application restarts.".
- Deployment need "DEPLOY-007" (scalability): "Production must support at least 100 concurrent order submissions.".
- Deployment need "DEPLOY-008" (resilience): "The solution must continue accepting new orders when the external Fulfillment API is temporarily unavailable.".
- Deployment need "DEPLOY-009" (hosting): "No cloud provider has been selected.".
- Deployment need "DEPLOY-010" (persistence): "No database technology has been selected.".

**Processes involved:** none
**Requirements involved:** none
**Systems involved:** none

## Other Capability Assessments

| Capability | Status | Confidence | Method |
|---|---|---|---|
| ai-agents | not-recommended | high | structured |
| modernization | not-recommended | high | structured |

## Unresolved Information

None.

## Traceability Summary

- 3 link(s) total
  - performed-by: 2
  - uses-system: 1

_Full detail: `output/context/business-context.json`, `output/blueprints/solution-blueprint.v1.json`._
