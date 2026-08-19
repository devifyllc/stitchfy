# Stitchfy Architecture

## Old architecture

Stitchfy started as a single pipeline:

```
project.md → 5 blueprint agents (intake, ux, seo, accessibility, frontend)
  → website-blueprint.v1.json → site-generator.ts / stitch-generator.ts
  → static-site / stitch-site
```

`framework/orchestrator/orchestrator.ts` drives this by name: it imports the
five agents directly and runs them in a fixed array. This is simple and
works well for exactly one outcome — a website — but doesn't generalize: a
sixth capability (e.g. "generate a workflow automation spec") would mean
editing the orchestrator, the blueprint type, and the blueprint schema all
at once, and there's no way to skip capabilities that don't apply to a given
business.

**This pipeline is untouched.** `npm run stitchfy`, `npm run build:site`,
`npm run build:site:stitch`, `npm run audit`, and `npm run validate` all
still work exactly as before.

## Why the architecture is changing

The goal is for Stitchfy to describe *solutions*, not just *websites*. A
business's actual need is often broader than a website: it may also need a
workflow automated, a legacy system assessed for migration, or an AI agent
handling intake. Website generation should be one option the framework can
produce, not the assumption baked into every layer.

## New architecture

```
project.md
  → Business Discovery           (framework/discovery/)
  → business-context.json
  → Solution Architect           (framework/planning/solution-architect/)
  → SolutionContext + draft SolutionBlueprint
  → Capability Registry          (framework/core/registry/)
      ├─ website                 → wraps the existing pipeline unchanged
      ├─ workflow-automation
      ├─ ai-agents
      ├─ integrations
      ├─ cloud
      ├─ security-governance
      ├─ observability
      └─ modernization
  → Capability Runner            (framework/orchestrator/capability-runner.ts)
  → Risk Assessment              (framework/planning/risk-assessment/)
  → solution-blueprint.v1.json
```

Driven by `framework/orchestrator/solution-orchestrator.ts` (`npm run
solution`), entirely separate from `orchestrator.ts`.

### Capability model

Every capability implements `StitchfyCapability<TInput, TOutput>`
(`framework/core/contracts/capability.ts`):

```ts
interface StitchfyCapability<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  version: string;
  supports(context: SolutionContext): boolean;
  plan(context: SolutionContext): Promise<TInput>;
  execute(input: TInput, context: SolutionContext): Promise<TOutput>;
  validate(output: TOutput, context: SolutionContext): Promise<ValidationResult<TOutput>>;
}
```

`supports()` lets a capability opt itself in or out based on
`BusinessContext` — the same keyword-heuristic technique already used for
industry-aware defaults in the UX/SEO agents
(`framework/planning/capability-selector/capability-selector.ts`). This is
what lets the orchestrator stay generic: it never asks "is this a workflow
project?" — it asks every registered capability "do you apply here?" and
runs the ones that say yes.

Of the 8 built-in capabilities, only **website**
(`framework/capabilities/website/`) is a real, fully wired adapter — it
calls `runPipeline()` from the existing `orchestrator.ts` unchanged. The
other 7 are typed skeletons: real `supports()` heuristics, but `execute()`
returns a typed empty section marked `implemented: false` (see each
capability's `README.md` and `docs/architecture/ROADMAP.md` for its target
phase).

### Capability registry

`framework/core/registry/capability-registry.ts` — a plain
register/get/getAll/getSupported registry. Adding a 9th capability means
writing the module and adding one line to
`framework/core/registry/default-capabilities.ts`; it never means editing
the orchestrator.

### Solution Blueprint

`framework/schemas/solution-blueprint/solution-blueprint.types.ts` +
`.schema.ts` — broader than `WebsiteBlueprint`. `project` and `business` are
required; every other section (`requirements`, `processes`, `actors`,
`systems`, `constraints`, `capabilities`, `architecture`, `integrations`,
`automation`, `ai`, `security`, `governance`, `observability`,
`modernization`, `deployment`, `risks`, `artifacts`, `qa`) is optional and
populated only once its capability actually executes.

`WebsiteBlueprint` is not merged into `SolutionBlueprint` — it continues to
be produced and validated on its own, written to
`output/blueprint/website-blueprint.v1.json` exactly as before. The website
capability's execution result (including the full `WorkflowState`) is
attached to `SolutionBlueprint.capabilities`, so a solution blueprint can
always point back to the website blueprint that was produced alongside it.

### Provider model

