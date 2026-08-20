# ADR-002: Freeze `SolutionBlueprint` v1 for RC1

**Status:** Accepted

## Context

`SolutionBlueprint` (`framework/schemas/solution-blueprint/`) grew additively across Phases 1 through 9 — every capability contributed an optional section, and nothing was ever restructured or renamed along the way. RC1's Type/Zod parity audit (covering all 8 major domains, including `SolutionBlueprint` itself) found zero genuine field-presence, optionality, or enum mismatches between the TypeScript interfaces and their Zod schemas. The shape is, in practice, already internally consistent. The only known legacy artifact is `SolutionBlueprint.deployment?: DeploymentInfo`, which already carries `@deprecated` and already has zero producers.

## Decision

- `SolutionBlueprint.schemaVersion` (via `ProjectMeta.schemaVersion`, now sourced from `SOLUTION_BLUEPRINT_SCHEMA_VERSION` in `framework/core/version.ts`) **stays `"1.0"` for RC1.** No v2 is introduced for cleanup purposes.
- Future evolution of `SolutionBlueprint` within schema v1 is additive-only, governed by the compatibility tiers in `docs/architecture/COMPATIBILITY.md`.
- `deployment` remains present, accepted by validation, and deprecated — it is not removed and no new generator populates it. `architecture` (`CloudArchitectureSection`) remains the one real source of truth for deployment/cloud architecture.
- Any genuinely breaking cleanup (field removal, rename, incompatible type change) is deferred to a hypothetical future schema v2, decided separately and explicitly — not bundled into RC1.

## Consequences

- Every `solution-blueprint.v1.json` produced by RC1 and every prior Phase 1-9 run remains schema-compatible with each other.
- `tests/contracts/solution-blueprint-v1.contract.test.ts` locks this in: the three canonical reference blueprints validate, a synthetic legacy document containing `deployment` still validates, and no real run populates `deployment`.
- If a genuinely breaking defect is later discovered that makes `"1.0"` factually impossible to keep serializing correctly, this ADR's freeze decision would need to be revisited explicitly — that has not happened as of RC1.
