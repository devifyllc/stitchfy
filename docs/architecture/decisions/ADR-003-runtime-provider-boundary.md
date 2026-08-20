# ADR-003: Runtime Providers Stay Outside the Architecture Core

**Status:** Accepted

## Context

Architecture generation today provides deterministic execution, fully offline reference validation (`npm run reference:validate` requires no API key and makes no network call), no required credentials anywhere in the pipeline, and no vendor runtime coupling. `framework/providers/cloud/cloud-provider.types.ts` and `framework/providers/integrations/integration-provider.types.ts` already define the *shape* a real runtime provider would take, with zero implementations — deliberate extension seams (see `docs/architecture/PUBLIC_CONTRACTS.md`), not dead code to delete.

Actually implementing one (a live `CloudProvider` that provisions infrastructure, a live `IntegrationProvider` that calls a real API, an AI/model runtime, an observability vendor configuration) would introduce a materially different risk and complexity profile:

- Real credentials that must be stored, rotated, and protected.
- Network failures as a normal, expected runtime condition (nothing in core today has to handle this).
- Vendor SDKs, each with its own dependency footprint and breaking-change cadence.
- OAuth/token lifecycle management.
- External side effects — a re-run is no longer idempotent/free the way architecture generation is.
- Real cloud/resource cost.
- A substantially larger security surface (anything that can make an authenticated network call is a different threat model than a pure text-in/text-out generator).

## Decision

Architecture-generation core remains side-effect-light and offline. No live `CloudProvider`, `IntegrationProvider`, AI/model runtime, or observability-vendor configuration is implemented in RC1, and none should be added directly to core in the future without a separate, explicit package/boundary review — see ADR-001 for where such work would land instead.

This preserves, deliberately, the property that made Phase 9's reference-validation suite possible in the first place: three full end-to-end scenarios, including a codebase-evidence analysis and two exporters, run in seconds with zero external dependencies and zero credentials.

## Consequences

- Phases 5.5B (Runtime Integration Providers), 6.5 (AI Agent Runtime), 7C (Cloud/Observability Runtime Providers), and 8.5C (Reviewed Source Transformation) all stay explicitly deferred — this ADR is the documented reason, not merely "not built yet."
- `docs/architecture/ROADMAP.md`'s existing deferred-tracks list is unaffected in substance; this ADR gives it a formal architectural rationale.
- A future implementation of any of these tracks should re-read this ADR first and either justify why it doesn't reintroduce the risks above, or accept that it belongs in a separate package per ADR-001.
