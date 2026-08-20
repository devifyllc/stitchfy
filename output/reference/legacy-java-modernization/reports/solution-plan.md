# Solution Plan

_Generated: 2026-08-20T11:55:57.087Z_

## Business Context

- **Business:** Order Portal Modernization (Retail software)
- Goals: 1
- Actors: 2
- Processes: 0
- Requirements: 2
- Systems: 3
- Information gaps: 5 (0 blocking)

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

### integrations

- **Status:** recommended
- **Confidence:** high
- **Method:** structured

**Why:**
- Discovery lists an explicit integration need: "The Order Portal sends order requests to the Integration Gateway.".
- Discovery lists an explicit integration need: "The Order Portal reads and writes order records in the Order Database.".
- Desired outcome "The Order Portal runs on a supported, maintainable application-server platform" names a discovered system (Order Portal).

**Processes involved:** none
**Requirements involved:** none
**Systems involved:** Order Portal (SYS-001)

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
- **Confidence:** medium
- **Method:** structured

**Why:**
- Integration need "The Order Portal sends order requests to the Integration Gateway." is likely to produce an external-boundary operation worth observing.
- Integration need "The Order Portal reads and writes order records in the Order Database." is likely to produce an external-boundary operation worth observing.

**Processes involved:** none
**Requirements involved:** none
**Systems involved:** none

### modernization

- **Status:** recommended
- **Confidence:** high
- **Method:** structured

**Why:**
- Modernization need "MODNEED-001" identifies 1 system(s) with 5 stated outcome(s).
- Requirement "Support: Existing order operations continue without disruption during modernization" describes an explicit modernization/migration concern.
- System "SYS-001" is explicitly classified "legacy" — a supporting signal only; it does not by itself select a migration strategy.

**Processes involved:** none
**Requirements involved:** Support: Existing order operations continue without disruption during modernization (REQ-002)
**Systems involved:** Order Portal (SYS-001)

## Other Capability Assessments

| Capability | Status | Confidence | Method |
|---|---|---|---|
| workflow-automation | not-recommended | high | structured |
| ai-agents | not-recommended | high | structured |
| cloud | not-recommended | high | structured |

## Unresolved Information

None.

## Traceability Summary

- 2 link(s) total
  - derived-from: 2

_Full detail: `output/context/business-context.json`, `output/blueprints/solution-blueprint.v1.json`._
