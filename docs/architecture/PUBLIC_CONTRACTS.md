# Public Contract Inventory

**Last reviewed: RC2.** Classifies Stitchfy's important surfaces into four stability levels. A surface being `export`ed from a TypeScript module does **not** by itself make it public — this document only classifies things a consumer would reasonably depend on across releases.

## Stability levels

- **STABLE** — compatibility guarantees are intentionally provided. Breaking this requires a documented breaking change.
- **CANDIDATE** — intended to become stable; already used by the canonical reference solutions and documented tooling, but still subject to RC feedback before a stronger guarantee is made.
- **EXPERIMENTAL** — a real, usable extension point, but import path/shape compatibility is not promised yet.
- **INTERNAL** — implementation detail; may change at any time without a compatibility guarantee.

**What STABLE means, precisely:** *within the stated schema/CLI generation, backward-incompatible changes require explicit versioning or migration documentation.* It does **not** mean the implementation can never change, that no optional field may ever be added, that no bug may be fixed, or that semantics can never evolve compatibly — see `docs/architecture/COMPATIBILITY.md` for exactly what counts as compatible evolution vs. a breaking change.

RC1 classified nothing STABLE — it was the first formal review. **RC2 promotes five contracts to STABLE**, each evaluated individually against real evidence (reference-scenario coverage, contract-test coverage, producer maturity, documented schema, existing compatibility rules, user-facing value) — see `docs/architecture/RELEASE_CANDIDATE.md`'s "RC2" section for the full per-contract justification, and `docs/architecture/decisions/ADR-004-mainline-promotion.md` for the promotion decision itself. Everything not explicitly promoted stays exactly where RC1 left it.

## STABLE — serialization contracts

| Contract | Producer | Compatibility scope |
|---|---|---|
| `WebsiteBlueprint` v1 (`website-blueprint.v1.json`) | `framework/orchestrator/orchestrator.ts` | `schemaVersion` = `WEBSITE_BLUEPRINT_SCHEMA_VERSION` (`framework/core/version.ts`), `"1.0"`. Governed by `docs/architecture/COMPATIBILITY.md`'s serialization policy; locked by `tests/contracts/website-blueprint-v1.contract.test.ts` |
| `SolutionBlueprint` v1 (`solution-blueprint.v1.json`) | `framework/orchestrator/solution-orchestrator.ts` | `schemaVersion` = `SOLUTION_BLUEPRINT_SCHEMA_VERSION`, `"1.0"` — frozen by ADR-002, locked by `tests/contracts/solution-blueprint-v1.contract.test.ts`. **The STABLE promise applies to the aggregate `SolutionBlueprint` shape and its top-level section presence/optionality — not to the internal shape of any individual nested capability section**, which stays CANDIDATE (see below) |

## STABLE — CLI contracts

| Command | Flags | Compatibility scope |
|---|---|---|
| `npm run stitchfy` | `--input <path>` (default `input/project.md`), `--output <dir>` (default `output`) | Oldest, unchanged command; zero flag drift since before this architecture effort began |
| `npm run solution` | `--input <path>`, `--output <dir>`, `--codebase <path>` (optional), `--system-id <id>` (optional, requires `--codebase`), `--modernization-export <target>` (optional, requires `--codebase`/`--system-id`) | All 5 flags exercised across the 3 canonical reference solutions; locked by `tests/contracts/stable-cli.contract.test.ts` |
| `npm run analyze:codebase` | `--path <repo>` (required), `--system-id <id>` (optional, standalone tagging only), `--output <dir>` (default `output`) | Real producer, documented, flag-tested. **Caveat, stated explicitly rather than hidden**: the *standalone* CLI form isn't directly exercised by a reference scenario — only the underlying `runCodebaseAnalysis()` function is, via `solution --codebase`. Promoted on the strength of the function-level coverage plus flag stability, not full CLI-level reference coverage |

Governed by `docs/architecture/COMPATIBILITY.md`'s "CLI compatibility policy."

## CANDIDATE — serialization contracts

