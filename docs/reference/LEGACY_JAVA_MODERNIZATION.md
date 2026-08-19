# Reference Walkthrough: Legacy Java Modernization

Traces `examples/reference/legacy-java-modernization.md` through the chain
`business modernization need → explicit replatform strategy → AS-IS system
evidence → repository evidence → modernization enrichment → exporter
readiness → migration recipe → test-impact specification`, using real IDs
from an actual run. See `docs/reference/END_TO_END.md` for the general
8-step pipeline and artifact taxonomy this walkthrough assumes.

```bash
npm run solution -- \
  --input examples/reference/legacy-java-modernization.md \
  --output output/reference/legacy-java-modernization \
  --codebase tests/fixtures/codebases/legacy-java-maven \
  --system-id SYS-001 \
  --modernization-export generic-java-replatform
```

## Business modernization need → explicit replatform strategy

The `## Modernization Requirements` bullet "The application must move from
IBM WebSphere to Apache Tomcat while preserving application behavior"
produces `CANDIDATE-001` in `ModernizationArchitecture.migrationCandidates`
(`systemId: "SYS-001"`, the Order Portal), with exactly one
`strategyOptions` entry: `{ strategy: "replatform", status: "explicit" }`.
This is Phase 8's own decision — the exporter later reads it, never
re-derives it.

## AS-IS system evidence

`ModernizationDelta` `DELTA-001` preserves `currentState: "IBM WebSphere"` →
`targetState: "Apache Tomcat"` verbatim from the document. Three
`PreservationRequirement`s exist: `PRESERVE-001` (business behavior,
`type: "business-behavior"`), `PRESERVE-002` (Integration Gateway
compatibility, `type: "integration-contract"`), and `PRESERVE-003` (Order
Database technology, also `type: "integration-contract"` — see the note
below).

> `PRESERVE-003`'s type is `"integration-contract"`, not `"data"`, because
> Phase 8's classifier matches it via the JDBC integration's
> `mentionedDependency`, a pre-existing Phase 8 behavior unrelated to Phase
> 9 and out of scope to change here. The exporter's own `"data"`-category
> test-impact handling is verified separately, against a synthetic fixture,
> in `tests/reference-solutions.test.ts`.

## Repository evidence

`--codebase tests/fixtures/codebases/legacy-java-maven --system-id SYS-001`
runs a read-only Maven/Java analysis of the fixture repository, mapped
*only* to `SYS-001` (the id the document's own "Existing Systems" list
resolves Order Portal to — never inferred from the folder name or Maven
`artifactId`). Produces `CodebaseAnalysisResult` facts including one
`RuntimeFact{type: "application-server", name: "WebSphere"}` and a
WebSphere descriptor (`ibm-web-bnd.xml`), plus a locally-unresolvable
dependency version. The repository itself is verified byte-identical
before and after — confirmed by both `tests/codebase-analysis.test.ts` and
`tests/reference-solutions.test.ts`'s own "Codebase evidence integrity"
check.

## Modernization enrichment

`enrichModernizationWithCodebaseAnalysis()` attaches this evidence to
`SYS-001`'s profile without touching `CANDIDATE-001.strategyOptions` —
verified unchanged before/after by a dedicated immutability test.

## Exporter readiness

`generic-java-replatform`'s three-condition `supports()` gate — explicit
replatform strategy, a Java codebase, a real runtime `ModernizationDelta` —
is satisfied, so it runs and reaches `status: "needs-review"`, with two
reasons: the target runtime "Apache Tomcat" has no version specified, and
one direct dependency has a locally-unresolvable version. Neither becomes a
blocking condition — a useful recipe can still be produced with both left
open.

## Migration recipe

`output/reference/legacy-java-modernization/artifacts/modernization/exporters/legacy-java-maven/generic-java-replatform/migration-recipe.md`
contains six steps (runtime review, configuration review, dependency
review, source review, validation, manual review) — never a version number
next to "Apache Tomcat," never an invented Tomcat configuration file, and
the WebSphere descriptor becomes a `review` proposal worded "WebSphere-
specific configuration requires review for the target runtime," never a
claim that removal is safe.

## Test-impact specification

Built from the three `PreservationRequirement`s above: a business-behavior
area, an integration-contract area citing the real Integration Gateway
`IntegrationDefinition`, and — because `PRESERVE-003` classified as
integration-contract rather than data in this specific example — no
dedicated "no database migration is proposed" area appears *in this run*
(the exporter's `"data"`-category branch, which does add that exact
statement, is exercised directly by a synthetic test fixture instead — see
the note above). Fixed `build`/`startup` areas are also present, since any
runtime-changing replatform implies them.

## Runtime boundary

```text
ModernizationArchitecture
        ↓
CodebaseAnalysisResult
        ↓
ModernizationExportBundle          (migration recipe + change proposals)
        ↓
Human review
        ↓
Phase 8.5C — Reviewed Source Transformation / Patch Generation — not executed
```

**`ModernizationExportBundle` ≠ source-code modification.** No Java file in
`tests/fixtures/codebases/legacy-java-maven` was read for writing, no
`javax` → `jakarta` replacement was applied (the document's target,
"Apache Tomcat," never mentions Jakarta, so the namespace observation stays
`status: "review"` with no proposed direction — see
`docs/architecture/MODERNIZATION_EXPORTERS.md`), and no diff or patch file
exists anywhere in the output. Phase 8.5C is documented, not implemented.
