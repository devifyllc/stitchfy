# Website Capability

Status: **real adapter**, not a placeholder — this capability calls the
existing, unmodified pipeline in `framework/orchestrator/orchestrator.ts`.

Deliberately has no `schemas/website.types.ts` of its own: `WebsiteBlueprint`
(`framework/schemas/blueprint.types.ts` + `blueprint.schema.ts`) already fills
that role and continues to be produced/validated exactly as before. This
capability module is only the seam that lets the new capability registry
invoke it.

## Planned structure (Phase 2 — Website Capability Migration)

The existing `framework/agents/*`, `framework/core/site-generator.ts`, and
`framework/core/stitch-generator.ts` are expected to eventually move under
`agents/`, `generators/`, and `validators/` here. Not done in Phase 0 to
avoid rewriting a working pipeline — see
`docs/architecture/ROADMAP.md` Phase 2.
