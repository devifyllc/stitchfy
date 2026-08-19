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

## Workflow Specification Generation (Phase 3)

Phase 1.5 made Workflow Automation's *selection* and *planning* real
(`CapabilityAssessment`, `WorkflowAutomationPlan`) but `execute()` still
returned `implemented: false` with empty step/decision/approval arrays.
Phase 3 makes generation real too:

```
WorkflowAutomationPlan
     ↓  workflow-definition.generator.ts   (one WorkflowDefinition per relevant BusinessProcess)
WorkflowDefinition[]
     ↓  workflow-definition.validator.ts   (referential/structural integrity, reachability, cycles)
     ↓  workflow-artifact.generator.ts     (JSON + Markdown-with-Mermaid)
ImplementationArtifact[]  →  output/artifacts/workflow-automation/
```

### What `implemented: true` means (task item 22)

**Does** mean: Stitchfy's Workflow Automation capability generated and
validated a complete, vendor-neutral `WorkflowDefinition` for at least one
relevant business process. **Does not** mean: the workflow has been
deployed, connected to a real system, or is executing anywhere. No
execution engine (Temporal, Camunda, Step Functions, n8n, ...), message
broker, or workflow database is used or required — see "Future
export/provider architecture" below for how those would eventually plug in
without this distinction ever blurring.

### AS-IS vs. TO-BE

`DiscoveryResult.processes` (Phase 1) is never rebuilt — it's the AS-IS
record. `WorkflowDefinition.steps` is generated by walking
`BusinessProcess.steps` **in source order** and classifying each step with
an ordered set of deterministic rules (first match wins):

1. Approval/review language (`approv|review|escalat|exception|...`) always
   stays `human-task` — a step is never automated away just because
   something nearby mentions automation (task item 14).
2. Notification language (`send|notif|remind|alert`) in the step's own text
   → `notification`.
3. The step shares a significant keyword (≥4 letters, first-6-character
   stem, common stopwords excluded) with a discovered
   `automationCandidates` entry → `automated-task` — a deterministic string
   operation, not semantic/embedding matching, and the evidence trail
   records exactly which candidate matched.
4. Same check against `manualSteps` → stays `human-task` explicitly.
5. Fallback: an actor name mentioned in the step text → `human-task`
   (with `actorIds`); a system name only → `external-task` (with
   `systemIds`); otherwise `human-task`.

This is a conservative reading of "TO-BE": the step *sequence* is the same
as AS-IS, only individual step *classifications* are proposed for
automation, grounded in specific discovered evidence. A more aggressive
reading — restructuring/merging steps into a materially different sequence
— was rejected because it would require guessing correspondence between
prose descriptions, exactly what the task repeatedly warns against. Every
step's `evidenceRefs` traces back to the source process (and, when
classification rule 3 applied, to the specific automation candidate text).

### Decisions and human-in-the-loop

Every `WorkflowAutomationPlan.humanTouchpoint` (Phase 1.5) becomes exactly
one `WorkflowDecision` — never a speculative one. Two touchpoints that
resolve to the same underlying discovered text (a `DesiredOutcome` and its
own derived `RequirementItem` both matching approval language) are
deduplicated before this happens. Each decision gets two freshly synthesized
branch steps — "Proceed" (`automated-task`) and "Human Review"
(`human-task`, gated by a `WorkflowApproval` that wraps the existing
`HumanApprovalRequest`, never a parallel approval model) — rather than
fuzzy-matching onto an existing step. **Attribution**: touchpoints are only
attached to a specific `WorkflowDefinition` when the plan has exactly one
relevant process — with several relevant processes there is no
deterministic way to know which touchpoint belongs to which, so none are
attached rather than guessed. Both current examples have exactly one
relevant process, so this limitation isn't yet exercised in practice.

### Notifications and external systems

