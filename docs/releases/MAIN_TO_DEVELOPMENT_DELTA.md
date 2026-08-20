# `main` → `development` Delta (RC2)

Real Git evidence, not an assumption:

- `main` HEAD: `8e017da` — `development` HEAD: `ef173ea` — merge-base: `efec1ba`
- `main` has 4 commits `development` lacks; `development` has 15 commits `main` lacks (`git rev-list --left-right --count main...development` → `4 15`)
- **The 4 `main`-only commits are empty GitHub PR merge commits** (`Merge pull request #4-7`) — `git diff --quiet efec1ba main` exits `0`: **`main`'s tree is byte-identical to the merge-base's tree.** `main` introduced zero unique content since the branches split.
- 409 files changed, 72183 insertions(+), 23 deletions(-) (`git diff --stat main...development`, identical whether computed as a three-dot or two-dot diff, since `main == merge-base`)

This document classifies that delta by what it means for a user, not file-by-file — see `git diff --stat main...development` for the raw list.

## BACKWARD-COMPATIBLE EXISTING BEHAVIOR

- All 8 of `main`'s `package.json` scripts survive verbatim: `stitchfy, validate, build:site, build:site:stitch, audit, audit:stitch, audit:both, typecheck`. Zero renames, zero removals.
- `examples/beauty-salon.md`, `examples/massage-spa.md`, `examples/medical-center.md`, and `input/project.md` are byte-identical between the two branches (`git diff --quiet main development -- <path>` exits `0` for each).
- The website generation core is essentially untouched — see "INTERNAL ARCHITECTURE" below for the exact 3-file diff.
- License, author, repository URL, and `engines.node` metadata are identical between branches.

## NEW CAPABILITY

Seven new architecture-generation capabilities (Workflow Automation, Integrations, AI Agents, Security & Governance, Observability, Cloud/Deployment, Legacy Modernization), selected from structured Discovery evidence via a capability registry — none existed on `main`, all additive, none replace the website capability.

## NEW CLI

`npm run solution`, `npm run analyze:codebase` (end-user facing); `npm run reference:validate`, `npm run rc:validate`, `npm run release:validate`, `npm run test`, `npm run test:contracts` (maintainer/release tooling — `main` had no test suite/script at all). See `docs/architecture/PUBLIC_CONTRACTS.md` for the STABLE/CANDIDATE/INTERNAL split among these.

## NEW SERIALIZED ARTIFACT

`SolutionBlueprint` v1, `IntegrationExportManifest` v1, `ModernizationExportManifest` v1, `CodebaseAnalysisResult`, and per-capability generated JSON artifacts. `WebsiteBlueprint` v1 is **not** new — it is `main`'s original contract, unchanged in shape.

## DOCUMENTATION / POSITIONING

README repositioned from "static website generator" framing to "solution-engineering framework" (website generation kept as one capability among eight, its own Quick Start section preserved, not hidden — see `docs/releases/UPGRADING_FROM_2_1.md`). `docs/reference/`, `docs/architecture/`, `examples/reference/`, `templates/solution/` are all new documentation/example surface with no runtime effect.

## INTERNAL ARCHITECTURE

- Discovery, Planning, and the Capability Registry (`framework/discovery/`, `framework/planning/`, `framework/core/registry/`) are new internal machinery with no `main`-side equivalent.
- The website pipeline's own code changed in exactly 3 places: `framework/agents/intake.agent.ts` (5 lines, RC1's `frameworkVersion` centralization), `framework/schemas/blueprint.schema.ts` (16 lines, see "BUG FIX" below), and a new file (`framework/validators/validate-solution-blueprint.ts`, unrelated to the website schema — supports the new solution pipeline only).

## BUG FIX

- **`frameworkVersion` metadata drift** (found and fixed in RC1): both pipelines hardcoded independent, stale `frameworkVersion` strings that disagreed with `package.json`. Centralized into `framework/core/version.ts`.
- **A real, pre-existing inconsistency on `main` itself**, unrelated to `development`'s work: `main`'s `package.json` already declares `"zod": "^4.4.3"`, but `main`'s `framework/schemas/blueprint.schema.ts` uses `z.record(z.string())` (single-argument) and `errorMap` — Zod v3-era API syntax that Zod v4 renamed/changed (`z.record` now requires an explicit key+value schema; `errorMap` became `message`). `development`'s `blueprint.schema.ts` uses the corrected v4 syntax (`z.record(z.string(), z.string())`, `message`). **Validation *behavior* is unchanged** — this is an API-compatibility fix, not a shape/semantic change to `WebsiteBlueprint` — but it is worth recording as a real defect independent of the broader architecture effort.

## DEPRECATION

`SolutionBlueprint.deployment?: DeploymentInfo` — new in this delta (it's part of the new `SolutionBlueprint` contract, not a `main`-side field), already deprecated on arrival in favor of `SolutionBlueprint.architecture`, zero producers. See ADR-002.

## POTENTIAL COMPATIBILITY RISK

**None found that would require a major version bump.** Specifically checked and ruled out: no existing CLI command removed or renamed, no `WebsiteBlueprint` v1 field removed or retyped, no required field broken, no existing documented behavior changed except the Zod-syntax bug fix above (behaviorally inert). See `docs/architecture/RELEASE_CANDIDATE.md`'s SemVer analysis for the full reasoning behind the resulting MINOR version recommendation.
