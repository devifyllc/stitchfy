# Stitchfy RC1 — Release Notes

Summarizes what Stitchfy does at the RC1 stabilization point, by user-visible capability. Full detail: `docs/architecture/RELEASE_CANDIDATE.md`.

## Solution architecture pipeline

`npm run solution -- --input <requirements.md>` turns a structured Markdown requirements document into a validated `SolutionBlueprint`: Business Discovery extracts explicit facts, Solution Planning selects capabilities from structured evidence, and each selected capability generates its own architecture — Workflow Automation, Integrations, AI Agents, Security & Governance, Observability, Cloud/Deployment, and Legacy Modernization.

## Reference solutions

Three canonical, end-to-end worked examples (`examples/reference/`) exercise real combinations of the above together and are regression-tested via `npm run reference:validate`: Appointment Automation & AI, Operational Order Platform, and Legacy Java Modernization.

## Exporters

`generic-rest-typescript` converts a complete REST `IntegrationDefinition` into reviewable TypeScript scaffolding. `generic-java-replatform` converts an explicitly-approved Java replatform strategy plus repository evidence into a reviewable migration recipe and change proposals. Both are deterministic, offline, and produce files only — see ADR-001.

## Codebase analysis

`npm run analyze:codebase -- --path <repo>` (standalone) or `npm run solution -- --codebase <repo> --system-id <id>` (integrated) runs a local, read-only, offline analysis of a real Maven/npm/Java repository and turns it into evidence Legacy Modernization may optionally consume.

## Compatibility boundaries

- `SolutionBlueprint`/`WebsiteBlueprint` stay schema `1.0` for RC1 — see `docs/architecture/decisions/ADR-002-solution-blueprint-v1-stability.md`.
- Nothing is classified STABLE yet; everything documented above is CANDIDATE — see `docs/architecture/PUBLIC_CONTRACTS.md`.
- No npm library import surface exists — Stitchfy is a repository/CLI/artifact-contract framework, not (yet) an importable package.

## Deferred (not implemented in RC1)

The following are explicitly **not** implemented, and this document does not call them implemented: a live workflow/integration/cloud runtime, AI/model execution, cloud provisioning, observability vendor configuration, and automatic source-code patch generation. See `docs/architecture/decisions/ADR-003-runtime-provider-boundary.md` for why these stay outside the architecture core, and `docs/architecture/ROADMAP.md` for the specific deferred phases (5.5B, 6.5, 7C, 8.5C).
