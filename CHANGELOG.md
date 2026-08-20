# Changelog

All notable changes to Stitchfy are documented here. See `docs/releases/` for full, user-facing release notes and `docs/architecture/ROADMAP.md` for the detailed development history.

## 2.2.0

### Added

- Solution Architecture pipeline (`npm run solution`): Business Discovery, Solution Planning, and seven new architecture-generation capabilities (Workflow Automation, Integrations, AI Agents, Security & Governance, Observability, Cloud/Deployment, Legacy Modernization).
- Two deterministic, offline export adapters: `generic-rest-typescript` and `generic-java-replatform`.
- Local, read-only codebase analysis (`npm run analyze:codebase`), optionally integrated with Legacy Modernization.
- Three canonical, end-to-end reference solutions (`examples/reference/`) and `npm run reference:validate`.
- Release/contract tooling: `npm run rc:validate`, `npm run release:validate`, `npm run test`, `npm run test:contracts`.
- First formal set of STABLE contracts: `WebsiteBlueprint` v1, `SolutionBlueprint` v1, `npm run stitchfy`, `npm run solution`, `npm run analyze:codebase` — see `docs/architecture/PUBLIC_CONTRACTS.md`.

### Changed

- README repositioned from "static website generator" to "solution-engineering framework"; website generation preserved as one capability among eight, with its own Quick Start unchanged.
- `package.json` description updated to reflect the broader framework scope.

### Fixed

- Generated `project.frameworkVersion` no longer disagrees with `package.json`'s version (previously hardcoded independently in the website and solution pipelines) — centralized in `framework/core/version.ts`.
- `framework/schemas/blueprint.schema.ts` updated from Zod v3-era single-argument `z.record()`/`errorMap` syntax to the Zod v4 syntax the project's own declared dependency version requires — validation behavior is unchanged.
- Fatal CLI errors no longer print a raw stack trace as the primary output for expected error conditions (e.g. a missing repository path).

### Deprecated

- `SolutionBlueprint.deployment` — never populated by any generator; use `SolutionBlueprint.architecture` instead. Still accepted by validation.
