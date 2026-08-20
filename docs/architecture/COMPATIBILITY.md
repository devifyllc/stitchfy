# Compatibility and Deprecation Policy (RC1)

Companion to `docs/architecture/PUBLIC_CONTRACTS.md` — that document says *what* is classified at *what* level; this document says what each level *promises* and how it changes over time.

## Version concepts (three distinct things)

1. **Package/framework version** (`package.json`'s `version`, exposed as `STITCHFY_VERSION` in `framework/core/version.ts`) — changes on every release, follows ordinary semver for the framework/CLI/tooling as a whole.
2. **`SolutionBlueprint` / `WebsiteBlueprint` schema version** (`SOLUTION_BLUEPRINT_SCHEMA_VERSION` / `WEBSITE_BLUEPRINT_SCHEMA_VERSION`, both `"1.0"` today) — changes only when the *serialized shape* of that blueprint changes incompatibly. Both constants live in `framework/core/version.ts` next to `STITCHFY_VERSION`, but are independent values.
3. **Export-manifest schema versions** (`IntegrationExportManifest.schemaVersion`, `ModernizationExportManifest.schemaVersion`, both `"1.0"` today) — independent again, scoped to their own exporter's manifest shape.

**These are never coupled.** A framework patch release (e.g. `2.1.0` → `2.1.1`) never requires a blueprint schema-version bump. A future framework major release (e.g. `2.x` → `3.0`, for CLI or tooling reasons) still does not, by itself, imply `SolutionBlueprint` schema `1.0` → `2.0` — the two only move together if the same underlying change happens to require both, which is not assumed.

## Deprecation policy

A field marked `@deprecated`:

1. Remains parseable (accepted by validation) for the entire current major schema version.
2. Is never populated by any current generator — a deprecated field only appears in output that predates its deprecation, or in a hand-constructed test fixture.
3. Documents its replacement in the same doc comment.
4. May only be removed in a breaking (major) schema version.

**Applied concretely**: `SolutionBlueprint.deployment?: DeploymentInfo` (`framework/schemas/solution-blueprint/solution-blueprint.types.ts`) is deprecated in favor of `SolutionBlueprint.architecture?: CloudArchitectureSection` (the real, evidence-backed Cloud Architecture output, Phase 7B). `deployment` already has zero producers anywhere in the codebase — this was true before RC1 and is proven by `tests/contracts/solution-blueprint-v1.contract.test.ts`, which asserts that none of the three canonical reference runs populate it, and that a synthetic historical document containing it still validates against `SolutionBlueprintSchema`. `deployment` is not removed in RC1 — removal is scoped to a future breaking schema version (see ADR-002).

Do not invent additional deprecated fields where none exist — this policy currently applies to exactly one field.

## Serialization compatibility policy — `SolutionBlueprint` v1

**Allowed without a schema-version bump:**
- Adding a new optional field to any existing section.
- Adding new optional artifact metadata.
- Adding an entirely new, optional capability section (the pattern every capability from Phase 3 onward already follows).

**Requires careful compatibility review before shipping** (not a hard block, but must be a deliberate decision, not an incidental one):
- Adding a new enum/union value to an existing closed type (see "Enum evolution policy" below).
- Tightening Zod validation on an existing field (e.g. adding `.min(1)` to a previously-unconstrained array) — Stitchfy already does this in exactly two places today, `SecurityRequirementSchema.evidenceRefs` and `TelemetryRequirementSchema.evidenceRefs` (both `.min(1)`, found during RC1's Type/Zod parity audit): the TypeScript type cannot express "non-empty array," so Zod enforces a stricter runtime constraint than the type system does. This was a deliberate design choice for those two evidence-backed fields, not accidental drift, but it is exactly the category of change that needs conscious review before being applied elsewhere.
- Changing the semantic meaning of a field without changing its shape.

**Requires a new, breaking schema version (never done silently):**
- Removing a field.
- Renaming a serialized field.
- Changing a field from optional to required (or vice versa) in an incompatible way.
- Changing an existing field's type incompatibly.
- Changing the meaning of an existing enum value.

## Enum evolution policy

Many domains use closed unions (`ModernizationStrategy`, `AICapabilityNeed`, `DeploymentNeedCategory`, exporter `status` unions, ...). **Adding a new value to one of these is source-compatible for Stitchfy's own producers, but can silently break a downstream consumer written as an exhaustive `switch`/mapping over the old value set.** This is a real, general risk inherent to closed-union evolution — it is documented here as guidance, not resolved by redesigning any enum. Treat adding an enum value as a compatibility-relevant change requiring the same review as anything else in the "requires careful compatibility review" tier above.

## CLI compatibility policy

Within the current major CLI generation (documented in `PUBLIC_CONTRACTS.md`):

- Existing flag names do not silently change.
- Existing default behavior (default `--input`/`--output` paths, "no export without explicit intent," etc.) is preserved.
- New optional flags are additive only.
- A removed or renamed flag requires explicit migration documentation in this file and in `docs/releases/`.

This guarantee covers only the documented flags. Undocumented or purely internal script behavior carries no compatibility promise.

## Output forward-compatibility guidance (for consumers)

- Key off `schemaVersion`, not file size or field count.
- Ignore optional fields you don't recognize — a future Stitchfy version may add more.
- Never assume the full set of capability sections that could appear on a `SolutionBlueprint` — a section is only present when its capability was selected and executed.
- Never rely on volatile generated timestamps or execution/wrapper IDs (see `PUBLIC_CONTRACTS.md` "ID semantics") for identity or comparison.

This is guidance, not a guarantee that every conceivable future shape stays backward compatible — see the compatibility tiers above for what actually is guaranteed.

## Markdown vs. JSON

JSON architecture artifacts (`*.json` under `output/artifacts/`, `output/blueprints/`, `output/context/`) carry the real, documented serialization contract. Human-readable Markdown reports (`solution-plan.md`, `*.workflow.md`, `migration-recipe.md`, and similar) are **non-stable presentation** — wording, section order, and formatting may change freely between releases. No script anywhere in this codebase currently parses a generated Markdown report to extract data; machine consumers should always prefer the JSON artifact. If that ever changes for a specific report, this document will be updated to say so explicitly.

## What this document does not claim

Stitchfy has hundreds of internal TypeScript types. This document does not claim "all TypeScript interfaces are stable" — only the contracts explicitly classified CANDIDATE (or, in a future release, STABLE) in `PUBLIC_CONTRACTS.md` carry any compatibility guarantee at all.
