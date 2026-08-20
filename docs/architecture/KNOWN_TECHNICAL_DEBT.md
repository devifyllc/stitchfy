# Known Technical Debt (RC1)

Only verified items — see "Tech debt vs. deferred scope" below for what's deliberately excluded from this list.

## Resolved by RC1

- **`frameworkVersion` disagreed with `package.json`.** The website pipeline (`framework/agents/intake.agent.ts`) hardcoded `frameworkVersion: "2.0.0"` and the solution pipeline (`framework/orchestrator/solution-orchestrator.ts`) hardcoded `frameworkVersion: "0.1.0-solution"` — neither matched `package.json`'s `"2.1.0"`. This was a genuine stabilization defect (two independently-drifted string literals with no source of truth), not deferred scope. Fixed by introducing `framework/core/version.ts` (`STITCHFY_VERSION`, derived from `package.json`) and wiring both call sites to it; regression-locked by `tests/contracts/versioning.contract.test.ts`.
- **A stale, user-visible "(Phase 0)" label** in the solution pipeline's console banner (`solution-orchestrator.ts`) and a stale "(Phase 8.5A)" label in `analyze-codebase.ts`'s banner — both objectively obsolete once those phases were long complete. Fixed; internal code comments referencing phase numbers for historical/archaeological purposes were deliberately left alone.
- **Fatal CLI errors printed a raw stack trace as the primary UX** in `run-solution.ts`, `run-stitchfy.ts`, and `analyze-codebase.ts` for expected, well-understood error conditions (e.g. "Repository path does not exist or is not a directory: ..."). Fixed to print `err.message` for `Error` instances; not a general error-handling redesign.

## Open (real, but scoped to a future pass)

- **No intentional npm library export map.** `package.json` has no `main`/`exports`/`files`/library build. This is a deliberate RC1 scope boundary (see `PUBLIC_CONTRACTS.md` "Nothing... is classified STABLE" and item 5 of the RC1 task), not something RC1 fixes — listed here only so it isn't silently forgotten before a future "expose Stitchfy as an importable library" phase.

## Explicitly NOT technical debt (deferred product scope — see ADR-001/ADR-003)

- No live `IntegrationProvider`/`CloudProvider` implementation exists.
- No AI/model runtime exists.
- No observability vendor configuration exists.
- No source patch/diff generator exists (Phase 8.5C).
- Gradle/.NET/Python/Go codebase analyzers don't exist — only Maven/npm/Java-source analysis is implemented; this was documented as deferred scope since Phase 8.5A and nothing here changes that.
- Capability execution follows a fixed registration order rather than a dependency-DAG scheduler — this is intentional architecture (see `PUBLIC_CONTRACTS.md` "Capability registration order"), proven correct by every completed capability phase, not an oversight.
- The original website pipeline (`framework/agents/`, `framework/core/site-generator.ts`, etc.) lives in its own directory tree rather than under `framework/capabilities/website/`'s newer capability-directory convention (the "Phase 2 website migration" the ROADMAP has always described as optional). See `docs/architecture/ROADMAP.md` and the RC1 decision recorded in `docs/architecture/RELEASE_CANDIDATE.md` — this is physical code organization with no user-facing effect, deliberately deferred rather than churned right before a release candidate.

## Tech debt vs. deferred scope

The distinction that governs this document: **"a capability that was never built is not technical debt — it's a scoping decision, documented and cross-referenced above.** A place where two parts of the *already-built* system disagree with each other (like the `frameworkVersion` drift) *is* technical debt, because nothing intended it — it's simply something nobody had reconciled yet.
