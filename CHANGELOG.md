# Changelog

All notable changes to Stitchfy are documented here. See `docs/releases/` for full, user-facing release notes and `docs/architecture/ROADMAP.md` for the detailed development history.

## 2.2.1

### Fixed

- `build:site:stitch` (Google Stitch MCP pipeline) failed on every page: Google renamed the `generate_screen_from_text` `modelId` enum (`GEMINI_3_1_PRO`/`GEMINI_3_FLASH` → `GEMINI_3_8_FLASH`/`GEMINI_3_5_FLASH_LITE`) and changed `get_screen`'s accepted arguments to `name` only. `StitchClient` now validates the configured model against the live `tools/list` schema at startup and falls back through a known-good order instead of failing every page on a stale `STITCH_MODEL`.
- `StitchClient` silently treated Stitch's application-level tool errors (`result.isError: true`) as successful content, surfacing as a confusing downstream parse failure instead of a clear error.
- `generateScreen()` discarded the exported HTML when Stitch returned it inline in the `generate_screen_from_text` response itself, forcing a redundant `get_screen` poll that could stall indefinitely for a subset of screens even though the page had already generated successfully. Inline HTML is now used directly when present; a stalled `get_screen` poll now retries generation (up to 3 attempts, with backoff) before the page is reported as failed.
- UX Agent: industry detection didn't match common phrasings like "Primary Care / Family Medicine", and page templates for ids without an exact template key (e.g. `our-providers`, `contact-location`) silently collapsed to duplicate homepage content instead of a relevant template.

## 2.2.0

### Added

- Solution Architecture pipeline (`npm run solution`): Business Discovery, Solution Planning, and seven new architecture-generation capabilities (Workflow Automation, Integrations, AI Agents, Security & Governance, Observability, Cloud/Deployment, Legacy Modernization).
- Two deterministic, offline export adapters: `generic-rest-typescript` and `generic-java-replatform`.
- Local, read-only codebase analysis (`npm run analyze:codebase`), optionally integrated with Legacy Modernization.
- Three canonical, end-to-end reference solutions (`examples/reference/`) and `npm run reference:validate`.
- Release/contract tooling: `npm run rc:validate`, `npm run release:validate`, `npm run test`, `npm run test:contracts`.
- First formal set of STABLE contracts: `WebsiteBlueprint` v1, `SolutionBlueprint` v1, `npm run stitchfy`, `npm run solution`, `npm run analyze:codebase` — see `docs/architecture/PUBLIC_CONTRACTS.md`.
- Solution Report (`output/.../reports/solution-report.html`): a self-contained, interactive HTML projection of `solution-blueprint.v1.json`, generated automatically at the end of every `npm run solution` run — Capabilities and Implementation Backlog views, full evidence/traceability drill-down, no separate source of truth. See `docs/architecture/ARCHITECTURE.md` ("Solution Report").

### Changed

- README repositioned from "static website generator" to "solution-engineering framework"; website generation preserved as one capability among eight, with its own Quick Start unchanged.
- `package.json` description updated to reflect the broader framework scope.

### Fixed

- Generated `project.frameworkVersion` no longer disagrees with `package.json`'s version (previously hardcoded independently in the website and solution pipelines) — centralized in `framework/core/version.ts`.
- `framework/schemas/blueprint.schema.ts` updated from Zod v3-era single-argument `z.record()`/`errorMap` syntax to the Zod v4 syntax the project's own declared dependency version requires — validation behavior is unchanged.
- Fatal CLI errors no longer print a raw stack trace as the primary output for expected error conditions (e.g. a missing repository path).

### Deprecated

- `SolutionBlueprint.deployment` — never populated by any generator; use `SolutionBlueprint.architecture` instead. Still accepted by validation.
