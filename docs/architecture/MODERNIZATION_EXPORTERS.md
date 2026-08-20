# Modernization Exporters (Phase 8.5B)

Transforms an already-reviewed `ModernizationArchitecture` + `CodebaseAnalysisResult` into reviewable, implementation-oriented artifacts — a migration recipe, change proposals, a test-impact specification, and a validation plan. It never decides *whether* or *how* to modernize (that decision already exists in `ModernizationArchitecture`, Phase 8) and never writes to the analyzed repository.

## Review boundary

```text
CodebaseAnalysisResult
        ↓
Architecture / human review        (Phase 8 — a person approved the strategy)
        ↓
Modernization Export Adapter       (Phase 8.5B — this phase)
        ↓
Human / Engineering Review         (a person reviews the proposals before acting on them)
```

The exporter never independently decides "this application should be migrated," "should be rewritten," "should move to Tomcat," or "this dependency should be upgraded" — those decisions must already exist in `ModernizationArchitecture`. The exporter converts an architecture decision into implementation-oriented proposals; it does not make the modernization decision, and nothing it produces is applied automatically.

## Exporter versus Transformer

```text
ModernizationExporter = generates proposed changes and implementation artifacts
SourceTransformer     = would mutate source code — does NOT exist in Phase 8.5B
```

Only `ModernizationExporter` is implemented. No source-mutating transformer, patch generator, or `git apply`/`patch`/`sed -i` code path exists anywhere in this module.

## `ModernizationExporter` contract

```typescript
interface ModernizationExporter<TOptions = unknown, TResult = ModernizationExportBundle> {
  id: string; name: string; version: string;
  target: ModernizationExportTarget;
  supports(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult): boolean;
  assessReadiness(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult): ModernizationExportReadiness;
  export(candidate: MigrationCandidate, architecture: ModernizationArchitecture, codebase: CodebaseAnalysisResult, options?: TOptions): Promise<TResult>;
}
```

