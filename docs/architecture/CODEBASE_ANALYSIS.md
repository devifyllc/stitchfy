# Codebase Analysis (Phase 8.5A)

Local, read-only, deterministic analysis of a user-supplied repository, turning manifests and limited source structure into provenance-backed architectural facts (`CodebaseAnalysisResult`) that Legacy Modernization (Phase 8) may optionally consume as additional, non-authoritative evidence for one explicitly-mapped system.

## Trust boundary

`CodebaseAnalysisResult` is a **second, independent evidence domain**, deliberately separate from `DiscoveryResult` (business/problem discovery, Phase 1):

```text
Business evidence    → DiscoveryResult          (framework/discovery/)
Repository evidence  → CodebaseAnalysisResult   (framework/analysis/codebase/)
```

They are never merged. `SolutionContext` carries both as siblings (`discoveryResult`, `codebaseAnalysis`) — a capability may read either, but nothing writes repository facts into `DiscoveryResult`/`BusinessContext`, and nothing writes business facts into `CodebaseAnalysisResult`.

## Read-only policy

The scanner and every analyzer:

- perform no network calls (no `fetch`/`axios`/`http(s)`/`undici` anywhere under `framework/analysis/codebase/` — enforced by a static source-text test);
- execute no repository commands (no `child_process`, no `mvn`/`gradle`/`npm`/`java`/`git`/`docker` — same enforcement);
- never write inside the analyzed repository — every Stitchfy output goes under Stitchfy's own `output/analysis/codebase/`;
- never follow a symlink, even one that resolves back inside the repository root — the simplest safe default;
- never read a sensitive file (`.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `credentials(.json)`, `secrets.*`) or a binary asset (`.jar`/`.war`/`.class`/`.png`/... — see `scanner/path-safety.ts`'s `BINARY_EXTENSIONS`);
- skip (never fail on) a file over 2 MB, recorded as ignored rather than as an analyzer error.

A repository does not need to be a Git repository; Phase 8.5A never inspects `.git`, commit history, branches, or remotes.

## Analyzer model

```typescript
interface CodebaseAnalyzer<TOutput = unknown> {
  id: string; name: string; version: string;
  supports(context: CodebaseAnalyzerContext): boolean;
  analyze(context: CodebaseAnalyzerContext): Promise<TOutput>;
}
```

Detection lives entirely in each analyzer's own `supports()` — orchestration (`codebase-analysis.ts`) never branches `if (repositoryHasPom) ...`. `CodebaseAnalyzerRegistry` (`analyzers/analyzer-registry.ts`) exposes `register()`/`get()`/`getAll()`/`findSupported()`; multiple analyzers may support the same repository at once (a Maven + npm + Java-source repository runs all three, never "pick one ecosystem").

Implemented analyzers: **Repository/filesystem** (always supports — language histogram, build-descriptor detection, unsupported-ecosystem gaps), **Maven** (`pom.xml`), **npm** (`package.json`), **Java source structure** (`*.java`). A repository containing `build.gradle`/`*.csproj`/`requirements.txt`/`go.mod` is still inventoried (the descriptor is recorded, `status` becomes `partial`) — an honest `CodebaseInformationGap` ("Build system detected: Gradle. Analyzer support: unavailable.") is generated instead of heuristically parsing an unsupported ecosystem.

One analyzer failing never destroys the whole run: `codebase-analysis.ts` wraps each `analyze()` call in try/catch, converting a thrown error into an `AnalyzerDiagnostic{severity:"error"}` and downgrading `status` to `"partial"` without discarding the other analyzers' output.

## Scanner exclusions

Centralized in `scanner/path-safety.ts` (single source of truth, reused by the scanner and every `context.readFile()` call):

- excluded directories: `.git`, `node_modules`, `target`, `build`, `dist`, `.next`, `coverage`, `vendor`, `out`, `output`, `bin`, `obj`, `.idea`, `.vscode`;
- `resolveWithinRoot(root, candidate)` rejects any path that resolves outside the repository root (`..` traversal) and any symlink, guaranteeing no analyzer can ever read outside the boundary or across a symlink escape.

Traversal is deterministic: directory entries are sorted before recursion, and the final file list is sorted again — identical repository contents always produce identical fact ordering and ids.

## Evidence and provenance model

```typescript
interface CodebaseEvidenceReference {
  analyzerId: string; filePath: string; // repository-relative, POSIX-style — never an absolute path
  line?: number; symbol?: string; factId?: string;
  evidenceType: "manifest" | "build-file" | "source" | "configuration" | "filesystem";
}
interface CodebaseFactMetadata {
  provenance: "observed" | "derived"; // "pom.xml declares spring-context:4.3.30" vs "Spring Framework is present"
  evidenceRefs: CodebaseEvidenceReference[];
}
```

A `"derived"` fact must cite the `"observed"` fact(s) it was computed from — never presented as a literal source-file statement. The validator (`validators/codebase-analysis.validator.ts`) enforces this, plus referential integrity across every fact id, and rejects any evidence reference whose `filePath` looks like an absolute path.

## Maven analysis

`analyzers/maven/pom-xml-parser.ts` is a minimal, dependency-free, deterministic XML parser scoped to POM structure — not a general-purpose XML engine. `<!DOCTYPE ...>`/`<!ENTITY ...>`/processing instructions are skipped outright during tokenization and never interpreted; there is no code path anywhere capable of resolving an external entity, a remote schema, a parent POM, or a BOM. Extracted: groupId/artifactId/version/packaging, parent coordinates, `<modules>`, `<properties>` (merged root-first across every locally-parsed POM — a value resolved this way is a "local repository model" derivation, never fetched remotely), `<dependencies>` (`direct: true`) and `<dependencyManagement>` (`direct: false`), `<build><plugins>` coordinates, `<profiles>` names, and compiler settings from both properties and the compiler plugin's configuration. A `${property}` unresolved in the merged local map becomes the literal string `"unresolved"` — never guessed.

## npm analysis

`package.json` is parsed with `JSON.parse` only. `name`/`version`/`type`/`engines`/`workspaces` and all four dependency maps (`dependencies`/`devDependencies`/`peerDependencies`/`optionalDependencies`) are extracted with version ranges preserved verbatim (`^18.3.0` stays `^18.3.0` — never resolved to a concrete version unless a lockfile is present, and even then Phase 8.5A only records lockfile *presence*, never builds a transitive graph). `scripts` are copied as `{name, command}` strings and never referenced by any executable code path — they are untrusted repository input, evidence only.

## Java structural analysis

Regex-based, not a compiler front-end — no compilation, no method-body interpretation. Extracts `package`, `import` statements, and type declarations (`class`/`interface`/`enum`/`record`/`@interface`) with `extends`/`implements` and the annotations found on the lines immediately preceding a declaration. Imports feed a shared keyword table (`analyzers/framework-detection.ts`, also used by the Maven analyzer against `groupId:artifactId`) mapping known prefixes to a framework name — `org.springframework` → Spring Framework, `javax.servlet`/`jakarta.servlet` → Servlet API (namespace folded into the name itself, so a mixed-namespace repository naturally produces two distinct `FrameworkFact`s rather than a separate "finding" entity). Application-server evidence is deliberately narrow: only a small set of real, recognizable descriptor filenames (`ibm-web-bnd.xml`, `ibm-web-ext.xml`, `websphere.xml`) produce a WebSphere `RuntimeFact` — never inferred from "this is Java EE."

## SystemInventory mapping

Codebase analysis never creates a `SystemInventoryItem`, and a Maven module / npm workspace / Java package is never treated as a system, microservice, or bounded context — code organization and business system boundaries are different things. Mapping a repository to a system is always an explicit, human-supplied `--system-id`:

```bash
npm run analyze:codebase -- --path ../order-portal                     # standalone inventory, no mapping
npm run analyze:codebase -- --path ../order-portal --system-id SYS-001 # standalone, tagged
npm run solution -- --input spec.md --codebase ../order-portal --system-id SYS-001  # integrated with Modernization
```

A `--system-id` that doesn't match a real, in-scope `SystemModernizationProfile.systemId` applies no enrichment at all — never a silent remap to a different system.

## Modernization enrichment

`framework/capabilities/modernization/generators/modernization-codebase-enrichment.generator.ts`, called from `modernization.capability.ts`'s `execute()` only when both `context.codebaseAnalysis` and `context.codebaseSystemId` are present:

- fills the mapped `SystemModernizationProfile.codebaseAnalysis` with fact-id references (never a copy of the facts);
- may append a `TechnicalDebtItem` for exactly two narrow, evidence-only findings (duplicate direct dependency declarations; an unresolved property-based version) — worded "analysis finding," never scored `high`;
- may append a `MigrationValidationRequirement` only when it can link to a real, already-existing `PreservationRequirement`;
- compares one deterministic pair — an explicit "Java N" statement in the modernization need's own text vs. a codebase compiler-config `RuntimeFact` — and, on disagreement, appends a `CodebaseEvidenceConflict{resolution: "unresolved"}` rather than picking a side;
- **never touches `MigrationCandidate.strategyOptions`** — strategy classification stays entirely Phase 8's own decision.

`ModernizationArchitecture.codebaseEvidenceConflicts` is always present (empty array when no codebase analysis was supplied), so Phase 8's own output is otherwise unaffected by this phase's existence.

## Limitations

No Gradle/.NET/Python/Go/container-image analysis (detected as an honest gap, never heuristically parsed). No transitive dependency resolution (direct dependencies only). No lifecycle/CVE/vulnerability evaluation of any kind. No dependency-upgrade recommendation. No source-code transformation or migration-recipe generation (deferred to Phase 8.5B). No Git history/commit/blame analysis. No content parsing of configuration files beyond presence (`application.properties`/`web.xml`/... are recorded as present, never read for values — so credential-shaped content is never at risk of being copied into an artifact).

## Future analyzers

Extension points exist (the `CodebaseAnalyzer` interface + registry), but none of the following are implemented: Gradle Analyzer, .NET Project Analyzer, Python Dependency Analyzer, Container/Dockerfile Analyzer, Git History Analyzer, Database Schema Analyzer. Adding one is additive: implement `CodebaseAnalyzer`, register it in `codebase-analysis.ts`'s `buildDefaultRegistry()` — no other file needs to change.

## Phase 8.5B boundary

```text
CodebaseAnalysisResult
        ↓
Architecture / human review
        ↓
Modernization Export Adapter (Phase 8.5B — not implemented)
```

There is a deliberate review boundary between "Stitchfy observed these facts" and any future code-transformation output. Phase 8.5B is not assumed automatic and is not implemented by this phase.
