# ADR-004: Promote the Additive Solution-Engineering Architecture to Mainline

**Status:** Accepted

## Context

`development` has evolved far beyond `main`: `main`'s tree is byte-identical to the branches' merge-base (`efec1ba`, verified via `git diff --quiet`) — it introduced zero unique content — while `development` adds 409 changed files, seven new architecture-generation capabilities, two exporters, codebase analysis, three canonical reference solutions, and a full RC1/RC2 stabilization pass (357+ tests, contract tests, ADRs, compatibility policy). `docs/releases/MAIN_TO_DEVELOPMENT_DELTA.md` classifies the full delta; the short version is: the original website pipeline is untouched (one metadata fix, one Zod-syntax bug fix), and everything else is new, additive capability.

RC2 also had to decide which of the CANDIDATE contracts RC1 left unclassified-as-STABLE have now earned a real compatibility promise — that decision is recorded in `docs/architecture/RELEASE_CANDIDATE.md`'s "RC2" section and reflected in `docs/architecture/PUBLIC_CONTRACTS.md`.

## Decision

Promote the additive solution-engineering architecture to `main`, while preserving the website pipeline exactly as-is. Concretely:

- `WebsiteBlueprint` v1, `SolutionBlueprint` v1, `npm run stitchfy`, `npm run solution`, and `npm run analyze:codebase` become the first STABLE contracts Stitchfy has ever formally promised — see `PUBLIC_CONTRACTS.md` for the exact scope of each promise.
- Every other CANDIDATE contract (both export manifests, `CodebaseAnalysisResult`, per-capability JSON, `reference:validate`) stays CANDIDATE — evaluated individually and deliberately not promoted, for reasons recorded in `PUBLIC_CONTRACTS.md`.
- The recommended release version is `2.2.0` (MINOR) — the delta is backward-compatible and additive; no user-facing breaking contract was found. See `RELEASE_CANDIDATE.md`'s SemVer analysis.
- The actual `git merge`/tag/publish/GitHub-release steps remain outside this ADR and outside this task — this is a preparation decision, not an executed promotion.

## Consequences

- Stitchfy gains, for the first time, real compatibility commitments (STABLE contracts) — future changes to `WebsiteBlueprint`/`SolutionBlueprint` v1 shape or the 3 STABLE CLI commands' flags now require the breaking-change process documented in `COMPATIBILITY.md`, not an incidental edit.
- The broader product surface (architecture generation, exporters, codebase analysis) ships to `main` as CANDIDATE-tier — real and documented, but with more room to evolve before RC3 (or later) considers promoting them further.
- Runtime/provider/source-mutation tracks (5.5B, 6.5, 7C, 8.5C) remain deferred exactly as ADR-001/ADR-003 already decided — this ADR does not reopen that boundary.
- A human still needs to execute the actual merge (non-fast-forward — `main`'s HEAD is not an ancestor of `development`'s, though content-conflict-free per the topology check in `mainline-promotion.md`), review the ADRs, and approve the version bump before anything is tagged or published.