`framework/core/contracts/provider.ts` defines `Provider<TConfig, TClient>`.
Capabilities depend on this interface, never on a vendor SDK directly.
`framework/providers/stitch/stitch-provider.ts` adapts the existing
`StitchClient` to it (real); `llm/openai-provider.ts`,
`cloud/cloud-provider.types.ts`, and
`integrations/integration-provider.types.ts` are placeholders establishing
where a real OpenAI/AWS/Azure/SaaS client would plug in later.

### Governance / human-in-the-loop

`framework/governance/approvals/human-approval.types.ts` defines
`HumanApprovalRequest` (approvalRequired, approverRole, reason, riskLevel,
decision, timestamp, comments) as a first-class domain concept — no
approval UI exists yet, but any capability output can attach one (e.g. the
AI Agents capability's `AIAgentDefinition.humanApproval`). Every capability
run is written to an audit trail
(`framework/governance/audit/audit-logger.ts`) via
`capability-runner.ts`, so "what ran and when" is answerable from Phase 0
onward, independent of whether a given capability is fully implemented yet.

### Orchestration

Two orchestrators coexist on purpose:

- `framework/orchestrator/orchestrator.ts` — the original, unchanged,
  website-only pipeline (`WorkflowState`, `AgentConfig`, fixed `PIPELINE`
  array).
- `framework/orchestrator/solution-orchestrator.ts` — the new
  capability-driven pipeline (`SolutionContext`, `StitchfyCapability`,
  registry-driven).

`capability-runner.ts` merges each capability's output into the blueprint
via a small `Record<capabilityId, sectionKey>` lookup table plus one
explicit branch for the two-field `security-governance` capability — never
a growing switch statement.

## Discovery Model (Phase 1)

Phase 0 left `framework/discovery/{processes,systems,constraints,requirements}/`
as empty typed stubs and `BusinessContext` as flat string arrays. Phase 1
replaces that with real, deterministic, provenance-tracked extraction.

### Source of truth

`DiscoveryResult` (`framework/discovery/discovery-result.types.ts`) is what
Business Discovery actually produces — typed, ID-bearing entities for goals,
pain points, desired outcomes, actors, processes, requirements, systems,
integration needs, data entities, constraints, business rules, information
gaps, and traceability links.

`BusinessContext` (`framework/discovery/business/business-context.types.ts`)
is **unchanged in shape** from Phase 0 and is now a *derived projection*,
computed once by `deriveBusinessContext(result)`. This is deliberate: the 7
keyword-matching capabilities added in Phase 0 already read
`context.businessContext?.goals`, `.processes`, `.painPoints`, etc. as plain
`string[]` — keeping `BusinessContext`'s shape frozen means zero edits to
those capability files, while `SolutionContext` gains an additional
`discoveryResult?: DiscoveryResult` field carrying the full richer model for
whichever future capability wants it (see "Capability Selection Evolution"
below). `output/context/business-context.json` now serializes the full
`DiscoveryResult`; `SolutionBlueprint.business` keeps the compact projection.
`SolutionBlueprint.{requirements,processes,actors,systems,constraints,
businessRules,informationGaps,traceability}` are populated directly from the
same `DiscoveryResult`'s arrays — no independent re-extraction, no
duplicated logic between the two output files.

### Explicit vs. inferred information

Every rich discovery object carries one `metadata: DiscoveryMetadata` field
(`framework/core/contracts/provenance.ts`):

```ts
interface SourceReference {
  sourceType: "input" | "derived" | "user" | "system";
  section?: string;
  text?: string;
}

interface DiscoveryMetadata {
  confidence: number;   // 0–1
  sources: SourceReference[];
  inferred: boolean;
}
```

`sourceType` records *how* a value was obtained; `inferred` separately flags
*AI* involvement. In Phase 1, everything is deterministic — `inferred` is
always `false` — but the field exists so that when an LLM enrichment step is
wired in (see below), its output is structurally distinguishable from an
explicit fact rather than silently merged in as one. The one deliberate
simplification from the task's per-field sketch: a single `metadata` field
replaces scattered `source`/`confidence` fields, applied consistently across
every entity — see e.g. `RequirementItem`, which dropped a redundant flat
`source: string` in favor of `metadata.sources`.

Two concrete `sourceType` distinctions worth calling out:

- A business rule or pain point mentioned *inside* a process's own labeled
  sub-section (e.g. "Business rules:" within a "Business Processes" block)
  is still `"input"` — the user wrote it, just in a different location than
  a dedicated top-level section. See `makeProcessBusinessRule`,
  `makeProcessPainPoint`, `makeProcessActor`, `makeProcessSystem`.
- A requirement is `"derived"` only when there's no explicit `## Requirements`
  section at all and it was synthesized from a `DesiredOutcome`
  (`requirements.extractor.ts`) — confidence 0.5, never presented as
  equivalent to an explicit requirement.

### Traceability

`TraceabilityLink { fromId, toId, relationship }`
(`framework/discovery/traceability/traceability.types.ts`) — deliberately
not a graph database. `traceability.extractor.ts` builds links only from
relation IDs *already stored* on typed objects
(`RequirementItem.relatedGoalIds/relatedPainPointIds`,
`BusinessProcess.actorIds/systemIds/painPointIds/businessRuleIds`) — no
fuzzy or semantic matching, so every link is explainable back to an explicit
field. This instantiates the chain `Source → Goal/PainPoint → Requirement →
Process → Capability → Decision/Artifact` for the Requirement/Process half;
the Capability/Decision half is populated separately by
`solution-orchestrator.ts` into `SolutionBlueprint.capabilities`.

Not yet linked in Phase 1 (see Phase 1.5 in the roadmap): a requirement
derived from a `DesiredOutcome` doesn't produce a `"derived-from"` link back
to that outcome (`RequirementItem` has no `relatedOutcomeIds` field yet),
and constraints aren't cross-referenced to anything.

### Information gaps

`InformationGap` (`framework/discovery/gaps/information-gap.types.ts`) is
how Stitchfy represents "I don't know this yet" as data instead of silently
leaving an array empty. `information-gaps.extractor.ts` raises one whenever
a category came back empty (goals, actors, pain points, systems,
constraints, business rules, or an all-derived requirements list), plus one
higher-signal check: if a process or pain point's text mentions recording
customer/personal information but no `## Data` section exists, it raises a
`high` importance, `blocking: true` gap tagged
`relatedCapabilityIds: ["security-governance"]` — mirroring the task's own
worked example, generalized via keyword match rather than hardcoded to one
document. No interactive questionnaire is implemented; gaps are just typed
output for now.

### LLM enrichment extension point

Not wired in Phase 1 — deliberately. The conceptual pipeline is
deterministic discovery → structured `DiscoveryResult` → optional LLM
enrichment → `DiscoveryResultSchema` validation → final result, matching the
existing OPENAI INTEGRATION POINT convention already used by the website
blueprint agents (`framework/agents/intake.agent.ts` etc.) and the
`Provider<TConfig, TClient>` contract (`framework/providers/llm/openai-provider.ts`).
Any future LLM-produced field must pass `DiscoveryResultSchema` and be
marked `metadata.inferred: true` — never merged in as if it were explicit
input. No stub call site was added for this in Phase 1 since an unused,
untestable code path is worse than documenting the seam.

### Capability selection evolution

Item 13 of the Phase 1 task documented this as a table of *future* signals;
Phase 1.5 (below) actually migrated the first row. Current state:

| Capability | Selection method | Structured signal |
|---|---|---|
| `workflow-automation` | **structured** (Phase 1.5) | `process.automationCandidates`/`manualSteps`, requirement `type`, outcome language — see "Solution Planning" below |
| `ai-agents` | legacy-keyword | future: an `AIAgentDefinition`-shaped need inferred from `process.manualSteps` + `actors` |
| `integrations` | legacy-keyword | future: `integrationNeeds.length > 0` or `systems.some(s => s.category === "saas")` |
| `cloud` | legacy-keyword | future: `systems.some(s => s.category === "legacy" \|\| s.criticality === "high")` |
| `security-governance` | legacy-keyword | future: `dataEntities.some(d => d.sensitive)` or a `blocking` information gap tagged `security-governance` |
| `observability` | legacy-keyword | future: `systems.some(s => s.criticality === "high")` |
| `modernization` | legacy-keyword | future: `systems.some(s => s.category === "legacy")` |
| `website` | legacy-keyword (`supports()` always `true`) | not planned to migrate — website has no "not applicable" case |

## Solution Planning (Phase 1.5)

Phase 0's `supports(context): boolean` answers "should this run?" with no
explanation. Phase 1.5 adds an explainable layer on top, additively:

```
DiscoveryResult → CapabilityAssessment[] → SolutionPlan → SolutionBlueprint.planning
```

### CapabilityAssessment

`framework/planning/capability-assessment/capability-assessment.types.ts` —
`status` (`recommended | not-recommended | needs-review | blocked`),
`confidence` (`low | medium | high`), a list of `AssessmentReason`s (each
carrying `EvidenceReference[]` — see `framework/core/contracts/evidence.ts`
— pointing at real `DiscoveryResult` entity ids), `related*Ids` for quick
cross-referencing, and `method` (`structured | legacy-keyword |
explicit-request`). Deliberately no numeric score: `status`/`confidence`
are derived from how many independent, named signal categories fired (see
`workflow-automation.assessor.ts`), never a weighted sum.

### The `assess()` contract

`StitchfyCapability.assess?(context): CapabilityAssessment` was added as an
**optional** method — `supports(context): boolean` is unchanged and remains
what `capability-runner.ts` actually gates execution on.
`framework/planning/capability-assessment/assess-capabilities.ts` provides
the generic bridge:

```ts
function assessCapability(capability, context) {
  return capability.assess?.(context) ?? legacyKeywordAssessment(capability, context);
}
```

`legacyKeywordAssessment()` wraps a capability's existing `supports()`
boolean into a `CapabilityAssessment` tagged `method: "legacy-keyword"` —
this is *not* a second selection mechanism, it's a label on the exact same
boolean `capability-runner.ts` already used. Zero capability-ID branching
lives in the registry or orchestrator (task item 19) — `assessAllCapabilities()`
just calls `assessCapability()` for every registered capability.

### Workflow Automation: the first structured capability

`framework/capabilities/workflow-automation/workflow-automation.assessor.ts`
reads `context.discoveryResult` directly — no keyword search against
flattened `BusinessContext` text. Its signals:

- **Process** (purely structural — array-length checks, no text matching):
  `automationCandidates.length > 0`, `manualSteps.length > 0` (strong);
  `systemIds.length >= 2`, `actorIds.length >= 2` (supporting).
- **Requirement**: `type === "automation"` (strong); `type === "integration" | "operational"` (supporting).
- **Outcome**: `DesiredOutcome.description` matched against an
  automation-language pattern — scoped to that one already-structured
  field, not a markdown-wide search.

Any `InformationGap` that is both `blocking` and tagged
`relatedCapabilityIds: ["workflow-automation"]` forces `status: "blocked"` —
an unrelated gap (e.g. one tagged only `security-governance`, like the
appointment example's customer-data gap) never blocks workflow automation
(task item 14). Otherwise: ≥1 strong signal → `recommended`; only
supporting signals → `needs-review`; nothing → `not-recommended`
(confidence `high` either way when there's no ambiguity).

`workflow-automation.capability.ts`'s `supports()` calls the exact same
`assessWorkflowAutomation()` its `assess()` calls and checks `status` — one
function, multiple call sites, one set of rules.

### WorkflowAutomationPlan and human-in-the-loop

`workflow-automation.planner.ts` turns a `recommended`/`needs-review`
assessment into a `WorkflowAutomationPlan` (`processIds`, `requirementIds`,
`systemIds`, `automationCandidates`, `humanTouchpoints`, `integrationNeeds`,
`informationGaps`, `assumptions`) — architectural only, no external system
is contacted. `humanTouchpoints` are found by matching
`approv|manual review|human (review|approval|control)|escalat|exception`
against `DesiredOutcome`/`RequirementItem` descriptions (structured fields,
not raw markdown) and building a real `HumanApprovalRequest` via the
existing `createApprovalRequest()` (`framework/governance/approvals/human-approval.types.ts`)
— reused, not reimplemented. `approverRole` is only set when a
`BusinessActor.role` substring is actually found in the matched text;
otherwise it stays a generic `"designated approver"` rather than guessing a
specific person or role.

### SolutionPlan

`framework/planning/capability-assessment/solution-plan.ts`'s
`buildSolutionPlan()` is a pure function: one `SolutionDecision` per
assessment (`recommended→selected`, `needs-review→deferred`,
`not-recommended→not-selected`, `blocked→blocked`),
`selectedCapabilities` = the same set whose `supports()` would return
`true`, `unresolvedGaps` = every currently-blocking `InformationGap` id
(Phase 1.5 resolves none of them — this list is just honest about what's
still open). Computed once, in the `"planning"` stage of
`solution-orchestrator.ts`, *before* `capability-runner.ts` runs any
capability — `SolutionContext.capabilityAssessments`/`.solutionPlan` carry
it forward; `capability-runner.ts` looks the assessment up rather than
recomputing selection logic, and attaches it to
`CapabilityExecutionResult.assessment` for auditability.

### Planning report

`framework/reports/render-solution-plan-report.ts` renders
`output/reports/solution-plan.md` directly from the already-computed
`SolutionPlan`/`DiscoveryResult` — no decision is recomputed in the report
layer (task item 16). `SolutionBlueprint.planning?: SolutionPlan` carries
the same data into the JSON artifact, additively (`schemaVersion` stays
`"1.0"`).

### Requirement → Outcome traceability

`RequirementItem.relatedOutcomeIds` (new) lets a requirement derived from a
`DesiredOutcome` keep a deterministic `"derived-from"` link back to it — the
extractor already has the outcome object in scope when it derives the
requirement, so this needed no correlation logic, just recording what was
already known. Requirement↔process correlation was **not** added — the
codebase has no deterministic way to know that today, and task item 13 is
explicit that fabricating one would be worse than leaving
`relatedProcessIds: []`.

## Adaptation from the literal proposed folder tree

The originally proposed structure gives every capability 4-5 subfolders
(`agents/`, `generators/`, `validators/`, ...) up front. Phase 0 keeps each
capability flat (`<capability>.capability.ts` + `schemas/` + `README.md`)
and documents the future split in that `README.md`, to avoid ~150 empty
files for functionality that isn't implemented yet. Other adaptations:

- `framework/reports/` (existing) continues to serve the "reporting" role
  instead of a duplicate empty `framework/reporting/`.
- `site-template/` (existing) continues to serve as the website capability's
  template layer instead of a duplicate `templates/website/`.
- Legacy output stays at `output/blueprint/website-blueprint.v1.json`. New
  output goes to `output/context/business-context.json` and
  `output/blueprints/solution-blueprint.v1.json` (plural, distinct from the
  legacy singular directory) plus `output/artifacts/`.
- `modernization` is a top-level `SolutionBlueprint` field even though the
  base field list in the original spec didn't name it explicitly — Legacy
  Modernization's system inventory/migration output doesn't fit cleanly
  into `systems` (which is discovery-stage inventory, not migration
  strategy), so it gets its own section like every other capability.

## Migration strategy

Additive only. Nothing under `framework/agents/`, `framework/core/`
(existing files), `framework/orchestrator/orchestrator.ts`,
`framework/orchestrator/agent-runner.ts`, `framework/orchestrator/workflow-state.ts`,
`site-generator.ts`, or `stitch-generator.ts` was modified in behavior.
The only changes to pre-existing files are:

- `framework/schemas/blueprint.schema.ts` — mechanical Zod v4 API
  compatibility fixes (`z.record` now takes a key + value schema,
  `errorMap` renamed to `message`/`error`) needed to make `npm run
  typecheck` pass against the `zod@4.4.3` version pinned in
  `package-lock.json`. No validation behavior changed;
  `npm run stitchfy` produces byte-for-byte the same kind of output before
  and after.
- `package.json` — added the `solution` script.
- `.gitignore` — added ignore rules for the 3 new output directories.
- `README.md` — added one short section pointing here.

**Phase 1** touched only discovery-adjacent, additive files: the Phase 0
placeholder `Actor` type in `solution-blueprint.types.ts` was replaced by
the richer `BusinessActor` (it was unused anywhere else — verified before
removing it); `solution-blueprint.schema.ts` now imports its
requirement/process/actor/system/constraint schemas from the new
`framework/schemas/discovery/discovery-result.schema.ts` instead of
redefining them locally (also fixes a pre-existing Phase 0 duplication of
`BusinessContextSchema`); `business-context-writer.ts`,
`solution-architect.ts`, `solution-orchestrator.ts`, and
`core/contracts/context.ts` were updated to thread `DiscoveryResult`
through instead of the flat `BusinessContext`. `SolutionBlueprint` stays
`schemaVersion: "1.0"` throughout — every new/changed field is optional or
was already unused elsewhere, so nothing reading known v1 fields breaks.
`framework/orchestrator/orchestrator.ts` (the website pipeline) was not
touched.

**Phase 1.5** added the assessment/planning layer purely additively:
`StitchfyCapability.assess?()` is optional and every existing capability
compiles unchanged; only `workflow-automation.capability.ts` was rewritten
(its `plan()`/`execute()` input type changed from a local `PlanInput` to
`CapabilityAssessment` — an internal detail, not part of the public
contract). One small dedup cleanup while touching this area:
`ai-agents.schema.ts`'s local `HumanApprovalRequestSchema` was replaced with
an import from the new `framework/schemas/common/human-approval.schema.ts`,
which `workflow-automation.schema.ts` also uses — same shape, defined once.
`SolutionBlueprint` stays `schemaVersion: "1.0"` — `planning` is optional
and `actors`'s type already changed to `BusinessActor` in Phase 1, so
nothing new breaks. `framework/orchestrator/orchestrator.ts` was not
touched.

See `docs/architecture/ROADMAP.md` for what comes next.
