# Public Contract Inventory (RC1)

Classifies Stitchfy's important surfaces into four stability levels. A surface being `export`ed from a TypeScript module does **not** by itself make it public — this document only classifies things a consumer would reasonably depend on across releases.

## Stability levels

- **STABLE** — compatibility guarantees are intentionally provided. Breaking this requires a documented breaking change.
- **CANDIDATE** — intended to become stable; already used by the canonical reference solutions and documented tooling, but still subject to RC feedback before a stronger guarantee is made.
- **EXPERIMENTAL** — a real, usable extension point, but import path/shape compatibility is not promised yet.
- **INTERNAL** — implementation detail; may change at any time without a compatibility guarantee.

**Nothing in Stitchfy is classified STABLE in RC1.** This is the first formal stabilization pass — every serialization/CLI contract below is CANDIDATE, meaning "this is the shape we intend to keep," not "this is already guaranteed." See `docs/architecture/RELEASE_CANDIDATE.md` for the overall RC result.

## CANDIDATE — serialization contracts

| Contract | Producer | Notes |
|---|---|---|
| `WebsiteBlueprint` v1 (`website-blueprint.v1.json`) | `framework/orchestrator/orchestrator.ts` | `schemaVersion` = `WEBSITE_BLUEPRINT_SCHEMA_VERSION` (`framework/core/version.ts`), currently `"1.0"` |
| `SolutionBlueprint` v1 (`solution-blueprint.v1.json`) | `framework/orchestrator/solution-orchestrator.ts` | `schemaVersion` = `SOLUTION_BLUEPRINT_SCHEMA_VERSION`, currently `"1.0"` — see ADR-002 |
| Per-capability generated JSON (`*.workflow.json`, `*.integration.json`, `*.agent.json`, `security-architecture.json`, `observability-architecture.json`, `cloud-architecture.json`, `modernization-architecture.json`, ...) | each capability's own `generators/*-artifact.generator.ts` | Shape follows the capability's own `.types.ts`/`.schema.ts` pair (verified in parity below) |
| `IntegrationExportManifest` v1 (`integration.manifest.json`) | `framework/capabilities/integrations/exporters/generic-rest-typescript/` | `schemaVersion: "1.0"` (`exporter.types.ts`) |
| `ModernizationExportManifest` v1 (`modernization.manifest.json`) | `framework/capabilities/modernization/exporters/generic-java-replatform/` | `schemaVersion: "1.0"` (`exporter.types.ts`) |
| `CodebaseAnalysisResult` (`codebase-analysis.json`) | `framework/analysis/codebase/codebase-analysis.ts` | `schemaVersion: "1.0"` |

Human-readable Markdown reports generated alongside these (e.g. `*.workflow.md`, `migration-recipe.md`, `solution-plan.md`) are **not** covered by this contract — see `docs/architecture/COMPATIBILITY.md` "Markdown vs. JSON."

## CANDIDATE — CLI contracts

Exact flag inventory, verified against `scripts/*.ts` source (never assumed):

| Command | Flags |
|---|---|
| `npm run stitchfy` | `--input <path>` (default `input/project.md`), `--output <dir>` (default `output`) |
| `npm run solution` | `--input <path>`, `--output <dir>`, `--codebase <path>` (optional), `--system-id <id>` (optional, requires `--codebase`), `--modernization-export <target>` (optional, requires `--codebase`/`--system-id`) |
| `npm run analyze:codebase` | `--path <repo>` (required), `--system-id <id>` (optional, standalone tagging only), `--output <dir>` (default `output`) |
| `npm run reference:validate` | none — runs the fixed set of 3 canonical scenarios in `tests/reference/reference-solutions.ts` |
| `npm run rc:validate` | none — composes `typecheck`/`test`/`reference:validate` |

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
