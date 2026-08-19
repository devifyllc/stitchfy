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

## Phase 3 — Workflow Automation Specification Generation ✅ done

Selection and planning were already real as of Phase 1.5. This phase made
generation real: `implemented: true` now means Stitchfy generated and
validated a vendor-neutral `WorkflowDefinition` — never that it runs
against real systems (see ARCHITECTURE.md "Workflow Specification
Generation" for the full design).

- `WorkflowDefinition` (`framework/capabilities/workflow-automation/schemas/workflow-automation.types.ts`)
  — triggers, steps, transitions, decisions, approvals, notifications,
  external systems, workflow-scoped information gaps, evidence, and a
  deterministic `draft | needs-review | complete` status.
- `generators/workflow-definition.generator.ts` — one `WorkflowDefinition`
  per relevant `BusinessProcess` (never a single business-wide workflow);
  AS-IS (`DiscoveryResult.processes`) is never rebuilt, TO-BE is a
  per-step, evidence-grounded overlay.
- `validators/workflow-definition.validator.ts` — referential integrity,
  structural integrity, reachability (orphan detection), and cycle
  detection, independent of the Zod shape check.
- `generators/workflow-artifact.generator.ts` — JSON + Markdown (with an
  inline Mermaid diagram, no runtime dependency) `ImplementationArtifact`s
  per workflow, written to `output/artifacts/workflow-automation/` by the
  new generic `framework/core/artifact-writer.ts`.
- `WorkflowAutomationSection` reshaped: `workflows`/`artifacts` replace the
  Phase 0 leftover always-empty flat arrays.
- Second example, `examples/solution/invoice-approval.md` — structurally
  different from the appointment example (manual entry, threshold-based
  decision, distinct approver, different systems) — proves the generator
  is generic, not appointment-specific.
- `tests/workflow-generation.test.ts` — the 15 scenarios from the Phase 3
  task (37 tests total passing across all three suites).

**Still deferred** (unchanged in spirit from Phase 1.5's list, now
Phase-3-specific):

- Multi-process `HumanTouchpoint` attribution (only unambiguous when
  exactly one process is relevant — see ARCHITECTURE.md).
- Any real vendor exporter (`WorkflowDefinition` → AWS Step Functions /
  Temporal / Camunda / n8n / ...) — the extension point is documented, not
  implemented; see ARCHITECTURE.md "Future export/provider architecture".
- Deterministic `ImplementationArtifact.id` generation (currently
  `Date.now()`-based, confined to the artifact wrapper — documented, not
  fixed, per task item 24).

## Phase 4 — Integration Architecture and Contract Specification ✅ done

Selection migrated off legacy keyword matching; generation, validation, and
artifacts are now real (see ARCHITECTURE.md "Integration Architecture" for
the full design).

- `IntegrationDefinition` (`framework/capabilities/integrations/schemas/integrations.types.ts`)
  — vendor-neutral: direction, interaction pattern, protocol, operations,
  data contracts, authentication, reliability, security, optional REST/
  webhook specializations, workflow-scoped information gaps, evidence, and
  a deterministic `draft | needs-review | complete` status. Replaces the
  Phase 0 `RestApiIntegration`/`WebhookIntegration`/`SaasIntegration` model.
- `integrations.assessor.ts` — structured signals only
  (`DiscoveryResult.integrationNeeds`, multi-system processes, requirement/
  outcome text naming a real discovered system) since `WorkflowDefinition`
  isn't available at planning time; `execute()` separately enriches with
  Workflow Automation's sibling output once available.
- `integrations.planner.ts` — `IntegrationPlan` with deduplicated
  candidates (same keyword-overlap technique as Phase 3, now shared via
  `framework/discovery/shared/section-lookup.ts`); deterministic
  source/target resolution from sentence position when two systems are
  named together.
- `generators/integration-definition.generator.ts` — deterministic regex
  classification only over explicitly captured text; everything defaults
  to `"unknown"` otherwise. `IntegrationNeed.details` (Phase 1, additive)
  is where that explicit text comes from.
- `validators/integration-definition.validator.ts` — referential
  integrity, same-system-boundary rejection, evidence presence, operation↔
  contract integrity, plus `detectDuplicateIntegrations()`.
- `generators/integration-artifact.generator.ts` — JSON + Markdown (with
  Mermaid) always; an OpenAPI 3.x artifact only when an explicit method+path
  exists.
- Third example, `examples/solution/api-integration.md` — explicit REST
  method/endpoint/auth, contrasting the appointment/invoice examples'
  `needs-review` status with a `complete` one where nothing is unknown.
- `tests/integration-generation.test.ts` — the 16 scenarios from the Phase
  4 task (53 tests total passing across all four suites).

**Still deferred — see Phase 5.5 below:**

- Real vendor clients (Google Calendar, QuickBooks, WhatsApp, Stripe,
  Salesforce, ...) — none exist; no HTTP call is made anywhere in this
  codebase.
- OAuth2/API-key flows, credential/secret storage.
- Concrete exporters translating a validated `IntegrationDefinition` into a
  vendor's actual API shape (beyond the generic OpenAPI artifact already
  generated when justified).
- Actual HTTP calls, webhook receivers, retries, message brokers, or any
  integration runtime.
- Multi-integration source/target disambiguation when more than two
  systems are named in one description (today's sentence-position
  convention only handles exactly two).

## Phase 5 — Security, Governance and Risk Architecture ✅ done

