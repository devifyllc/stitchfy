# Legacy Modernization Architecture

_Status: **needs-review** (6 unresolved information gap(s))_

> `implemented: true` on this capability means Stitchfy generated and validated a legacy-modernization assessment and migration-strategy architecture from currently known evidence. It does not mean application code was analyzed, code was migrated, dependencies were upgraded, databases were converted, tests passed, production behavior was preserved, a target system was deployed, or migration risk was eliminated.

## Scope

1 system(s) in scope, 1 migration candidate(s) assessed.

## Systems in Scope

- **SYS-001** _(candidate, lifecycle: unknown)_ — Internal legacy order-management application.

## Modernization Drivers

- platform-lifecycle
- maintainability
- unknown

## System Profiles

- **MODPROFILE-001** (system `SYS-001`) — technical debt: 0, dependencies: 2, preservation: 3

## Current-State Dependencies

- `SYS-001` → `SYS-002` _(api, unknown)_ — The Order Portal sends order requests to the Integration Gateway.
- `SYS-001` → `SYS-003` _(database, unknown)_ — The Order Portal reads and writes order records in the Order Database.

## Technical Debt

None identified.

## Preservation Requirements

- **PRESERVE-001** _(business-behavior)_ — Existing order-management business behavior must remain unchanged.
- **PRESERVE-002** _(integration-contract)_ — Existing integration behavior with the Integration Gateway must remain compatible.
- **PRESERVE-003** _(integration-contract)_ — The Order Database technology must not change during this modernization phase.

## Modernization Seams

- **SEAM-001** _(integration-boundary)_ — The "The Order Portal sends order requests to the Integration Gateway." integration is a real, known boundary that may support incremental modernization of the systems it connects.
- **SEAM-002** _(integration-boundary)_ — The "The Order Portal reads and writes order records in the Order Database." integration is a real, known boundary that may support incremental modernization of the systems it connects.

## Migration Candidates

- **CANDIDATE-001** (system `SYS-001`) — status: candidate, approach: coexistence
  - strategy: replatform (explicit) — The business wants to modernize the Order Portal. The application must move from IBM WebSphere to Apache Tomcat while preserving application behavior. The migration must allow the current and modernized application versions to coexist during validation. No cloud provider has been selected. No microservices decomposition has been approved.

## Strategy Options

- `CANDIDATE-001`: **replatform** _(explicit)_

## Target-State Requirements

- **TARGETSTATE-001** _(runtime, explicit)_ — Target runtime: Apache Tomcat.
- **TARGETSTATE-002** _(security, explicit)_ — Security requirement must remain enforced after modernization: Interaction with the system behind "The Order Portal sends order requests to the Integration Gateway." crosses a trust boundary; requests and responses should be validated and protection requirements confirmed before implementation.
- **TARGETSTATE-003** _(security, explicit)_ — Security requirement must remain enforced after modernization: Interaction with the system behind "The Order Portal reads and writes order records in the Order Database." crosses a trust boundary; requests and responses should be validated and protection requirements confirmed before implementation.

## Migration Risks

- **MODRISK-001** _(modernization, likelihood: unknown, impact: unknown)_ — Running current and modernized versions of system "SYS-001" concurrently introduces state/data-consistency risk during the coexistence window.

## Validation Requirements

- **VALIDATE-001** _(behavior)_ — Validate that: Existing order-management business behavior must remain unchanged.
- **VALIDATE-002** _(integration)_ — Validate that: Existing integration behavior with the Integration Gateway must remain compatible.
- **VALIDATE-003** _(integration)_ — Validate that: The Order Database technology must not change during this modernization phase.

## Information Gaps

- **Process dependency**: Which business processes depend on system "Order Portal"?
- **System ownership**: Who owns system "Order Portal"?
- **Data migration**: Does persistent data for system "Order Portal" need to migrate?
- **Rollback requirement**: What rollback requirement applies to system "Order Portal"'s migration?
- **Validation criteria**: What validation criteria define behavioral equivalence for system "Order Portal" after migration?
- **Data ownership**: Which system is authoritative for the data in "Order Database"?

## Traceability

Profiles: 1, Dependencies: 2, Candidates: 1, Evidence references: 1
