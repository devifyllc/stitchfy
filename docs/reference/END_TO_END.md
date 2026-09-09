# End-to-End Walkthrough

How a Markdown requirements document becomes a validated solution
architecture plus reviewable implementation artifacts — illustrated with
`npm run solution -- --input examples/reference/order-platform.md`. The
other two canonical references (`docs/reference/APPOINTMENT_AUTOMATION_AI.md`,
`docs/reference/LEGACY_JAVA_MODERNIZATION.md`) walk the same eight steps for
their own scenarios; this document is the one place the general chain and
artifact taxonomy live.

## The eight steps

**1. Write requirements in Markdown.** A plain `.md` file with structured
headings Stitchfy recognizes (`## Business`, `## Business Processes`,
`## Integrations`, `## Deployment Requirements`, ...) — see `templates/solution/`
for starting points and `examples/reference/order-platform.md` for a filled-in
example. Anything left out becomes an explicit information gap, never a
guessed default.

**2. Business Discovery extracts explicit facts.**
`framework/discovery/business/business-discovery.agent.ts` parses the
Markdown into a `DiscoveryResult` — goals, actors, business processes,
systems, integrations, deployment needs, and so on — each entry carrying a
`SourceReference` back to the originating bullet. Nothing here infers
architecture; it only structures what the document literally says.

**3. Solution Planning decides which capabilities belong.**
`framework/planning/capability-assessment/` runs every registered
capability's `assess()` against the `DiscoveryResult` *before* any of them
execute, producing a `CapabilityAssessment` (status/confidence/reasons) per
capability and a `SolutionPlan.selectedCapabilities` list. For
`order-platform.md` this selects `website`, `workflow-automation`,
`integrations`, `security-governance`, `observability`, and `cloud` — and
explicitly does *not* select `ai-agents` or `modernization`, because neither
has any evidence in the document. See
`output/reference/order-platform/reports/solution-plan.md` for the full,
per-capability "why" after running the command below.

**4. Selected capabilities generate architecture.**
Each selected capability's `execute()` runs in registry order, reading
`DiscoveryResult` (and, for cross-cutting capabilities, its already-executed
siblings) and producing its own typed architecture slice —
`IntegrationDefinition[]`, `CloudArchitecture`, and so on — merged into one
`SolutionBlueprint`.

**5. Cross-cutting capabilities constrain the architecture.** Security &
Governance and Observability never invent their own facts — they read
Workflow/Integration/AI-Agent output plus `## Requirements`/`## Data` text
and produce requirements/signals that cite real architecture entities via
`ArchitectureReference`. Legacy Modernization does the same across
Integrations, Security, Observability, and Cloud.

**6. Export adapters generate implementation-oriented scaffolding.**
Where a real, technology-eligible target exists, an *exporter* converts
validated architecture into reviewable, technology-specific output —
generated TypeScript for a REST integration (`generic-rest-typescript`), or
a migration recipe for an explicit replatform (`generic-java-replatform`,
only with `--modernization-export`). Every exporter output is a *proposal*,
never an applied change.

**7. Repository analysis may add independent engineering evidence.**
Optional and separate from the rest of the pipeline: `--codebase <path>
--system-id <id>` runs a read-only static analysis of a real repository and
attaches it to `SolutionContext.codebaseAnalysis`, mapped to exactly one
named system. It is never merged into `DiscoveryResult` — a second,
independent evidence domain (see `docs/architecture/CODEBASE_ANALYSIS.md`).

**8. Human review remains required before runtime execution or source
transformation.** Nothing in this pipeline runs a workflow, calls an
integration, executes an AI model, provisions cloud infrastructure, or
modifies a source repository — see "Artifact taxonomy" below for exactly
what layer each output belongs to.

## Running it

```bash
npm run solution -- --input examples/reference/order-platform.md --output output/reference/order-platform
```

Produces, under `output/reference/order-platform/`:

| Directory | Contents |
|---|---|
| `context/` | `business-context.json` — the derived `BusinessContext` |
| `blueprints/` | `solution-blueprint.v1.json` — the full validated `SolutionBlueprint`, the canonical machine-readable contract |
| `artifacts/` | Per-capability generated JSON/Markdown, plus any exporter scaffolding |
| `reports/` | `solution-plan.md` (capability-selection rationale) and `solution-report.html` (interactive human-readable projection of the blueprint — open directly in a browser) |

`solution-report.html` adds nothing `solution-blueprint.v1.json` doesn't
already contain — see `docs/architecture/ARCHITECTURE.md` ("Solution
Report") for how the two relate.

## Artifact taxonomy

Four distinct layers — knowing which one a given output belongs to is the
difference between "this is a proposal" and "this is running software":

### Architecture artifacts

`WorkflowDefinition`, `IntegrationDefinition`, `AIAgentDefinition`,
`SecurityArchitecture`, `ObservabilityArchitecture`, `CloudArchitecture`,
`ModernizationArchitecture`. Structured, validated descriptions of a
solution — never executed, provisioned, or deployed by generating them.

### Engineering evidence

`CodebaseAnalysisResult` — independently observed facts about a real
repository (a compiler source level, a dependency version, a framework's
presence). Never a business decision; never merged into Discovery.

### Implementation scaffolding

`IntegrationExportBundle`, `ModernizationExportBundle` — proposals derived
from already-reviewed architecture (plus, for Modernization, repository
evidence). Reviewable and reviewable *only* — see
`docs/reference/ORDER_PLATFORM.md` and
`docs/reference/LEGACY_JAVA_MODERNIZATION.md` for the exact runtime
boundary each one draws.

### Runtime

Not implemented anywhere in the architecture/export phases documented here.
No workflow engine, no live integration call, no LLM invocation, no cloud
provisioning, no automatic source-code patch — see
`docs/architecture/ROADMAP.md` for the deferred tracks (Runtime Integration
Providers, AI Agent Runtime, Cloud/Observability Runtime Providers,
Reviewed Source Transformation) that would eventually fill this layer.

## See also

- `docs/reference/CAPABILITY_MATRIX.md` — exactly which capability fires in
  which of the three canonical references, generated from real runs.
- `docs/reference/APPOINTMENT_AUTOMATION_AI.md`,
  `docs/reference/ORDER_PLATFORM.md`,
  `docs/reference/LEGACY_JAVA_MODERNIZATION.md` — per-scenario walkthroughs
  with real generated IDs.
- `examples/reference/README.md` — the three scenarios' purpose, exact
  commands, and expected output.
