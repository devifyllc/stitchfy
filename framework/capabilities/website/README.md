# Website Capability

Status: **real adapter**, not a placeholder. This capability calls the existing, unmodified pipeline in `framework/orchestrator/orchestrator.ts`.

It deliberately has no `schemas/website.types.ts` of its own: `WebsiteBlueprint` (`framework/schemas/blueprint.types.ts` plus `blueprint.schema.ts`) already fills that role and continues to be produced and validated exactly as before. This capability module is only the seam that lets the new capability registry invoke it.

## Planned structure (Phase 2: Website Capability Migration)

The existing `framework/agents/*`, `framework/core/site-generator.ts`, and `framework/core/stitch-generator.ts` are expected to eventually move under `agents/`, `generators/`, and `validators/` here. This wasn't done in Phase 0, to avoid rewriting a working pipeline. See `docs/architecture/ROADMAP.md` Phase 2.