A notification's `channel` is set only when the *matched step's own text*
names one (`email`/`sms`/`whatsapp`/`push`); otherwise `"unknown"` — never
inferred from an unrelated system being present in the process (task item
10 is explicit about this, and both examples demonstrate it: WhatsApp is a
known system in the appointment example, but its reminder step stays
`channel: "unknown"` because the step text itself doesn't name a channel).
`WorkflowExternalSystem.role` comes from the system's own `purpose`/
`category` (already known); `interactionType` is only set to `"integration"`
when a `DiscoveryResult.integrationNeeds` entry already links to that
system — no API shape is designed (that's Phase 4).

### New, workflow-scoped information gaps

Generation can surface gaps discovery didn't have reason to ask about yet:
an unknown notification channel, an approval whose `approverRole` fell back
to the generic `"designated approver"`, or a process with no explicit
trigger. These reuse the existing `InformationGap` type (a fresh `WFGAP-`
id prefix avoids colliding with discovery's `GAP-` sequence) and live on
`WorkflowDefinition.informationGaps` — they are never merged back into
`DiscoveryResult` (capabilities read discovery, they don't mutate it).

### Validation

`workflow-definition.validator.ts` checks referential integrity (every
`actorId`/`systemId`/`processId`/`stepId` reference resolves), structural
integrity (no duplicate ids, an approval must target a `human-task` step, a
decision must target a `decision` step, a trigger must exist when the
source process had one), reachability (BFS from `steps[0]`; unreached steps
are reported as `orphan-step` warnings), and cycle detection (DFS with a
recursion stack). Because the generator never intentionally creates a
back-edge, **any** cycle found is by construction a generator bug, not a
legitimate discovered loop, so it's reported as an error — a future phase
that adds evidence-driven looping would need to relax this to only flag
cycles that aren't traceable to explicit source evidence.

### Artifact IDs

Every workflow-internal id (`WF-`, `TRIGGER-`, `STEP-`, `TRANS-`, `DEC-`,
`APPROVAL-`, `NOTIF-`, `WFGAP-`) is deterministic and sequential
(`makeIdGenerator()`, shared across every `WorkflowDefinition` generated in
one run, so ids stay unique within the execution per task item 24). The
outer `ImplementationArtifact.id` (from the pre-existing `createArtifact()`
in `framework/core/contracts/artifact.ts`) is `Date.now()`-based and *not*
deterministic — a known, low-stakes nondeterminism confined to the artifact
wrapper, not the domain objects it wraps. Left as-is per task item 24
rather than a global redesign; worth revisiting if artifacts are ever
diffed run-to-run.

### Future export/provider architecture

`WorkflowDefinition` is intentionally a pure domain model with no vendor
coupling. A future phase could add exporters — e.g.
`framework/providers/workflow/{aws-step-functions,temporal,camunda,n8n}-exporter.ts`
— each translating a validated `WorkflowDefinition` into that vendor's
format. None exist yet; today `WorkflowDefinition` only round-trips through
the JSON/Markdown artifacts described above. This keeps `domain model ≠
vendor implementation` (task item 28) — the same separation
`framework/providers/` already establishes for LLM/design/cloud providers.

## Integration Architecture (Phase 4)

Phase 0's `integrations` model (`RestApiIntegration.baseUrl`,
`WebhookIntegration.targetUrl`, `SaasIntegration.provider`, ...) assumed
implementation details Discovery rarely knows. Phase 4 replaces it with a
generic `IntegrationDefinition` and migrates selection off keyword
matching, following the exact assess → plan → generate → validate →
artifact shape Phase 3 established for workflows:

```
DiscoveryResult → CapabilityAssessment → IntegrationPlan → IntegrationDefinition[]
     → validation → ImplementationArtifact[] (JSON + Markdown + optional OpenAPI)
```

### Why assessment can't see WorkflowDefinition — and why that's fine

The `"planning"` stage computes every capability's assessment in one pass,
*before* any capability executes (Phase 1.5) — so `assessIntegrations()`
only ever sees `DiscoveryResult`: `integrationNeeds`, a process spanning
≥2 systems, a requirement typed `"integration"`, or an `"automation"`-typed
requirement/`DesiredOutcome` whose text names a real discovered system
(never a fixed keyword list — always cross-referenced against actual
`SystemInventoryItem` names). `WorkflowDefinition[]` doesn't exist until
Workflow Automation's `execute()` runs, during the later `"capabilities"`
stage. `default-capabilities.ts` already registers `workflow-automation`
before `integrations` — unchanged — so by the time Integrations'
`execute()` runs, workflow output is available in
`context.capabilityResults`, and is read there purely to **enrich**
`relatedWorkflowIds`/`operations`. The selection decision itself stays a
single, order-independent computation. This is a capability reading a
sibling's output — not the orchestrator or registry special-casing
anything; both stay exactly as generic as Phase 1.5 left them.

### `EvidenceReference` stays Discovery-only

Per its own contract, `EvidenceReference` only ever points at a
`DiscoveryResult` entity. `WorkflowDefinition` isn't one, so cross-references
to it use the dedicated `IntegrationDefinition.relatedWorkflowIds: string[]`
field instead — no change to `framework/core/contracts/evidence.ts` was
needed.

### Capturing explicit technical detail without inventing a shortcut

Neither example initially had anywhere to state "REST over HTTPS" or
"POST /v1/orders" — Discovery's `IntegrationNeed` was a single description
string. Rather than have Phase 4 parse raw Markdown (forbidden — task item
5), `IntegrationNeed` (Phase 1) gained one additive field:
`details?: Record<string,string>`. `integration-needs.extractor.ts` reads a
block under `## Integrations` the same way `processes.extractor.ts` already
reads multi-line process blocks: a plain bullet with no follow-up lines
stays exactly as before (`details: undefined` — the two existing examples'
`"Google Calendar sync"` / `"QuickBooks sync"` entries are unaffected).
A bullet followed by `Label: Value` lines (`Integration method: REST over
HTTPS`, `Endpoint: POST /v1/orders`, `Authentication: API key`) captures
them verbatim. This is Phase 1's entire job here — *capture what's
literally there, infer nothing*. Phase 4's generator then runs deterministic
regex extraction only over those captured strings:
`/rest/i`+`https?` → protocol; `/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/i`
→ method+path preserved verbatim; `/api.?key/i`/`/oauth ?2/i`/`/\bbasic\b/i`/
`/mtls/i`/`/service account/i` → auth mechanism. No field is ever set unless
its exact source string is found — see `examples/solution/api-integration.md`
for the one example that supplies this detail, versus the appointment/
invoice examples that don't.

### Source vs. target resolution

A description naming exactly one discovered system only resolves
`targetSystemId` — the internal source stays `undefined` (task item 9),
which is the normal case for both the appointment ("Google Calendar
sync") and invoice ("QuickBooks sync") examples. A description naming two
systems resolves them by **sentence position**: the first-named system is
`sourceSystemId`, the last-named is `targetSystemId` ("The Order Management
application sends orders to the Fulfillment API" → source: Order
Management, target: Fulfillment API) — a deterministic convention, not a
verb-parsing guess.

### Deduplication

Candidates are seeded only from explicit `DiscoveryResult.integrationNeeds`
— a system merely appearing in a multi-system process is supporting
evidence that *enriches* a candidate, never enough to spawn one on its own
(task item 4). Candidates naming the same resolved target system are merged
when their purpose text shares a significant keyword — `sharesSignificantWord()`,
originally written for Phase 3's step-classification overlay, now lives in
`framework/discovery/shared/section-lookup.ts` and is reused by both
capabilities rather than duplicated.

### Operations, not `WorkflowStep.systemIds`

Verified empirically (again, as in Phase 3): no step in the generated
example workflows has `systemIds` populated. Operations are instead derived
by scanning a relevant workflow's steps for the *target system's name*
appearing in the step's description text, then classifying the operation
type from a small deterministic verb-stem table
(`check/retrieve/receive/read/get`→`read`, `create/add/enter`→`create`,
`sync/synchron`→`synchronize`, `notif`→`notify`, `submit/send`→`submit`,
`update/modify`→`update`, `delete/remove`→`delete`, else `unknown`). No
operation is fabricated when no workflow is available or no step names the
system.

### Data contracts — representation, not invention

An explicit "Expected response: Order identifier and accepted status" is
split on `,`/`and` into two `DataContractField`s named exactly as written
("Order identifier", "accepted status") — never decomposed into invented
technical field names like `orderId`/`status`. `type`/`required` are never
set. `sensitivity` stays `"unknown"` unless discovery has independently
classified sensitive data (`DataEntity.sensitive`) — and even then, if a
blocking customer-data gap already exists in `DiscoveryResult.informationGaps`,
a new integration-level gap *references* it by id rather than silently
resolving it (task item 13 — see the appointment example's Google Calendar
integration, which cites gap `GAP-002` directly).

### REST/webhook specializations

`restContract`/`webhookContract` nest directly on `IntegrationDefinition`
(1:1) rather than the task sketch's separate `integrationId`-backed
objects — same information, no redundant cross-reference layer. An OpenAPI
3.x artifact (deterministic JSON, no external library) is generated only
when `restContract` has ≥1 operation with both `method` and `path` known —
true only for `examples/solution/api-integration.md`. A SaaS-categorized
system never implies a REST pattern on its own (task item 26) — `Google
Calendar` is `category: "saas"` (Phase 1) and still gets
`interactionPattern: "unknown"` in the appointment example, precisely
because nothing states the mechanism.

### `IntegrationsSection` reshaped

Same precedent as Phase 3: `restApis`/`webhooks`/`saasIntegrations`/
`dataMappings`/`retryPolicy`/`errorHandling` (Phase 0, always empty,
nothing else read them) are replaced by `plan?`/`integrations`/`artifacts`/
`notes`.

### Future provider/export architecture (Phase 4.5)

`IntegrationDefinition` stays a pure domain model. A future phase could add
exporters — e.g. a generic REST/OpenAPI exporter, or vendor-specific ones
for Google Calendar / QuickBooks / Salesforce / a custom API — each
translating a validated `IntegrationDefinition` into that target's format,
behind the existing `Provider<TConfig, TClient>` contract
(`framework/core/contracts/provider.ts`, unchanged) or a thin
`IntegrationProvider` specialization if one becomes genuinely necessary.
None exist yet — no HTTP call, OAuth flow, or credential store is anywhere
in this codebase. This keeps `domain model ≠ vendor implementation`, same
as Phase 3's workflow exporter note.

## Security, Governance and Risk Architecture (Phase 5)

Phase 0's `security-governance` model was a skeleton returning empty
string-array sections; Phase 5 makes it the third fully-generated
capability, and the first cross-cutting one — it *inspects* both of the
other two generated capabilities' output rather than producing its own
independent artifact from Discovery alone:

```
DiscoveryResult + WorkflowDefinition[] + IntegrationDefinition[]
     → security-architecture.generator.ts → SecurityArchitecture (incl. RiskAssessment[])
     → governance-plan.generator.ts       → GovernancePlan
     → security-architecture.validator.ts → referential integrity, evidence-required checks
     → security-artifact.generator.ts     → ImplementationArtifact[] (JSON + Markdown ×3)
```

### No new orchestration mechanism

Phase 4 already solved "a downstream capability needs an upstream sibling's
already-generated output": `execute()` (which runs during the later
`"capabilities"` stage, after assessment) reads
`context.capabilityResults.find(r => r.capabilityId === "...")`. Phase 5
reuses that exact pattern for *two* siblings — `workflow-automation` and
`integrations` — instead of one. `default-capabilities.ts`'s registration
order already places `security-governance` after both (unchanged), so no
`dependsOn`/`executionOrder`/`capabilityPhase` field was introduced. That
would only become worth adding if a future capability needed an ordering
guarantee the static registration order can't express — e.g. two
capabilities that both need to read each other's output, which no current
capability does.

Like Integrations, `assessSecurityGovernance()` only ever sees
`DiscoveryResult` — sensitive `DataEntity`s, a `security-governance`-tagged
Discovery gap, constraints typed `security`/`regulatory`/`data`,
requirements typed `security`, and (as a weaker, supporting-only signal)
business-rule text matching a small access/audit/retention/approval/
authentication pattern. Unlike every other assessor, a blocking gap here
never sets `status: "blocked"` — this capability's entire purpose is to
surface unresolved security-relevant facts, so a blocking gap is exactly
the kind of thing it should report *on*, not be prevented from running
because of.

### `ArchitectureReference` vs. `EvidenceReference`

`EvidenceReference` (Phase 1.5) answers "why was this decision made?" —
it points at a `DiscoveryResult` entity. Security requirements, risks, and
governance controls also need to answer a second, different question:
"what part of the *generated* solution does this apply to?" — a workflow,
a workflow step, an integration, a data contract. Conflating the two would
make it ambiguous which question either one is answering, so Phase 5 adds
a second, parallel contract, `framework/core/contracts/architecture-reference.ts`:
`{entityType: "workflow"|"workflow-step"|"integration"|"system"|
"data-contract"|"process"|"requirement"|"approval"; entityId}`. One
additive fix rides along: `EvidenceReference`'s `entityType` union never
included `"data-entity"` (a real Phase 1 entity) — added now since
data-protection requirements need to cite it.

### Trust boundary classification uses only what Phase 1 already classified

`classifyBoundary()` never invents network topology (no VPC/DMZ/public/
private/internet — those aren't in the enum at all): `targetSystemId`
unset → `"unknown"`; target system `category` is `"saas"`/`"cloud-service"`
→ `"third-party"`; otherwise `"external"`. A boundary is only generated
per `IntegrationDefinition` — no boundary is invented for a system that
merely appears in Discovery without a real integration crossing it.

### Authentication is consumed, never re-derived

`buildIntegrationDerivedRequirements()` reads
`IntegrationDefinition.authentication.mechanism` verbatim into the
generated secrets requirement's description (`"mechanism: api-key"`,
never silently upgraded to `"mechanism: OAuth2"` or downgraded to
`"unknown"`). A `mechanism` of `"unknown"` or `"none"` produces no secrets
requirement at all — Phase 4 already decided there was nothing concrete
to protect. Identity and authorization stay independent signals in
`buildIdentityAccess()`: `IDENTITY_PATTERN` (sign-in/log-in/authenticate/
credential language) and `AUTHORIZATION_PATTERN` (only...may, authorize,
permission, role, "must not be visible") are matched separately against
the same business-rule/constraint text — an identity match never spawns
an authorization requirement, or vice versa.

### Risk vs. information gap

An unresolved fact alone — "the authentication provider hasn't been
selected" — stays purely an `InformationGapReference`; Phase 5 never
promotes a bare unknown into a risk. A `RiskAssessment` is only generated
for an identified adverse *condition*: a known, non-`"none"` authentication
mechanism (credential-exposure risk — the credentials exist and need
protecting, regardless of what the mechanism is), or sensitive/unresolved
data crossing an external/third-party trust boundary (privacy risk).
Every risk's `likelihood`/`impact` is `"unknown"` — nothing here computes
or guesses a numeric score or a likelihood×impact matrix; `treatment`
(`mitigate`/`accept`/`avoid`/`transfer`/`review`) is chosen deterministically
per risk category, not inferred from a severity calculation that doesn't
exist.

### Compliance stays restrained

`ComplianceConsideration.status` is `"explicit"` only on an exact,
case-insensitive match of a known framework *name* (PCI DSS, HIPAA, SOC 2,
GDPR, CCPA, COPPA, PIPEDA, ISO 27001, HITECH) against already-structured
text (`businessRules`/`constraints`/`requirements`/`desiredOutcomes`
descriptions — never raw Markdown). `"potential"` only fires when *both* a
blocking "Customer data" gap or a sensitive `DataEntity` exists, *and* at
least one trust boundary is external/third-party — and even then, no
specific framework is ever assigned, only a generic privacy-review
rationale describing the actual matched boundary classification(s) (not a
hardcoded phrase — the rationale text is built from the real
classification so it can never claim "third-party" when the evidence says
"external").

### Human oversight and audit reuse the existing HITL model

`buildHumanOversightRequirements()` and `governance-plan.generator.ts`'s
`buildHumanOversight()` both derive from the same source Phase 3 already
generates — `WorkflowApproval` — rather than introducing a second,
competing approval model. `SecurityArchitecture` holds the security view
(a `SecurityRequirement` with `domain: "human-oversight"`); `GovernancePlan`
holds the governance-control view (`GovernanceApprovalControl`, cross-
referencing the same workflow/approval ids) — two projections of one piece
of evidence, never duplicated data. `AuditRequirement`s are generated once,
in `security-architecture.generator.ts`, and `GovernancePlan.auditRequirements`
reuses the identical array rather than regenerating it.

### `implemented: true` — what it does and doesn't mean

Same discipline as Phase 3/4: `implemented: true` means Stitchfy generated
and validated a security/governance architecture for the currently known
solution. It does **not** mean the resulting system is secure, compliant,
certified, penetration-tested, or production-ready. Every generated
artifact repeats this disclaimer verbatim. Language throughout stays
restrained — "security requirement," "consideration," "requires review/
implementation" — and never asserts "secure," "compliant," or "certified"
as an affirmative claim about the solution itself.

### Future provider/governance architecture

No real IAM, secrets manager, encryption configuration, or compliance
product integration exists anywhere in this module — `SecurityRequirement`/
`DataProtectionRequirement`/`GovernancePolicy` stay pure domain models,
same `domain model ≠ vendor implementation` line Phase 3/4 already drew.
AI Agent governance (tool-invocation policies, prompt governance, agent
memory audit) is deliberately out of scope here too — the `SecurityDomain`/
`GovernanceApprovalControl` shapes are generic enough to extend to an
AI Agent's actions once that capability exists (Phase 6), but nothing
AI-Agent-specific is implemented yet.

## Integration Export Adapter Foundation (Phase 5.5A)

The first capability output through Phase 5 is a *domain model* — never
anything executable. Phase 5.5A introduces the first layer that converts a
validated `IntegrationDefinition` into implementation-oriented TypeScript
scaffolding for a specific technical target
(`framework/capabilities/integrations/exporters/`), while keeping that
generation-time concept (`IntegrationExporter`) strictly separate from the
existing runtime concept (`IntegrationProvider`,
`framework/providers/integrations/integration-provider.types.ts`, still
unimplemented). Neither extends nor imports the other.

### Why export generation isn't inside `integrations.capability.ts`

`default-capabilities.ts` registers capabilities in this order: website,
workflow-automation, ai-agents, **integrations**, cloud,
**security-governance**, observability, modernization —
`CapabilityRegistry.getAll()` returns a `Map`'s insertion order, and
`solution-orchestrator.ts`'s capability loop runs `execute()` in that exact
order. This means `integrations.capability.ts`'s own `execute()` runs
*before* `security-governance` has run at all, so it cannot see
`SecurityArchitecture` via the usual `context.capabilityResults.find(...)`
sibling-read pattern Phase 4/5 established (that pattern only works for a
capability that has already executed) — and export readiness genuinely
needs `SecurityArchitecture` (task requirement: "Security & Governance
constraints can be examined in the generated bundle before provider
execution exists").

Rather than reordering the registry (which would break security-governance's
own dependency on already-validated `IntegrationDefinition[]`), export-bundle
generation is a pure function,
`exporters/generate-integration-exports.ts`, invoked from
`solution-orchestrator.ts` in a step positioned *after* the full capabilities
loop completes (both `integrations` and `security-governance` have executed
and been merged onto `context.solutionBlueprint`) and *before* the existing
artifact collection. It mutates `context.solutionBlueprint.integrations.exports`/
`.artifacts` — the same object reference `capabilityResults` already points
to, so the existing generic artifact-writer picks up the new files with zero
further changes. This mirrors the one precedent already in that file (the
`security-governance` special case in `mergeCapabilityOutput`) — a second,
equally-documented exception, not a new general orchestration mechanism.
`integrations.capability.ts`'s own `execute()` only initializes `exports: []`.

### Readiness — deterministic, no numeric score

`ExportReadiness.status` is one of `ready`/`needs-review`/`blocked`/
`unsupported`. `unsupported` means the exporter's `supports()` check failed
(source of truth is the `IntegrationDefinition`'s own `restContract` —
never system name or SaaS classification) — not an error, no bundle
produced at all (verified: `appointment-business.md`'s Google Calendar and
`invoice-approval.md`'s QuickBooks integrations, both `interactionPattern:
"unknown"`, produce nothing under `output/artifacts/integrations/exporters/`).
`ready` vs `needs-review` is decided by whether anything *implementation-
relevant* stays unresolved (authentication mechanism itself, or a known
mechanism with unresolved placement, or unresolved data sensitivity) — an
unknown `baseUrl` or unresolved field requiredness do **not** downgrade
status on their own, since both become safe, honestly-represented required
external configuration rather than blocking anything. `blocked` only fires
when a `SecurityRequirement` applying to the integration is both
`priority: "required"` and `status: "needs-information"` simultaneously —
verified to never fire for any of the 4 pre-existing examples, matching the
"use sparingly" instruction.

### Security is consumed, never regenerated

`assessReadiness()` filters `SecurityArchitecture.requirements`/`.risks` by
`ArchitectureReference{entityType:"integration", entityId}` — the exact same
reference shape Phase 5 already produces. Nothing here re-derives a security
requirement; it either already exists (with its own evidence chain intact)
or it doesn't. Verified against `api-integration.md`: security-governance
produces 3 `SecurityRequirement`s and 1 `RiskAssessment` referencing
`INT-001`, and the export README/manifest cite them by id.

### Content isn't duplicated three times

`IntegrationExportBundle.files: GeneratedSourceFile[]` (the shape persisted
on `IntegrationsSection.exports`) carries `{path, role, language}` only — no
`content`. `IntegrationExportBundle.artifacts` is the exact same
`ImplementationArtifact[]` pushed onto `IntegrationsSection.artifacts`
(shared object references, not copies), so the full generated source exists
exactly once per file in the final `solution-blueprint.v1.json`, in the one
place `ImplementationArtifact.content` already lives — the same precedent
`integration-artifact.generator.ts` already set by JSON-stringifying the
full `IntegrationDefinition` into a `.integration.json` artifact's content.

### The field-name-fabrication risk

`DataContractField.name` (Phase 4) is always free text split from a source
sentence — `"Order identifier"`, never a real API wire-format field name.
Naively camelCasing this into a TypeScript property name would read as
authoritative when it isn't. Every generated `types.ts` interface therefore
carries an explicit disclaiming doc-comment, plus a per-field `/** From:
"..." */` comment, saying the name is derived from source prose and unverified
against the real contract. `field.type` maps only `string`/`number`/`boolean`
verbatim; anything else (including simply unset) renders TypeScript
`unknown` — never an invented shape. `field.required === true` renders a
required property; `false` or unset both render optional (`?:`), a documented
convention, not a guess.

### Naming

`exporters/naming/typescript-identifier.ts`'s `toSafeTypeScriptIdentifier()`
splits on non-alphanumeric characters *and* camelCase/PascalCase boundaries
— "Fulfillment API" → `FulfillmentApi` (matches the task's own example
exactly), and critically, an already-camelCase source field like
`"externalOrderId"` is preserved as `externalOrderId`, not flattened to
`externalorderid` (a real bug caught during this phase's own verification —
the initial version only split on non-alphanumeric separators and silently
lowercased any single "word" with no internal separator). Collision
detection (`detectIdentifierCollisions()`) is a separate, explicit step run
by validation, not generation — generation stays deterministic and never
throws; a genuine collision is a validation error instead.

### Small additive Phase 4 changes

Four optional, backward-compatible additions to `IntegrationDefinition`
made export generation possible without touching Phase 4's existing
decisions: `AuthenticationRequirement.placement?` (explicit header/query/
cookie location — never inferred from the mechanism alone),
`RestContract.baseUrl` (the field existed since Phase 4 but nothing ever
populated it), `RestOperation.integrationOperationId?` (correlates the one
explicit REST endpoint to the one `IntegrationOperation` it produced — only
set when unambiguous, i.e. exactly one operation exists; left `undefined`
otherwise rather than guessed), and per-field `(type, required)`
parenthetical annotations reusing `DataContractField.type`/`.required`
(already in the Phase 4 schema, never previously populated). A real bug was
found and fixed while adding the last one: `splitDataPoints()`'s naive
`text.split(/,| and /i)` would have corrupted two annotated fields sharing
one line (commas inside `(...)` also get split) — fixed to be
paren-depth-aware before the annotation syntax was wired up. All four
changes are inert for the 4 pre-existing examples (none use the new syntax).

### Selection policy

`generate-integration-exports.ts`: exactly one supported exporter → assess
readiness, generate when `ready`/`needs-review` (a `blocked` bundle still
gets a diagnostic manifest/README, just no `client.ts`/`types.ts`/`config.ts`
— explainability is never discarded); zero supported exporters → no bundle;
2+ supported exporters → no bundle, a note explaining that explicit target
selection isn't implemented yet. Only one exporter exists today, so the 2+
branch is currently unreachable but documented for when a second target is
added.

## AI Agent Architecture and Governed Tool Specification (Phase 6)

Every capability through Phase 5.5A produced a domain model, never anything
executable. Phase 6 makes `ai-agents` the fourth fully-generated capability:
it identifies when a business need genuinely benefits from an AI Agent —
not merely "automation" — and generates a minimal, vendor-neutral, governed
agent architecture (tools, permissions, memory, human oversight, guardrails)
built from the same validated `WorkflowDefinition[]`/`IntegrationDefinition[]`
every other capability already trusts. No model provider is invoked; no
tool is executed.

### Execution ordering

`default-capabilities.ts` now registers: website, workflow-automation,
**integrations**, **ai-agents**, cloud, security-governance, observability,
modernization — `ai-agents` moved from its Phase 0 position (right after
workflow-automation) to after integrations, and security-governance already
sat after both. This is a pure reordering, no new dependency mechanism:

- `ai-agents.assessor.ts`'s `assessAIAgents()` only ever reads
  `DiscoveryResult` (assessment runs in the `"planning"` stage, before any
  capability executes — the same constraint every assessor has). Reordering
  registration doesn't change *when* assessment runs, only *when*
  `execute()` runs relative to siblings.
- `ai-agents.capability.ts`'s `execute()` (now running after both
  workflow-automation and integrations) reads their sibling output via
  `context.capabilityResults.find(...)` — the exact pattern Phase 4
  (integrations reading workflow-automation) and Phase 5.5A already
  established, just for two siblings instead of one.
- `security-governance.capability.ts`'s `execute()` (already running last
  among the real capabilities) *additionally* reads
  `context.capabilityResults.find(r => r.capabilityId === "ai-agents")` — a
  third sibling read alongside its existing two. No post-loop trick was
  needed this time (unlike Phase 5.5A's exporter problem): the new order
  puts security-governance strictly after ai-agents, so the ordinary
  sibling-read pattern is sufficient.

No `dependsOn`/`executionOrder` field was introduced — the third
confirmation in this project that the static registration order is
sufficient for every capability dependency encountered so far.

### `AIAgentNeed` — an explicit signal, never inferred from automation language

Discovery gained `aiAgentNeeds: AIAgentNeed[]`, captured only from a
dedicated "AI Agent Needs" section (+ aliases). `tasks: string[]` captures
every bullet verbatim, positive and negative alike — Discovery's job is
capture, not interpretation; guardrail/permission/tool derivation from that
text happens later, in the capability's own generator. `desiredCapabilities`
is classified per-bullet via a small deterministic keyword table; pattern
*order* matters — highly specific capabilities (summarization/
classification/extraction) are checked before broader ones
(retrieval/tool-use), and "conversation" is checked before both, so a
customer-facing question that happens to mention "policies" still resolves
to a conversational capability rather than a spurious retrieval one. Manual
steps, automation candidates, and multi-system processes — Workflow
Automation's own signals — are deliberately never consulted; verified
empirically against all 5 pre-existing non-AI examples, all of which
correctly produce zero AI agents.

### Tool derivation — real architecture only, with two hard-won matching fixes

A tool is only generated by matching a task bullet against a real
`IntegrationOperation`/`WorkflowStep` description. The naive approach —
reusing Phase 3/4's `sharesSignificantWord()` — produced two real, empirically-caught
false-positive classes during this phase's own verification:

1. **Generic actor words.** "The assistant may summarize a customer's
   request for the front-desk employee" incorrectly matched a workflow step
   that only happened to also mention "employee" and "customer" — words
   that appear in nearly every business-process sentence. Fixed with a
   local `sharesSpecificWord()` that excludes a small static list
   (customer, employee, assistant, business, request, provider, ...) on top
   of the existing significant-word extraction — scoped to AI tool matching
   only, not a change to the shared utility Phase 3/4 already rely on.
2. **A need's own dominant subject word.** An invoice-triage need's tasks
   almost all mention "invoice" — including the workflow step "Clerk
   manually enters invoice data into QuickBooks," which then matched *every*
   task bullet purely on that one shared word. Fixed by computing
   per-need "background words" (any stem appearing in at least half of a
   need's own task bullets) and excluding those too — a dynamic exclusion
   set specific to each `AIAgentNeed`, since a static list can't know in
   advance which subject word will dominate a given business's tasks.

A prohibited bullet ("must not confirm a conflicting appointment...") is
excluded from tool derivation entirely before any matching happens, so a
forbidden action never becomes a tool even if a same-topic operation exists.

### Autonomy — never inferred from tool existence, and negation-aware

`resolveAutonomy()` only assigns `"semi-autonomous"`/`"autonomous"` when
task text *positively* authorizes autonomous action. A second bug was
caught here too: "The assistant may not cancel appointments autonomously"
contains the word "autonomously" inside a *prohibition* — the initial
implementation scanned all task text for that word regardless of polarity,
which would have misread a denial as a grant. Fixed by scanning only
tasks that don't match the prohibition pattern. The same negation-awareness
was needed for memory: "Conversation history should not persist after the
session" contains "persist...after," which the naive persistent-memory
pattern matched directly — fixed with an explicit
`NEGATES_PERSISTENCE_PATTERN` check before accepting a persistent-memory
signal.

### Permission requires independent evidence, not just a derived tool

Task item 16's core rule: a tool existing does not imply permission. The
generator only creates an `AIAgentPermission` when the *specific task
bullet* that produced the tool match also uses grant language ("may,"
"can," "is permitted to") — derivation and permission are two independent
checks against the same evidence, not one implying the other.

### Human oversight reuses the existing HITL model — never a second approval domain

`AIAgentHumanOversight` wraps `HumanApprovalRequest` exactly as
`WorkflowApproval` already does. When a prohibited-action bullet's
oversight language ("without employee approval") matches an existing
`WorkflowApproval`'s reason, the agent's oversight entry reuses that *exact
same* `HumanApprovalRequest` object — never a duplicate. Only when no
matching workflow approval exists does the generator create a new one, via
`createApprovalRequest()`'s now-additive `id`/`timestamp` overrides (task
item 18): both are optional, defaulting to the pre-existing
`Date.now()`-based behavior, so Phase 3's two existing call sites in
`workflow-automation.planner.ts` are untouched. Generated approvals are
always `decision: "pending"` — nothing here auto-approves.

### Security & Governance consumes AI agent architecture, never regenerates it

`security-governance.capability.ts`'s `execute()` reads `AIAgentDefinition[]`
as a third sibling and passes it to two new generators
(`ai-agent-security.generator.ts`, `ai-agent-governance.generator.ts`) that
only ever *reference* the agent architecture:

- A write/notify tool gets an `"authorization"` + `"audit"`
  `SecurityRequirement` pair; a read-only tool gets neither (verified: the
  customer-support example's single, read-only "check availability" tool
  produces zero AI-specific security requirements).
- `"persistent"` memory with possibly-sensitive data gets a
  `"data-protection"` review requirement; `"session"` memory never does
  (verified against both worked examples).
- An unknown model/provider only produces a security-specific "may data be
  sent to an external provider" gap when the agent actually has a
  non-public/sensitive data surface (memory or a tool's data contract) —
  the materiality gate task item 32 asks for. This is distinct from the
  *always*-generated, non-security "which model/provider will satisfy the
  required capabilities" gap the AI Agent generator itself produces (task
  item 38: an unresolved model choice never blocks `"complete"` status, so
  that gap is informational, not a security concern by itself).
- `GovernancePlan.aiAgentControls?: AIAgentGovernanceControl[]` (additive,
  optional) cross-references the agent's own human-oversight entries and
  side-effecting tools — never a blanket "every write tool always requires
  approval" rule, only what the agent's own already-derived evidence
  supports.

`security-architecture.validator.ts`'s `checkArchitectureRef()` gained
`"ai-agent"`/`"ai-tool"` resolution (backed by an additive, defaulted
`agents: AIAgentDefinition[] = []` parameter) — existing workflow/
integration/system checks are unchanged.

### `implemented: true` — what it does and doesn't mean

Same discipline as every prior capability: `implemented: true` means
Stitchfy generated and validated vendor-neutral AI Agent architecture
specifications for the currently known solution. It does **not** mean an
LLM was executed, an AI agent was deployed, tools were invoked, outputs are
accurate, or the agent is safe, compliant, or production-ready. Every
generated artifact repeats this verbatim.

### Future work

`framework/capabilities/ai-agents/` stays a pure domain-model generator —
no `AIAgentDefinition` is ever executed. `docs/architecture/ROADMAP.md`'s
**Phase 6.5 — AI Agent Export / Runtime Adapters** documents the future
split (an Exporter producing generic tool schemas/MCP definitions/
provider-specific agent config, and separately a Runtime Provider handling
model invocation/tool execution/memory implementation/telemetry) — mirroring
the Exporter-vs-Provider boundary Phase 5.5A already established for
integrations. Neither is implemented here.

## Observability and Operational Architecture (Phase 7A)

`observability` was the last Phase 0 skeleton with an unstructured
string-array model (`logging: string[]`, `metrics: string[]`, ...). Phase 7A
makes it the sixth fully-generated capability, and the second
cross-cutting one: it inspects `WorkflowDefinition[]`, `IntegrationDefinition[]`,
`AIAgentDefinition[]`, `SecurityArchitecture`, and `GovernancePlan` — every
other real capability's output — and produces a vendor-neutral operational-
observability specification: what needs to be observable and why, never
actual telemetry.

### No registry change needed — the fourth confirmation

`default-capabilities.ts`'s order (website, workflow-automation,
integrations, ai-agents, cloud, **security-governance, observability**,
modernization) already placed `observability` strictly after every
capability it needs to consume, before this phase began. `execute()` reads
all four as siblings via `context.capabilityResults.find(...)` — the exact
pattern Phase 4/5/6 already established, extended to four reads instead of
one/two/three. No `dependsOn`/`executionOrder` field was introduced — the
fourth time in this project the static registration order alone has been
sufficient for every capability dependency encountered.

`assessObservability()` itself only ever reads `DiscoveryResult` (assessment
runs in the `"planning"` stage, before any capability executes — the same
constraint every assessor has). Its signals are necessarily structural
proxies — a multi-step `BusinessProcess`, an `IntegrationNeed`, an
`AIAgentNeed`, or explicit operational terminology in already-structured
requirement/constraint/business-rule text — since the real
`WorkflowDefinition[]`/`IntegrationDefinition[]`/`AIAgentDefinition[]` don't
exist yet at that stage. The richer, decisive analysis (which signals,
metrics, alerts actually get generated) happens entirely in `execute()`,
once the real architecture is available.

### Workflow signal policy — explosion avoidance is deliberate

A workflow gets a baseline `started`/`completed`/`failed` event trio, plus
one event per `WorkflowDecision`, per `WorkflowApproval` (request +
outcome), and per `WorkflowNotification` — but **not** one signal per plain
`WorkflowStep`. An external-task step's operational visibility is already
covered by the matching `IntegrationOperation`'s own attempt/success/
failure signals (built separately, from the Integration side) — duplicating
that at the workflow-step level would explode the signal count for zero
additional evidence. Decisions/approvals/notifications get individual
signals because they represent genuinely distinct operational facts a plain
step traversal doesn't.

### AI telemetry — metadata-only by construction, not by a runtime filter

The AI-signal builder (`aiAttrs()` in
`observability-architecture.generator.ts`) only ever emits from a fixed,
small set of operational identifiers — `agentId`, `toolId`, `outcome`,
`escalationReason`. The function has no code path that reads message/
response/prompt/conversation *content* at all, only real architecture ids
— so there is structurally nothing to leak, not merely nothing that
happened to survive an exclusion list. The validator's payload-attribute
denylist (`message`, `response`, `prompt`, `body`, `payload`, `content`,
`conversation`) is defense-in-depth verification of that guarantee, not the
mechanism that provides it.

### A real naming collision, caught and fixed during verification

Phase 6's `AIAgentToolSpecification.name` is set to the same display name
as the underlying `IntegrationOperation` it wraps (`kind:
"integration-operation"`). A first version of this generator's tool-
invocation signal name (`"${tool.name} ${outcome}"`) therefore collided
textually with the integration-operation signal for the exact same real-
world event (verified empirically: `customer-support-agent.md`'s "check
availability" tool produced a signal-name collision the validator's own
collision-detection rule correctly caught, which is what surfaced the bug).
Fixed by prefixing tool-invocation signal names with `"Tool invocation: "`
— the two signals describe related-but-distinct facts ("the operation
happened" vs. "the agent specifically invoked it"), so both are kept, just
disambiguated.

### No numeric threshold is ever fabricated — the threshold-provenance rule

`OperationalObjective.targetValue` and `AlertRequirement.threshold` are
only populated when a dedicated regex (`PERCENT_PATTERN`/`TIME_PATTERN`/
`COUNT_THRESHOLD_PATTERN`) finds a real, already-structured percentage/
time/count value in `RequirementItem`/`Constraint`/`BusinessRule` text —
never raw Markdown, never a default. `observability.validator.ts`
independently re-checks this: any object carrying a concrete threshold-
shaped string must have a non-empty `evidenceRefs`, and any threshold-
shaped value on an object marked `explicit: false` is rejected outright —
so even a future generator regression that tried to slip in a threshold
without evidence, or mislabel a derived one as explicit, would fail
validation rather than silently pass through.

### Alerts stay narrow — explicit text or approval-significance only

An `AlertRequirement` is only ever generated from (a) explicit operational
text matching alert/notification language (the stated threshold/condition
is preserved verbatim), or (b) a workflow's approval-required step (treated
as inherently operationally significant — a pending human decision).
Nothing else produces an alert; a plain integration or a workflow with no
approval produces zero alerts, deliberately avoiding the "one alert per
signal" explosion the task's own instructions warned against. An alert with
an unresolved `destination`/`threshold` always surfaces a matching
`InformationGap` rather than leaving the gap silent.

### Security & Governance consumed, never re-derived

A `SecurityRequirement` with `domain: "secrets"` becomes a
`LogRequirement.prohibitedData` entry ("credential/API-key material")
attached to the relevant integration's signals. A `DataProtectionRequirement`
with any classification other than `public`/`internal` (i.e. `confidential`,
`restricted`, or still `unknown`) becomes a `TelemetryRequirement` stating
telemetry must avoid recording the associated payload until classification/
logging policy is resolved — both cite the exact originating Phase 5
requirement via `evidenceRefs`, never duplicating or reinventing it.
`AuditTelemetryMapping` links a real `AuditRequirement` (from
`SecurityArchitecture.auditRequirements` — the same objects
`GovernancePlan.auditRequirements` already reuses per Phase 5) to whichever
signals' `source` actually overlaps that requirement's `appliesTo` — a
mapping is only created when at least one matching signal exists, never an
empty placeholder.

### Correlation, never distributed tracing

`CorrelationRequirement.architecturePath` describes a vendor-neutral
"these components should be correlatable" fact — workflow↔integration (via
`IntegrationDefinition.relatedWorkflowIds`), workflow↔agent (via
`AIAgentDefinition.relatedWorkflowIds`), and agent↔tool↔integration (via a
tool with `kind: "integration-operation"`). No W3C Trace Context,
OpenTelemetry `traceparent`, AWS X-Ray, or Datadog trace-ID format appears
anywhere — "cross-component correlation" is the entire vocabulary, exactly
as specified; a future exporter decides whether that becomes distributed
tracing.

### Two audit trails, never conflated

Stitchfy's own capability-execution audit trail
(`framework/governance/audit/audit-logger.ts`) records what *Stitchfy*
did while generating a solution. `AuditTelemetryMapping` is about whether
the *generated business solution* itself will be auditable at runtime —
an entirely different, and much more important, question this capability
answers by mapping real `AuditRequirement`s to real signals. The two are
never mixed.

### `implemented: true` — what it does and doesn't mean

Same discipline as every prior capability: means Stitchfy generated and
validated a vendor-neutral observability and operational architecture for
the currently known solution. It does **not** mean telemetry is being
collected, logging exists, dashboards are deployed, alerts are active,
tracing is installed, an SLO is being met, or production operations are
ready. Every generated artifact repeats this verbatim.

### Future work

`docs/architecture/ROADMAP.md` splits future work into **Phase 7B —
Vendor-Neutral Cloud Architecture** (deployment/runtime topology — after
which infrastructure metrics like CPU/memory/pod counts become meaningful,
deliberately excluded here since no compute architecture exists yet) and
**Phase 7C — Cloud / Observability Export & Provider Adapters** (an
Exporter producing OpenTelemetry instrumentation plans/Prometheus rules/
Grafana dashboards/CloudWatch alarms/Datadog monitors, and separately a
Runtime Provider for actual telemetry/configuration APIs) — mirroring the
Exporter-vs-Provider boundary Phases 5.5A/6.5 already established. Neither
is implemented here.

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

**Phase 3** reshaped `WorkflowAutomationSection` rather than extending it:
the Phase 0 leftover flat `triggers`/`steps`/`decisions`/`approvals`/
`notifications`/`externalSystems` arrays (always `[]`; nothing else in the
codebase read them — verified before removing) were replaced by
`workflows: WorkflowDefinition[]` + `artifacts: ImplementationArtifact[]`,
per the task's own item 21 sketch. This is safe because `SolutionBlueprint.automation`
is optional with no external consumer yet — not a v1 compatibility break.
`solution-orchestrator.ts` gained one generic step after the capabilities
loop: any `CapabilityExecutionResult.output.artifacts` array (duck-typed,
no capability-ID branching) is written via the new
`framework/core/artifact-writer.ts`. `framework/orchestrator/orchestrator.ts`
(website pipeline) was not touched.

**Phase 4** reshaped `IntegrationsSection` the same way (Phase 0's
`restApis`/`webhooks`/`saasIntegrations`/`dataMappings`/`retryPolicy`/
`errorHandling` → `plan?`/`integrations`/`artifacts`/`notes`). The one
Phase 1 discovery file touched: `IntegrationNeed` gained an additive,
optional `details?: Record<string,string>` field (see "Integration
Architecture" above) — existing single-line `## Integrations` entries are
unaffected (`details` stays `undefined`), verified against the existing
appointment/invoice examples. `workflow-definition.generator.ts`'s local
`significantWords`/`sharesSignificantWord` helpers moved to the shared
`framework/discovery/shared/section-lookup.ts` (Phase 4 needed the same
technique for candidate deduplication) — a pure refactor, same behavior,
now used by both capabilities instead of duplicated.
`framework/orchestrator/{orchestrator.ts,solution-orchestrator.ts}`,
`framework/core/registry/*`, and `framework/core/registry/capability-registry.ts`
were **not** touched — Integrations reads Workflow Automation's sibling
output directly (see above), so no orchestration change was needed for
cross-capability data to flow.

See `docs/architecture/ROADMAP.md` for what comes next.
