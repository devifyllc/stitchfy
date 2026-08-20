# Upgrading from 2.1.x to 2.2.0

## If you only use website generation

**No migration is required.** `npm run stitchfy`, `npm run build:site`, `npm run build:site:stitch`, and `npm run audit` behave exactly as before. The only change in this area at all was an internal fix that keeps a validation library call current (see `docs/releases/MAIN_TO_DEVELOPMENT_DELTA.md` "BUG FIX") — it does not change what input is accepted or what output is produced. Your `input/project.md` and generated `website-blueprint.v1.json` remain fully compatible; `schemaVersion` is still `"1.0"`.

The only visible difference is metadata: freshly generated blueprints now report `project.frameworkVersion: "2.2.0"` instead of an older value. This is informational metadata, not a schema change — see `docs/architecture/COMPATIBILITY.md`.

## If you want Solution Architecture

Introduce `npm run solution -- --input <your-requirements.md>` alongside (not instead of) your existing website workflow. It reads a structured Markdown document and generates a `SolutionBlueprint` covering whichever capabilities your document's content supports — see `templates/solution/` for starting points and `examples/reference/` for complete worked examples.

## If you want Codebase Analysis

Introduce `npm run analyze:codebase -- --path <repo>` (standalone) or add `--codebase <repo> --system-id <id>` to a `solution` run (integrated with Legacy Modernization). Entirely optional, read-only, and offline.

## If you use JSON artifacts

`WebsiteBlueprint` v1 and `SolutionBlueprint` v1 are both now STABLE contracts (see `docs/architecture/PUBLIC_CONTRACTS.md`) — within schema `"1.0"`, new optional fields may be added, but existing fields won't be removed or retyped without a documented breaking change. Per-capability standalone JSON artifacts (workflow/integration/AI-agent/security/observability/cloud/modernization) and the two export manifests remain CANDIDATE — real and stable in practice, but without the same formal guarantee yet.

## Deprecated field

If you consume `SolutionBlueprint` directly: `deployment` has never been populated by any Stitchfy generator and is deprecated in favor of `architecture` (the real Cloud Architecture output). It is still accepted if you're constructing documents by hand, but you should not rely on it going forward. Not relevant to website-only users.

## No data migration

There is no persisted application state to migrate — every Stitchfy run is a fresh, deterministic generation from your input Markdown. No migration command or upgrade script exists or is needed.