| Contract | Producer | Notes |
|---|---|---|
| Per-capability generated JSON (`*.workflow.json`, `*.integration.json`, `*.agent.json`, `security-architecture.json`, `observability-architecture.json`, `cloud-architecture.json`, `modernization-architecture.json`, ...) | each capability's own `generators/*-artifact.generator.ts` | Deliberately kept CANDIDATE rather than promoted alongside `SolutionBlueprint` — the STABLE promise attaches to the aggregate, giving individual capability models room to evolve additively without each one independently carrying a compatibility burden |
| `IntegrationExportManifest` v1 (`integration.manifest.json`) | `framework/capabilities/integrations/exporters/generic-rest-typescript/` | `schemaVersion: "1.0"`. **Evaluated for STABLE promotion in RC2 and not promoted** — exactly one concrete exporter implementation exists, exercised by only one of the three canonical references (order-platform), no dedicated contract test yet. Real and useful; not yet proven across enough independent cases |
| `ModernizationExportManifest` v1 (`modernization.manifest.json`) | `framework/capabilities/modernization/exporters/generic-java-replatform/` | `schemaVersion: "1.0"`. Same reasoning as above — one implementation, one reference scenario (legacy-java-modernization), no dedicated contract test |
| `CodebaseAnalysisResult` (`codebase-analysis.json`) | `framework/analysis/codebase/codebase-analysis.ts` | `schemaVersion: "1.0"`. **Evaluated and not promoted** — one ecosystem (Maven/npm/Java) proven end-to-end, one reference scenario, no dedicated contract test. Its *safety semantics* (see EXPERIMENTAL section below) are non-negotiable regardless of this tier; only the serialization *shape* stays CANDIDATE |

Human-readable Markdown reports generated alongside these (e.g. `*.workflow.md`, `migration-recipe.md`, `solution-plan.md`) are **not** covered by this contract — see `docs/architecture/COMPATIBILITY.md` "Markdown vs. JSON."

## CANDIDATE — CLI / maintainer tooling

| Command | Flags | Notes |
|---|---|---|
| `npm run reference:validate` | none — runs the fixed set of 3 canonical scenarios in `tests/reference/reference-solutions.ts` | CANDIDATE, but explicitly a **maintainer/release-verification** command, not an end-user-facing STABLE contract |

See `docs/architecture/COMPATIBILITY.md` "CLI compatibility policy."

## EXPERIMENTAL — extension APIs

| API | File | Why EXPERIMENTAL |
|---|---|---|
| `StitchfyCapability<TInput, TOutput>` | `framework/core/contracts/capability.ts` | A real architectural seam (every capability implements it) but Stitchfy exposes no deliberate npm-library import surface yet — see "Package boundary" below and ADR-001 |
| `CapabilityRegistry` | `framework/core/registry/capability-registry.ts` | Same reason; shape (`register/get/getAll/getSupported`) is simple and stable in practice, but not promised |
| `IntegrationExporter<TOptions, TResult>` | `framework/capabilities/integrations/exporters/exporter.types.ts` | One concrete implementation (`generic-rest-typescript`) exists; the interface itself hasn't been proven against a second implementation |
| `ModernizationExporter<TOptions, TResult>` | `framework/capabilities/modernization/exporters/exporter.types.ts` | Same reasoning; one concrete implementation (`generic-java-replatform`) |
| `CodebaseAnalyzer<TOutput>` | `framework/analysis/codebase/contracts/codebase-analyzer.types.ts` | Four concrete analyzers exist (repository/Maven/npm/Java-source); interface shape not yet proven against a 5th ecosystem |
| `Provider<TConfig, TClient>`, `CloudProvider`, `IntegrationProvider` | `framework/core/contracts/provider.ts`, `framework/providers/cloud/`, `framework/providers/integrations/` | Real interfaces, **zero concrete implementations** — extension seams for deferred runtime work (see ADR-003), not dead code; do not delete |

`IntegrationExporter` and `ModernizationExporter` are deliberately **not** merged into one generic base — both share the conceptual shape `{id, name, version, target, supports(), assessReadiness(), export()}`, but their `supports()`/`assessReadiness()`/`export()` signatures differ in arity and context type (`ModernizationExporter` takes a `MigrationCandidate` plus `ModernizationArchitecture`/`CodebaseAnalysisResult`; `IntegrationExporter` takes a single `IntegrationDefinition` plus an `IntegrationExportContext`) because the two domains' inputs genuinely differ. Their *generated manifest schemas* (`IntegrationExportManifest`/`ModernizationExportManifest`) are separately classified CANDIDATE above — the exporter interface being EXPERIMENTAL does not weaken the manifest's own contract.

