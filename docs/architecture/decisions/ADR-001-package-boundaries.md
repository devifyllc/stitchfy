# ADR-001: Core vs. Optional/Future Package Boundary

**Status:** Accepted

## Context

Stitchfy's architecture-generation pipeline (Discovery → Planning → Capabilities → Validation → Exporters/Codebase Analysis) is fully deterministic and offline: no network call, no credential, no vendor SDK, no cloud/model runtime exists anywhere in it. Two deferred tracks — runtime integration providers (Phase 5.5B) and an AI/model runtime (Phase 6.5) — plus two more (cloud/observability runtime providers, Phase 7C; reviewed source-transformation/patch generation, Phase 8.5C) would, if built, introduce exactly the opposite properties: credentials, network calls, external side effects, and (for 8.5C) source-repository writes. RC1 needs an explicit decision about which of these belong in "Stitchfy core" versus a separate package, evaluated before any of them are built — not decided implicitly by wherever the code happens to land.

## Decision

**Stitchfy core** (this repository, as it exists today) is scoped to:
- Deterministic Business Discovery and Solution Planning.
- Architecture generation for all eight capabilities (website, workflow-automation, integrations, ai-agents, security-governance, observability, cloud, modernization).
- Schema validation.
- Offline, read-only codebase analysis (`framework/analysis/codebase/`).
- Offline, deterministic exporters that produce files only, with no network call and no credential requirement — concretely, `generic-rest-typescript` and `generic-java-replatform` (see items 38-39 below).

**Optional / future packages** (not built in RC1, and not assumed to land in this repository even when eventually built) cover anything that:
- Calls a real external system (live `IntegrationProvider` implementations).
- Executes a model/LLM (AI runtime/model providers).
- Provisions cloud infrastructure (`CloudProvider` implementations).
- Configures an observability vendor.
- Handles credentials or performs OAuth/token lifecycle management.
- Opens a network client of any kind at runtime.
- Mutates or patches a real source repository (Phase 8.5C).

## Why the two exporters stay in core

`generic-rest-typescript` and `generic-java-replatform` are correctly core, not "optional," because they satisfy the same properties as the rest of core: deterministic, file-output-only, no credentials required to run, no network call made. They are qualitatively different from a runtime provider even though both live under an `exporters/` directory conceptually adjacent to where a provider might eventually live — see ADR-003 for why the *runtime* seam is a different boundary decision. This is documented current policy, not a permanent commitment: if a future exporter needed network access (e.g. to validate a live API schema), it would need re-evaluation against this same boundary.

## Consequences

- No monorepo/`packages/` restructuring happens in RC1 or is implied by this ADR — this is a decision about what *would* move to a separate package if/when the deferred tracks are built, not a physical repository change today.
- Anyone building Phase 5.5B/6.5/7C/8.5C should treat "does this belong in core" as already answered by this ADR: no, by default, unless the specific implementation genuinely stays side-effect-light and offline (unlikely for a runtime provider by definition).
- This ADR does not block any of those phases from eventually being built — it only says where.