`candidate` is threaded through explicitly (adapted from the task's own `(architecture, codebase)`-only sketch) because `ModernizationExportReadiness.modernizationCandidateId` is singular and export generation is scoped per `MigrationCandidate`, mirroring `IntegrationExporter`'s per-`IntegrationDefinition` scoping from Phase 5.5A.

Pure functions throughout: `ModernizationArchitecture` and `CodebaseAnalysisResult` are never mutated by `assessReadiness()`/`export()` — verified by dedicated immutability tests.

## Registry

`ModernizationExporterRegistry` (`register()`/`get()`/`getAll()`/`findSupported()`) — adding a new export target is a `register()` call in `default-exporters.ts`, never a switch statement over exporter ids anywhere else. Detection lives entirely in each exporter's own `supports()`.

## Readiness semantics

- **ready** — enough architecture + repository evidence exists for a meaningful recipe (rare in practice; most real migrations have at least one open detail).
- **needs-review** — a useful recipe can be produced, but important implementation decisions remain unresolved (e.g. an explicit target runtime with no version, or a locally-unresolvable dependency version).
- **blocked** — an unresolved `CodebaseEvidenceConflict` directly concerns the runtime/version being migrated; generating a recipe would require guessing which source is right. Stitchfy never silently picks Discovery evidence or repository evidence — the bundle is still generated (manifest/readiness/report), but nothing overstates certainty.
- **unsupported** — the registered exporter does not apply to this candidate/codebase at all (no explicit `replatform` strategy, no Java codebase, or no real runtime `ModernizationDelta`).

No numeric readiness score anywhere.

## `generic-java-replatform` — the first concrete exporter

`supports()` requires all three, deterministically:

1. `candidate.strategyOptions` includes an **explicit** `replatform` option — Phase 8's own decision, never re-derived.
2. `codebase.repository.detectedLanguages` includes `"Java"` — a real Java codebase.
3. `architecture.modernizationDeltas` has a real `category: "runtime"` delta with a target state for this system.

Orchestration stays generic — nothing branches on a literal target string like `"Tomcat"` outside this one exporter. The exporter reasons from `ModernizationDelta.currentState/targetState`, `RuntimeFact[]`, `FrameworkFact[]`, `ConfigurationFact[]`, and `CodeDependencyFact[]`. The one technology-specific recognizer (a WebSphere-descriptor filename allowlist: `ibm-web-bnd.xml`, `ibm-web-ext.xml`, `websphere.xml`) lives *inside* this exporter, matching the same narrow, explicit-marker-only pattern Phase 8.5A's Java analyzer already established — never inferred from "this is Java EE."

## Proposal model — a third provenance domain

```text
Discovery evidence      → EvidenceReference          (business/problem discovery, Phase 1)
Codebase evidence       → CodebaseEvidenceReference   (repository facts, Phase 8.5A)
Transformation proposal → ModernizationChangeProposal and its specializations (this phase)
```

A proposal cites architecture/codebase evidence; it is never itself an observed fact, and none of it represents an applied change. `DependencyChangeProposal`/`ConfigurationChangeProposal`/`BuildChangeProposal`/`SourceTransformationCandidate`/`ManualReviewItem` all default to `retain`/`review` — `remove`/`replace` require deterministic evidence, never a guess. `remove` is used nowhere in the shipped exporter; the validator still checks the rule generically as defense-in-depth.

### Version and namespace restraint (mandatory)

No target dependency version, framework version, or runtime version is ever invented. `WebSphere → Tomcat` does not establish a Servlet API version, a Tomcat version, or a Spring/Hibernate/Java version — all stay `unresolved`/absent unless the architecture states them explicitly. No Maven Central/npm registry/CVE/EOL/vendor-compatibility lookup exists anywhere (Phase 8.5B remains fully deterministic and offline).

`javax.*` imports observed alongside a target of merely "Apache Tomcat" produce a namespace **review** candidate (`status: "review"`, `proposedDirection: undefined`) — never an automatic `jakarta.*` proposal. Only when a real `ModernizationDelta.targetState` for the system explicitly mentions "Jakarta" does the same observation promote to `status: "candidate"` with a stated direction — still never a source-file edit.

### No invented configuration

WebSphere → Tomcat does not justify generating `context.xml`/`server.xml`/`tomcat-users.xml`/`META-INF/context.xml` — nothing is proposed that isn't itself observed repository evidence. A WebSphere descriptor becomes a **review** candidate worded "WebSphere-specific configuration requires review for the target runtime," never a claim that removal is safe or that a Tomcat equivalent is known.

## Test impact and validation plan

`TestImpactArea`s connect to real `PreservationRequirement`s wherever possible (business-behavior → regression validation, integration-contract → integration validation citing the real `IntegrationDefinition`, data → an explicit "no database migration is proposed" statement), plus fixed `build`/`startup`/`runtime` areas that a runtime-changing replatform always implies. No numeric acceptance criteria (HTTP codes, response times, payload shapes) are ever fabricated. `MigrationValidationPlan.validationGates` are generated only for areas that actually exist — no automatic deployment or production-cutover gate is ever created.

## Source immutability

The analyzed repository is verified byte-identical before and after every export run (same md5-hash strategy Phase 8.5A already established). No `child_process`, no network, no `git apply`/`patch`/`sed -i`/`writeFile`/`rename`/`unlink` against the analyzed path exists anywhere under `framework/capabilities/modernization/exporters/` — enforced by static source-text tests, the same pattern `tests/codebase-analysis.test.ts` already uses.

## CLI

Export generation requires **explicit user intent** — unlike every prior capability, it never runs automatically:

```bash
# Analysis + Phase 8.5A enrichment only — no export bundle, no exporters/ directory
npm run solution -- --input spec.md --codebase ../repo --system-id SYS-001

# Explicit export intent
npm run solution -- --input spec.md --codebase ../repo --system-id SYS-001 --modernization-export generic-java-replatform
```

A single integrated command (no separate script) was chosen over a standalone `export:modernization` command specifically so users never have to hand-reconstruct `ModernizationArchitecture`/`CodebaseAnalysisResult` objects themselves — both already exist naturally at this point in the `solution` pipeline. A requested target that isn't registered, or that doesn't support the mapped candidate, produces no bundle and no error — never a fabricated recipe.

## Output

```text
output/artifacts/modernization/exporters/{repository-name}/{exporterId}/
├── migration-recipe.{json,md}
├── dependency-change-plan.{json,md}
├── configuration-change-plan.{json,md}
├── source-review.{json,md}
├── test-impact.{json,md}
├── validation-plan.{json,md}
└── modernization.manifest.json
```

Every Markdown file states the mandatory review-boundary disclaimer verbatim: *"These artifacts are proposed modernization changes generated from the currently known modernization architecture and repository evidence. They have not been applied to the source repository and have not been proven correct by compilation, testing, deployment, or runtime validation."*

## Future work

**Phase 8.5C — Reviewed Source Transformation / Patch Generation** (not implemented):

```text
ModernizationExportBundle
        ↓
Human approval
        ↓
SourceTransformationPlan
        ↓
Patch Generator
        ↓
reviewable unified diff
```

Even Phase 8.5C should not necessarily apply patches automatically — a human-approval gate remains between a proposal and any generated diff.

**Future exporters** (not implemented): `java-jakarta`, `spring-boot`, `java-runtime-upgrade`, `node-runtime-upgrade`, `application-server-replatform`, `database-modernization`.
