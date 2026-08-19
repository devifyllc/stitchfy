# Stitchfy Roadmap

## Phase 0 — Architecture Foundation ✅ done

- Core contracts: `SolutionContext`, `StitchfyCapability`, generic `Agent`,
  `ImplementationArtifact`, `Provider`.
- `CapabilityRegistry` + `createDefaultRegistry()`.
- `SolutionBlueprint` v1 types + Zod schema.
- Business discovery (`BusinessContext` + a real deterministic extraction
  agent).
- Governance/HITL domain model (`HumanApprovalRequest`, policies,
  guardrails, audit logger wired into the capability runner).
- 8 capability module skeletons; **website** fully wired as a real adapter
  over the existing pipeline, the other 7 as typed placeholders with
  keyword-heuristic `supports()`.
- New `solution-orchestrator.ts` + `npm run solution` CLI, additive
  alongside the untouched `orchestrator.ts` + `npm run stitchfy`.
- `docs/architecture/ARCHITECTURE.md` (this roadmap's companion).

## Phase 1 — Business Discovery ✅ done

- `DiscoveryResult` (`framework/discovery/discovery-result.types.ts`) as the
  new source of truth; `BusinessContext` kept shape-compatible as a derived
  projection (`deriveBusinessContext`) so Phase 0's 7 keyword-matching
  capabilities needed zero edits.
- Provenance (`framework/core/contracts/provenance.ts`:
  `SourceReference`/`DiscoveryMetadata`) on every discovery entity —
  explicit vs. deterministically-derived is always distinguishable; nothing
  is silently presented as a fact it isn't.
- Real, deterministic extraction for goals, pain points, desired outcomes,
  actors, business processes (a general blank-line/label-chunk parser —
  `processes.extractor.ts`), requirements (explicit-section-or-derived),
  system inventory (deterministic category classification, never-guessed
  technology), constraints, business rules, data entities, and integration
  needs. `framework/discovery/{processes,systems,constraints,requirements}/`
  are no longer empty stubs.
- `InformationGap` model + deterministic gap detection
  (`information-gaps.extractor.ts`), including a data-sensitivity gap when
  customer data is mentioned without an explicit Data section.
- `TraceabilityLink` model + extraction from relation IDs already present on
  typed objects (`traceability.extractor.ts`) — zero dangling links,
  covered by tests.
- `SolutionBlueprint.{requirements,processes,actors,systems,constraints}`
  are now populated from real discovery output; added optional
  `businessRules`/`informationGaps`/`traceability` fields (schemaVersion
  stays "1.0" — purely additive).
- New example `examples/solution/appointment-business.md` + `npm run test`
  (Node's built-in test runner) covering the 8 scenarios from the Phase 1
  task — see `tests/discovery.test.ts`.
- LLM enrichment extension point documented (ARCHITECTURE.md), not wired to
  a call site — see Phase 1.5.
- Capability `supports()` heuristics were **not** changed — see Phase 1.5
  and ARCHITECTURE.md "Capability Selection Evolution".

## Phase 1.5 — Explainable Solution Planning and Capability Selection ✅ done

- `CapabilityAssessment` / `AssessmentReason` / `EvidenceReference`
  (`framework/planning/capability-assessment/`, `framework/core/contracts/evidence.ts`)
  — explainable, evidence-backed, no numeric score.
- `StitchfyCapability.assess?()` added additively; `supports()` unchanged in
  signature and still what `capability-runner.ts` gates execution on.
  Capabilities without `assess()` fall back to `legacyKeywordAssessment()`
  (tagged `method: "legacy-keyword"`) — zero capability-ID branching in the
  registry or orchestrator.
- **Workflow Automation** is the first capability with real structured
  `assess()`/`plan()`/`execute()` (`workflow-automation.assessor.ts` +
  `.planner.ts`) — reads `DiscoveryResult.processes/requirements/desiredOutcomes/informationGaps`
  directly; `supports()` delegates to the same assessor (one source of
  truth). The other 7 capabilities are unchanged (still legacy-keyword).
- `SolutionPlan` / `SolutionDecision`
  (`framework/planning/capability-assessment/solution-plan.ts`) — a pure
  function from assessments to decisions; new `"planning"` stage in
  `solution-orchestrator.ts` runs it once, before any capability executes.
- `RequirementItem.relatedOutcomeIds` — a derived requirement now keeps a
  deterministic `"derived-from"` link back to the `DesiredOutcome` that
  produced it (no fuzzy matching needed; the extractor already had the
  outcome in scope).
- `SolutionBlueprint.planning?: SolutionPlan` (additive, `schemaVersion`
  stays `"1.0"`); `WorkflowAutomationSection.plan?: WorkflowAutomationPlan`.
- `output/reports/solution-plan.md` — human-readable, rendered directly from
  the already-computed `SolutionPlan`/`DiscoveryResult` (task item 16 — no
  decision is recomputed in the report layer).
- `tests/planning.test.ts` — the 9 scenarios from the Phase 1.5 task
  (selection, no-keyword-dependency, explainability, referential integrity,
  derived traceability, legacy/website compatibility, no-false-positive,
  HITL).

**Still deferred** (unchanged from the original Phase 1.5 scope, intentionally):

- Requirement ↔ process correlation beyond explicit shared ids
  (`RequirementItem.relatedProcessIds` stays `[]` — no fuzzy matching).
- Constraint cross-referencing to processes/requirements.
- Actually wiring an LLM enrichment call behind `framework/providers/llm/`
  (the extension point is typed/documented, not implemented).
- An interactive gap-resolution flow (`InformationGap` is data-only today).
- Migrating any of the other 7 capabilities to `assess()` — see the
  evolution table in ARCHITECTURE.md; the next one to migrate is whichever
  capability Phase 3+ actually implements.

## Phase 2 — Website Capability Migration

- Move `framework/agents/*`, `site-generator.ts`, `stitch-generator.ts`
  under `framework/capabilities/website/{agents,generators,validators}/`
  without changing behavior.
- Decide whether `WebsiteBlueprint` becomes a capability-owned schema
  referenced by `SolutionBlueprint`, or stays fully independent.

## Phase 3 — Workflow Automation

Selection and planning are already real as of Phase 1.5
(`workflow-automation.assessor.ts`/`.planner.ts`,
`WorkflowAutomationSection.plan`, `HumanTouchpoint` via
`framework/governance/approvals`). What's still `implemented: false` and
left for this phase:

- Real `triggers`/`steps`/`decisions`/`approvals` (the legacy
  `WorkflowAutomationSection` fields, distinct from `.plan`) derived from
  `WorkflowAutomationPlan.automationCandidates`/`humanTouchpoints`.
- Turning `AutomationCandidate`/`HumanTouchpoint` into actual generated
  implementation artifacts, not just a plan.

## Phase 4 — Integration Architecture

- Real REST/webhook/SaaS integration derivation from
  `BusinessContext.integrations` + `existingSystems`.
- First real `IntegrationProvider` implementation
  (`framework/providers/integrations/`).

## Phase 5 — AI Agent Architecture

- Real `AIAgentDefinition` generation: tool specs, memory strategy,
  guardrails, confidence/risk thresholds.
- Wire `humanApproval` generation into `framework/governance/approvals`
  end-to-end (not just the type).

## Phase 6 — Security / Governance

- Real `security-governance.capability.ts` output derived from
  `DiscoveryResult.businessRules`/`constraints`/`dataEntities` (using
  `dataEntities[].sensitive`, already computed in Phase 1) plus the existing
  `detectComplianceFlags`-style pattern from `intake.agent.ts`.
- Real `RiskAssessment[]` in `planning/risk-assessment/risk-assessment.ts`
  instead of an empty stub.

## Phase 7 — Cloud / Observability

- First concrete `CloudProvider` adapter (behind
  `framework/providers/cloud/`, vendor selectable, not hardcoded).
- Real logging/metrics/tracing/alerting recommendations tied to whichever
  capabilities are active in a given solution.

## Phase 8 — Legacy Modernization

- Real system inventory + migration-candidate derivation.
- First use of `SystemInventoryItem` populated from actual discovery input
  rather than manual/empty.

## Phase 9 — Reference Implementations

- One worked example per non-website capability under `examples/`, and a
  matching template under `templates/`, once that capability has a real
  `execute()`.
- End-to-end docs walkthrough: project.md → solution-blueprint.v1.json →
  generated artifacts for at least one non-website capability.
