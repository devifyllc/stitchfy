# Mainline Promotion Checklist

Human-reviewable checklist for promoting `development` to `main`. Each box below reflects what was independently verified during RC2's implementation pass — see `output/release/mainline-promotion.md` for the machine-generated, re-runnable version of the same gates (`npm run release:validate`).

- [x] `development` working tree clean
- [x] RC gates passing (`npm run rc:validate` — typecheck, full test suite, reference solutions)
- [x] Stable contract tests passing (`tests/contracts/website-blueprint-v1.contract.test.ts`, `stable-cli.contract.test.ts`, `release-version.contract.test.ts`)
- [x] References passing (`npm run reference:validate` — all 3 canonical scenarios, zero golden drift)
- [x] Website compatibility passing — `npm run stitchfy -- --input examples/beauty-salon.md` (the real fixture confirmed identical to `main`'s copy) produces a valid `website-blueprint.v1.json`; `npm run audit` completes (gracefully degraded, since the static site wasn't built — see next line). `npm run build:site` hit a pre-existing Windows symlink-permission limitation in this environment (`EPERM` on `fs.symlinkSync` linking `node_modules`) — verified via `git diff --quiet main development -- scripts/build-site.ts` (exit 0) that this script is byte-identical to `main`'s, so the limitation is environmental, not a regression introduced by this delta. Blueprint generation — the actual `WebsiteBlueprint` v1 contract being promoted to STABLE — is fully verified; the Next.js static-export step could not be exercised in this sandbox
- [x] Solution compatibility passing (`npm run solution`)
- [x] Release notes reviewed (`docs/releases/2.2.0.md`)
- [x] Upgrade guide reviewed (`docs/releases/UPGRADING_FROM_2_1.md`)
- [x] ADRs reviewed (ADR-001 through ADR-004, `docs/architecture/decisions/`)
- [x] Target version approved by this review (`2.2.0` — see `docs/architecture/RELEASE_CANDIDATE.md`'s SemVer analysis)
- [x] No unintended runtime/provider code (verified: no live `IntegrationProvider`/`CloudProvider` implementation, no AI/model runtime, no cloud provisioning, no observability vendor client — `framework/providers/{cloud,integrations}/` remain zero-implementation interfaces)
- [x] No source mutation (codebase analysis remains read-only/local/offline; modernization exporter remains proposal-only, zero repository writes, zero patch generation — proven by the existing byte-identity fixture checks in `tests/codebase-analysis.test.ts`/`tests/modernization-exporters.test.ts`/`tests/reference-solutions.test.ts`)
- [x] No secrets (no credential literal, API key, or `.env` value appears in any generated artifact or new documentation)
- [x] Main/development merge status reviewed (`main`'s tree is byte-identical to the merge-base; non-fast-forward at the ref level but content-conflict-free — see `output/release/mainline-promotion.md`)
- [ ] **Human approval to merge** — not granted by this review. A person must review this checklist and the linked reports before running `git merge`.