**`CodebaseAnalyzer`'s behavioral safety guarantees are release-candidate requirements even though its TypeScript shape stays EXPERIMENTAL**: local-only, read-only, no network, no command execution, repository-relative evidence only (no absolute path leakage), no secret extraction, no automatic modernization-strategy mutation. These are proven by `tests/codebase-analysis.test.ts` and `tests/modernization-exporters.test.ts`'s static guards and are non-negotiable regardless of how the interface itself evolves.

`Provider`-family stability: `framework/providers/llm/openai-provider.ts` and `framework/providers/stitch/stitch-provider.ts` are real, working adapters behind the already-functional `build:site:stitch` CLI path (wrapping the existing `StitchClient`) — meaningfully different maturity from `CloudProvider`/`IntegrationProvider`, which have no implementation at all. All four stay EXPERIMENTAL for RC1 (the `Provider` interface itself hasn't been stress-tested against enough implementations to promise shape stability), but this maturity difference is worth knowing.

## INTERNAL

Generators, extractors, planners, validators, `SolutionContext`'s internal fields (`projectId`, `capabilityAssessments`, etc.), the exact capability registration order in `framework/core/registry/default-capabilities.ts`, and general helper utilities (`makeIdGenerator`, `section-lookup.ts`, path-safety helpers, ...).

**Release/test tooling** — `npm run rc:validate`, `npm run release:validate`, `npm run test`, `npm run test:contracts` are INTERNAL: they compose other gates and write release-tooling reports (`output/release/*.json`/`*.md`), but are not themselves a contract a downstream consumer depends on. They may be restructured, split, or renamed freely as the release process evolves, independent of any CANDIDATE/STABLE promise elsewhere in this document.

**Capability registration order is architecturally meaningful but not a public API.** Later cross-cutting capabilities (Security & Governance, Observability, Cloud, Modernization) read earlier capabilities' already-executed output via `context.capabilityResults` — the order in `default-capabilities.ts` (website, workflow-automation, integrations, ai-agents, security-governance, observability, cloud, modernization) is a real dependency, documented here and in `docs/architecture/ARCHITECTURE.md`, but it is internal orchestration behavior, not something a consumer configures or depends on directly. No `dependsOn`/DAG scheduler exists or is planned for RC1 — the registration-order model has worked for every completed capability phase and nothing has forced a change.

## ID semantics

**Deterministic domain IDs** — sequential counters from `makeIdGenerator(prefix)` (`framework/discovery/shared/section-lookup.ts`), identical across repeated runs of the same input: `REQ-`, `PROC-`, `ACTOR-`, `SYS-`, `DATA-`, `INT-`, `OP-`, `WF-`, `STEP-`, `APPROVAL-`, `AIAGENT-`, `AITOOL-`, `AINEED-`, `DEPLOYUNIT-`, `RUNTIME-`, `CONNECT-`, `CANDIDATE-`, `DELTA-`, `PRESERVE-`, `RECIPE-`, `DEPCHANGE-`, `CFGCHANGE-`, `SRCCHANGE-`, and every other capability-scoped prefix. Safe to use for referential integrity and traceability across a single run.

**Execution/wrapper IDs** — may differ across runs of the *same* input, and must never be used for semantic identity:
- `ImplementationArtifact.id` — `artifact-<Date.now()>-<random>` (`framework/core/contracts/artifact.ts`)
- The embedded `HumanApproval.id` default — `approval-<Date.now()>-<random>` (`framework/governance/approvals/human-approval.types.ts`)
- `SolutionContext.projectId` / `WorkflowState.projectId` — `run-<Date.now()>` (`framework/orchestrator/workflow-state.ts`, `framework/core/contracts/context.ts`) — never written into a persisted blueprint's `project` field, only used in-memory during a run
- Every `generatedAt`/`timestamp` field, anywhere

This is exactly the volatile-field list Phase 9's `tests/reference/reference-runner.ts` (`normalizeReferenceOutput()`) already established for golden-fixture comparison — restated here as the canonical definition rather than duplicated.

## Status vocabulary

Several small, domain-specific status enums exist and are **intentionally not unified** into one global status type — they represent genuinely different questions:

- `draft | needs-review | complete` (and similar) — an architecture object's own internal completeness.
- `ready | needs-review | blocked | unsupported` — exporter readiness (can a recipe/scaffold usefully be generated right now).
- `executed | skipped | failed` — capability execution outcome for one pipeline run.

Consumers should not attempt to map these onto each other; each is scoped to its own domain.
