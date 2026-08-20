# Migration Strategy

> `implemented: true` on this capability means Stitchfy generated and validated a legacy-modernization assessment and migration-strategy architecture from currently known evidence. It does not mean application code was analyzed, code was migrated, dependencies were upgraded, databases were converted, tests passed, production behavior was preserved, a target system was deployed, or migration risk was eliminated.

## Candidate Systems

- `SYS-001` — candidate

## Explicit Strategies

- `SYS-001`: **replatform** — The business wants to modernize the Order Portal. The application must move from IBM WebSphere to Apache Tomcat while preserving application behavior. The migration must allow the current and modernized application versions to coexist during validation. No cloud provider has been selected. No microservices decomposition has been approved.

## Candidate Strategies

None identified.

## Retain Decisions

None.

## Preservation Obligations

- `SYS-001` (business-behavior): Existing order-management business behavior must remain unchanged.
- `SYS-001` (integration-contract): Existing integration behavior with the Integration Gateway must remain compatible.
- `SYS-001` (integration-contract): The Order Database technology must not change during this modernization phase.

## Coexistence Requirements

- `SYS-001` requires current/modernized versions to coexist during validation.

## Constraints

- **MIGCONSTRAINT-001** _(target-platform)_ — Database technology must remain unchanged.
- **MIGCONSTRAINT-002** _(compatibility)_ — Existing integration behavior must remain compatible.
- **MIGCONSTRAINT-003** _(release-window)_ — Production cutover approach has not been selected.

## Risks

- Running current and modernized versions of system "SYS-001" concurrently introduces state/data-consistency risk during the coexistence window.

## Open Strategy Decisions

None.
