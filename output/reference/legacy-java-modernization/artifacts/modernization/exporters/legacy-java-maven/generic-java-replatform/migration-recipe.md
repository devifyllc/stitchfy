# Migration Recipe

> These artifacts are proposed modernization changes generated from the currently known modernization architecture and repository evidence. They have not been applied to the source repository and have not been proven correct by compilation, testing, deployment, or runtime validation.

## Scope

System: `SYS-001`, candidate: `CANDIDATE-001`.

## Current State

- Runtime: IBM WebSphere
- Frameworks: Spring Framework, Hibernate, Servlet API (javax), JPA (javax)
- Packaging: war

## Target State

- Runtime: Apache Tomcat
- Frameworks: Spring Framework, Hibernate, Servlet API (javax), JPA (javax)
- Packaging: war
- Frameworks not explicitly requiring change are assumed to carry forward pending compatibility review.
- Target runtime "Apache Tomcat" version is not specified in the modernization architecture.

## Strategy

**replatform** (Phase 8's own architecture decision — never re-derived by this export).

## Export Readiness

**needs-review**

- _(warning)_ Target runtime "Apache Tomcat" is explicit, but no target version is specified — version-dependent transformations will remain unresolved.
- _(warning)_ Dependency "com.example:internal-fixture-lib" has a locally-unresolvable version — preserved as unresolved, not exported as a concrete proposal.

## Preservation Requirements

- `PRESERVE-001`
- `PRESERVE-002`
- `PRESERVE-003`

## Proposed Migration Steps

### STEP-001 — runtime _(derived)_

Review runtime configuration and dependencies for compatibility with the target runtime (IBM WebSphere → Apache Tomcat).

### STEP-002 — configuration _(derived)_

Review runtime-specific configuration for removal or replacement under the target runtime.

### STEP-003 — dependency _(requires-review)_

Review direct dependencies for target-runtime compatibility; no dependency versions have been changed automatically.

### STEP-004 — source _(requires-review)_

Review Servlet API usage for target-runtime and namespace compatibility.

### STEP-005 — validation _(derived)_

Validate preserved business behavior, integration contracts, and data technology after migration.

Prerequisites: STEP-001, STEP-002, STEP-003, STEP-004

### STEP-006 — manual-review _(requires-review)_

Complete the manual review items identified for this migration before proceeding.

## Build Changes

See `dependency-change-plan.md` and `configuration-change-plan.md` for details.

## Dependency Changes

See `dependency-change-plan.md`.

## Configuration Changes

See `configuration-change-plan.md`.

## Source Review Areas

See `source-review.md`.

## Validation Requirements

- `VALIDATE-001`
- `VALIDATE-002`
- `VALIDATE-003`
- `VALIDATE-004`

## Information Gaps

- `MODGAP-001`
- `MODGAP-002`
- `MODGAP-003`
- `MODGAP-004`
- `MODGAP-005`
- `MODGAP-006`

## Evidence

10 evidence reference(s)

## Important Limitations

These artifacts are proposed modernization changes generated from the currently known modernization architecture and repository evidence. They have not been applied to the source repository and have not been proven correct by compilation, testing, deployment, or runtime validation.