The third fully-generated capability, and the first cross-cutting one:
`security-governance` now inspects the already-generated
`WorkflowDefinition[]`/`IntegrationDefinition[]` (not raw Markdown) rather
than only `DiscoveryResult`, deliberately brought forward before any real
provider/exporter implementation — see ARCHITECTURE.md "Security,
Governance and Risk Architecture" for the full design, and rationale for
why provider-specific, increasingly executable artifacts should only be
generated after security, data-protection, auditability, and governance
requirements can be represented explicitly.

- `SecurityArchitecture` (`framework/capabilities/security-governance/schemas/security-governance.types.ts`)
  — requirements (identity/authorization/data-protection/secrets/
  integration/audit/privacy/human-oversight/unknown domains), trust
  boundaries, data protection requirements, integration security rollups,
  audit requirements, real `RiskAssessment[]`, referenced/new information
  gaps, and a deterministic `draft | needs-review | complete` status.
  Replaces the Phase 0 skeleton.
- `GovernancePlan` — human oversight controls, decision controls (one per
  significant workflow decision), policies (one per `BusinessRule`),
  explicit-vs-potential `ComplianceConsideration`s, reused audit
  requirements.
- `RiskAssessment` (`framework/planning/risk-assessment/risk-assessment.types.ts`)
  evolved from the Phase 0 placeholder (never populated by anything real)
  to a real model: category, `likelihood`/`impact` as
  `low|medium|high|"unknown"` (never a numeric score), treatment, related
  architecture references, evidence references, status.
- `ArchitectureReference` (`framework/core/contracts/architecture-reference.ts`)
  — new, distinct from `EvidenceReference`: answers "what part of the
  generated architecture" rather than "why was this decided."
- `security-governance.assessor.ts` — structured Discovery-only signals
  (sensitive data entities, security-tagged gaps, security/regulatory/data
  constraints, security-typed requirements, governance-language business
  rules); never blocked by its own blocking gaps, since surfacing them is
  the point.
- `generators/security-architecture.generator.ts` +
  `generators/governance-plan.generator.ts` — cross-capability generation
  reading `context.capabilityResults` for workflow-automation and
  integrations output, reusing the exact sibling-output pattern Phase 4
  introduced (no new `dependsOn`/`executionOrder` mechanism needed — the
  existing registration order already provides it).
- `validators/security-architecture.validator.ts` — referential integrity,
  same-system-boundary rejection, evidence-required checks for
  `SecurityRequirement`/`RiskAssessment`, workflow/approval/decision
  reference checks for governance controls.
- `generators/security-artifact.generator.ts` — 6 artifacts
  (`security-architecture.json/.md`, `risk-register.json/.md`,
  `governance-plan.json/.md`) under `output/artifacts/security-governance/`,
  each repeating the `implemented: true` disclaimer verbatim.
- Fourth example, `examples/solution/customer-data-workflow.md` —
  identity/authorization/human-approval-governance/audit/unresolved-
  auth-provider-gap generation, selectable without the literal words
  "security"/"governance"/"cybersecurity" appearing anywhere in it.
- `tests/security-governance.test.ts` — the scenarios from the Phase 5
  task (sensitive-data risk, unknown classification, authentication
  preservation, unknown auth, identity/authorization separation, vendor-
  neutral secrets language, trust boundary classification, no invented
  topology, human oversight, audit, compliance restraint, explicit
  compliance, risk without a fabricated score, unknown likelihood, risk-
  vs-gap distinction, referential integrity, cross-capability dependency,
  artifacts, traceability, backward compatibility).

**Still deferred, intentionally:**

- No real IAM, secrets manager, or encryption configuration — domain
  models only.
- No AI Agent governance instantiation (only structural extensibility —
  `SecurityDomain`/`GovernanceApprovalControl` are generic enough to cover
  an AI Agent's actions once that capability exists).
- No orchestrator restructuring beyond capabilities reading
  `context.capabilityResults` for sibling output — `orchestrator.ts` (the
  website pipeline) stays untouched.

## Phase 5.5 — Integration Provider / Export Adapters

Formalizes what Phase 4's "Still deferred" section already scoped out —
now placed after Security & Governance rather than immediately after
Integrations, since provider-specific, increasingly executable artifacts
should be generated only once security, data-protection, auditability, and
governance requirements can be represented explicitly for whatever they'd
be built on top of.

- Real vendor clients (Google Calendar, QuickBooks, WhatsApp, Stripe,
  Salesforce, ...) — none exist; no HTTP call is made anywhere in this
  codebase.
- OAuth2/API-key flows, credential/secret storage, token refresh.
- Concrete exporters translating a validated `IntegrationDefinition` into a
  vendor's actual API shape (beyond the generic OpenAPI artifact already
  generated when justified).
- Actual HTTP calls, webhook receivers/runtime, retries, message brokers.
- Real IAM configuration, cloud security groups, WAF rules, or any concrete
  encryption configuration — `SecurityRequirement`/`DataProtectionRequirement`
  stay pure domain models until this phase.
- Multi-integration source/target disambiguation when more than two
  systems are named in one description.

## Phase 6 — AI Agent Architecture

- Real `AIAgentDefinition` generation: tool specs, memory strategy,
  guardrails, confidence/risk thresholds.
- Wire `humanApproval` generation into `framework/governance/approvals`
  end-to-end (not just the type).
- AI Agent-specific governance controls built on top of Phase 5's generic
  `SecurityDomain`/`GovernanceApprovalControl` extensibility (tool-
  invocation policies, prompt governance, agent memory audit) — none of
  which are implemented yet.

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
