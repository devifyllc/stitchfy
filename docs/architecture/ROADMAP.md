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

## Phase 5.5A — Integration Export Adapter Foundation ✅ done

The first layer that converts a validated `IntegrationDefinition` into
implementation-oriented artifacts — deliberately placed after Security &
Governance (not immediately after Integrations) so export readiness can
consume real `SecurityRequirement`/`RiskAssessment` data, never a generic
checklist. See `docs/architecture/ARCHITECTURE.md` "Integration Export
Adapter Foundation (Phase 5.5A)" for the full design, and
`framework/capabilities/integrations/exporters/README.md` for the
Exporter/Provider boundary.

- `IntegrationExporter` contract + `IntegrationExporterRegistry`
  (`framework/capabilities/integrations/exporters/`) — deliberately
  separate from `IntegrationProvider` (still unimplemented); adding a new
  export target is a `register()` call, never a switch statement.
- First concrete exporter: `generic-rest-typescript` — supports an
  `IntegrationDefinition` only via its explicit `restContract`, never
  system name or SaaS classification.
- `ExportReadiness` (`ready`/`needs-review`/`blocked`/`unsupported`, no
  numeric score) — security-aware: consumes (never regenerates)
  `SecurityArchitecture.requirements`/`.risks` applying to the integration.
- Generated bundle: `client.ts` (transport-abstracted, every method throws
  `"Transport implementation not configured."`), `types.ts` (request/
  response interfaces from real `DataContract`s only, every field
  disclaiming that names are derived from source prose), `config.ts`
  (credential *shape* only, never a value), `integration.manifest.json`,
  `README.md` — 5 files under
  `output/artifacts/integrations/exporters/<slug>/<target>/`.
- Small additive, backward-compatible Phase 4 extensions:
  `AuthenticationRequirement.placement?`, `RestContract.baseUrl` (existed,
  never populated), `RestOperation.integrationOperationId?` (unambiguous
  correlation only), per-field `(type, required)` annotations reusing
  `DataContractField.type`/`.required`.
- Export-bundle generation runs as a post-capabilities-loop step in
  `solution-orchestrator.ts` (`generate-integration-exports.ts`), not
  inside `integrations.capability.ts`'s own `execute()` — see
  ARCHITECTURE.md for why (security-governance registers after
  integrations, so `SecurityArchitecture` doesn't exist yet at that point).
- Fourth example, `examples/solution/rest-export-ready.md` — fully explicit
  (base URL, method+path, auth mechanism + placement, typed/required
  request+response fields) — proves readiness can reach `ready` purely from
  explicit information; `api-integration.md` stays `needs-review` (API-key
  placement genuinely unresolved); `appointment-business.md`/
  `invoice-approval.md` produce no export bundle at all (unsupported, not
  an error).
- `tests/integration-export.test.ts` — registry, support/readiness across
  all 4+1 examples, method/path preservation, unknown-value preservation
  (base URL, auth placement, field types/requiredness), no fabricated
  fields, security/risk id propagation, secret-literal rejection, method-
  name collision detection, manifest/bundle integrity, zero network calls,
  Exporter/Provider separation.

**Still deferred — Phase 5.5B:**

## Phase 5.5B — Runtime Integration Providers

- Real vendor clients (Google Calendar, QuickBooks, WhatsApp, Stripe,
  Salesforce, ...) — none exist; no HTTP call is made anywhere in this
  codebase.
- An actual implementation of `IntegrationProvider.call()` — real
  `HttpTransport` implementation for the scaffolding Phase 5.5A generates.
- OAuth2/API-key flows, credential/secret storage, token refresh,
  environment-secret reading.
- Concrete exporters translating a validated `IntegrationDefinition` into a
  vendor's actual API shape (beyond the generic OpenAPI artifact already
  generated when justified), and additional export targets (java, openapi,
  webhook-typescript, aws-lambda, azure-function, vendor-specific targets)
  plus explicit multi-target selection when an integration matches more
  than one registered exporter.
- Actual HTTP calls, webhook receivers/runtime, retries, timeouts, circuit
  breakers, message brokers.
- Real IAM configuration, cloud security groups, WAF rules, or any concrete
  encryption configuration — `SecurityRequirement`/`DataProtectionRequirement`
  stay pure domain models until this phase.
- Multi-integration source/target disambiguation when more than two
  systems are named in one description.

## Phase 6 — AI Agent Architecture and Governed Tool Specification ✅ done

The fourth fully-generated capability — identifies when a business need
genuinely benefits from an AI Agent (never merely "automation") and
generates a minimal, vendor-neutral, governed agent architecture from the
same validated `WorkflowDefinition[]`/`IntegrationDefinition[]` every other
capability trusts. See `docs/architecture/ARCHITECTURE.md` "AI Agent
Architecture and Governed Tool Specification" for the full design,
including the execution-ordering change and two real matching bugs caught
and fixed during this phase's own verification.

- `AIAgentNeed` (`framework/discovery/ai-agents/`) — a new Discovery entity
  captured only from a dedicated "AI Agent Needs" section; never inferred
  from generic automation/workflow/integration language.
- `default-capabilities.ts` reordered: ai-agents now registers after
  integrations (previously right after workflow-automation) — a pure
  reordering, no new dependency mechanism, mirroring how Phase 4/5.5A
  already solved the same class of problem.
- `AIAgentDefinition` v1 (`framework/capabilities/ai-agents/schemas/`) —
  replaces the Phase 0 model's mandatory `modelProvider`/`model`/
  `confidenceThreshold: number`/`riskThreshold: string` with a vendor-
  neutral, unknown-preserving model: `AIModelRequirements` (provider/model
  optional, never chosen by the architecture), `AIAgentToolSpecification`
  (derived only from a real `IntegrationOperation`/`WorkflowStep`),
  `AIAgentPermission` (requires independent grant-language evidence beyond
  tool derivation), `AIAgentMemoryStrategy` (never defaults to persistent),
  `AIAgentGuardrail` (from real prohibitions, never generic filler),
  `AIConfidencePolicy`/`AIAgentRiskPolicy` (no fabricated numeric
  threshold), `AIAgentHumanOversight` (wraps the existing
  `HumanApprovalRequest`, never a competing approval domain).
- `ai-agents.assessor.ts`/`.planner.ts` — structured selection; one
  `AIAgentCandidate` per `AIAgentNeed` by default, with no multi-agent
  splitting logic implemented (deferred and documented, not half-built) —
  directly enforces "prefer the minimum number of agents necessary."
- `generators/ai-agent-definition.generator.ts` — tools/permissions/memory/
  guardrails/autonomy/escalation, all evidence-derived; `sharesSpecificWord()`
  (a stricter local variant of Phase 3/4's `sharesSignificantWord()`) plus
  per-need dynamic "background word" exclusion, fixing two real
  false-positive tool-matching bugs caught during verification.
- `generators/ai-agent-artifact.generator.ts` — per-agent + aggregate JSON/
  Markdown, tool catalog, Mermaid diagram, under
  `output/artifacts/ai-agents/`.
- `validators/ai-agent-definition.validator.ts` — referential integrity,
  no-invented-permission/tool/confidence, no orphan tools, tool-name
  collision detection (reuses Phase 5.5A's `detectIdentifierCollisions()`).
- `createApprovalRequest()` (`framework/governance/approvals/`) gained
  additive, optional `id`/`timestamp` overrides — zero change to Phase 3's
  existing call sites.
- Security & Governance additively consumes `AIAgentDefinition[]` as a
  third sibling: `generators/ai-agent-security.generator.ts` (write/notify
  tools get authorization+audit requirements, read-only tools get none;
  persistent+sensitive memory gets a data-protection requirement,
  session-only memory gets none; a security-specific model-provider gap
  only fires when the agent has a real data surface — a materiality gate),
  `generators/ai-agent-governance.generator.ts` (`GovernancePlan
  .aiAgentControls?`, additive/optional).
  `ArchitectureReference`/`EvidenceReference` gained `"ai-agent"`/`"ai-tool"`
  and `"ai-agent-need"` respectively.
- Two new examples: `examples/solution/customer-support-agent.md`
  (conversational, supervised, session memory, one read-only tool, employee
  approval preserved for conflicting bookings) and
  `examples/solution/invoice-triage-agent.md` (assistive, zero tools, zero
  write permissions, proving AI Agent ≠ autonomous agent). All 5
  pre-existing examples verified to produce zero false-positive AI Agent
  selections.
- `tests/ai-agent-generation.test.ts` (new) + 6 new AI-specific scenarios in
  `tests/security-governance.test.ts` — 143 tests passing total.

**Still deferred, intentionally:**

- No multi-agent splitting logic (one need → one agent only, by design).
- No LLM/model-provider call, tool execution, MCP, embeddings, vector
  storage, or RAG runtime of any kind.
- No automatic regulatory-framework claims for AI presence alone (reuses
  Phase 5's exact explicit-framework-name-only compliance model, verified
  against both new examples).

## Phase 6.5 — AI Agent Export / Runtime Adapters

Mirrors the Exporter-vs-Provider boundary Phase 5.5A already established
for integrations, applied to AI agents. Not implemented.

- **Export side** (`AIAgentDefinition` → implementation scaffolding):
  generic tool schema export, MCP server/client definitions,
  provider-specific agent configuration, application scaffolding — no real
  generation exists yet.
- **Runtime side** (`AIAgentDefinition` → executable agent): model
  invocation, tool execution, memory implementation, telemetry — no real
  provider exists yet, same as Phase 5.5B for integrations.

## Phase 7A — Observability and Operational Architecture ✅ done

The sixth fully-generated capability, and the second cross-cutting one
(after Security & Governance): inspects `WorkflowDefinition[]`,
`IntegrationDefinition[]`, `AIAgentDefinition[]`, `SecurityArchitecture`,
and `GovernancePlan` — every other real capability's output — and produces
a vendor-neutral operational-observability specification. See
`docs/architecture/ARCHITECTURE.md` "Observability and Operational
Architecture (Phase 7A)" for the full design, including a real signal-
naming collision caught and fixed during this phase's own verification.

- `ObservabilityArchitecture` (`framework/capabilities/observability/schemas/`)
  — replaces the Phase 0 unstructured `string[]` model with
  `TelemetryRequirement`, `ObservabilitySignal`, `LogRequirement`,
  `MetricRequirement`, `CorrelationRequirement`, `HealthRequirement`,
  `AlertRequirement`, `DashboardSpecification`, `AuditTelemetryMapping`,
  `OperationalObjective` — every one evidence-backed via
  `ArchitectureReference`/`EvidenceReference`, no new entity types needed
  in either enum.
- `observability.assessor.ts`/`.planner.ts` — structured selection from
  Discovery-only structural proxies (multi-step processes, integration/AI
  agent needs, explicit operational terminology); the real signal-
  generation decisions happen entirely in `execute()`.
- `generators/observability-architecture.generator.ts` — workflow
  visibility (baseline outcome + decisions/approvals/notifications, never
  one signal per plain step — a documented explosion-avoidance policy),
  integration visibility (per-operation attempt/success/failure events,
  per-integration count/failure/duration metrics, HTTP attributes only
  when Phase 4 knows REST), AI agent visibility (session + tool-invocation
  + escalation + human-approval events, metadata-only attributes by
  construction — no code path reads message/response/prompt content),
  security-aware telemetry (secrets → prohibited-data, unresolved/sensitive
  classification → payload-avoidance requirement), audit mapping,
  cross-component correlation (never a vendor trace format), health
  requirements, narrow alert generation (explicit text or approval-
  significance only), explicit-only operational objectives (no fabricated
  threshold), and dashboards gated on having ≥1 real signal to show.
- `validators/observability.validator.ts` — referential integrity, signal/
  audit/alert/dashboard/objective integrity, signal-name collision
  detection (reuses Phase 5.5A's `detectIdentifierCollisions()`), the
  **threshold-provenance rule** (any concrete threshold must have real
  evidence and be marked explicit), a secret-literal reject-list (reuses
  Phase 5.5A's pattern), and a payload-attribute denylist (defense-in-depth
  on top of the by-construction metadata-only guarantee).
- New example, `examples/solution/operational-order-processing.md` —
  explicit correlation-id requirement, explicit 5-consecutive-failure
  alert threshold, explicit 95%/2-second objective, explicit no-secret/
  no-payload-logging requirement — proving Stitchfy preserves stated
  thresholds verbatim rather than inventing or discarding them. All 6
  pre-existing examples (`appointment-business.md`, `invoice-approval.md`,
  `api-integration.md`, `rest-export-ready.md`, `customer-support-agent.md`,
  `invoice-triage-agent.md`) verified to produce evidence-backed,
  non-fabricated observability output — including the invoice-triage
  agent's zero tool-invocation telemetry (it has zero tools).
- `tests/observability-generation.test.ts` (new) — 175 tests passing total.

**Still deferred, intentionally:**

- No telemetry emission/collection, no vendor SDK of any kind (OpenTelemetry,
  Prometheus, Grafana, Datadog, New Relic, CloudWatch, Azure Monitor, GCP
  Monitoring, Splunk, Loki, Tempo, Jaeger).
- No infrastructure metrics (CPU/memory/disk/pod/container counts) — Cloud
  Architecture (Phase 7B, now done) deliberately keeps deployment units
  logical rather than adding compute metrics; see Phase 7B's own deferred
  list.
- No `ObservabilityProvider` of any kind.

## Phase 7B — Vendor-Neutral Cloud and Deployment Architecture ✅ done

The seventh fully-generated capability, and the last cross-cutting one:
inspects `WorkflowDefinition[]`, `IntegrationDefinition[]`,
`AIAgentDefinition[]`, `SecurityArchitecture`, `GovernancePlan`, and
`ObservabilityArchitecture` — every other real capability's output — and
produces a vendor-neutral deployment/runtime specification. Replaces the
Phase 0 skeleton (mandatory `provider`, `NetworkingConfig{vpcNeeded,
publicEndpoints}`, `DatabaseResource{engine}`, free-form
`deploymentStrategy: string`). See `docs/architecture/ARCHITECTURE.md`
"Vendor-Neutral Cloud and Deployment Architecture (Phase 7B)" for the full
design, including the AI-agent-vs-workflow/integration signal asymmetry and
two classification bugs caught and fixed during this phase's own
verification.

- `DeploymentNeed` (`framework/discovery/cloud/`) — a new Discovery entity,
  extracted from 8 dedicated section-heading aliases only, never from
  incidental "AWS"/"server"/"cloud"/"database" mentions elsewhere.
- `CloudArchitecture` (`framework/capabilities/cloud/schemas/`) —
  `HostingModel`, `CloudProviderRequirement`, `LocationRequirement`,
  `DeploymentUnit`, `RuntimeRequirement`, `StateRequirement`,
  `PersistenceRequirement`, `ConnectivityRequirement`,
  `EnvironmentRequirement`, `ScalabilityRequirement`,
  `ResilienceRequirement`, `DeploymentStrategyRequirement`,
  `CloudSecurityMapping`, `CloudObservabilityMapping` — every one
  evidence-backed, provider/service/database engine/network implementation
  never selected unless explicitly stated in the source document.
- `cloud.assessor.ts`/`.planner.ts` — structured selection deliberately
  excluding multi-step-process and integration-need signals (a human or a
  third-party SaaS owning runtime work is not evidence the *solution* does);
  `AIAgentNeed` is the one supporting signal, reaching `needs-review`.
- `generators/cloud-architecture.generator.ts` — deployment units only from
  explicit `solution-managed <Name>` language (never one per capability
  object — no automatic microservices split), runtime requirements per unit
  plus unconditionally per AI agent, durable state from a real
  `WorkflowApproval`, connectivity reusing real `IntegrationDefinition`s
  with protocol preserved verbatim, environment names preserved verbatim,
  explicit-only scalability/resilience (reusing Phase 7A's threshold-
  provenance approach), security/observability as pure reference-layer
  mappings.
- `validators/cloud.validator.ts` — referential integrity, deployment-unit-
  ownership (an external system can never be a unit), connectivity source≠
  target, provider/location/scaling/environment/deployment-strategy
  provenance, and two denylists (provider services; network-implementation
  terms) as defense-in-depth.
- Registry reorder: Cloud now runs after Security & Governance and
  Observability (website, workflow-automation, integrations, ai-agents,
  security-governance, observability, **cloud**, modernization).
- New examples — `examples/solution/cloud-order-platform.md` (two
  solution-managed components, explicit public/non-public exposure, Test/
  Production environments, durable state, Fulfillment-API resilience, 100-
  concurrent-submissions target, explicit no-provider/no-database/no-
  deployment-strategy statements) and `examples/solution/cloud-provider-
  explicit.md` (AWS + `us-east-1` stated explicitly, no service names) —
  proving both real topology generation and provider/region preservation
  without invention. All 8 pre-existing examples re-verified: the 6
  non-deployment ones stay `not-recommended`, the 2 AI-agent ones reach
  `needs-review` with an agent runtime requirement and no provider selected.
- `SolutionBlueprint.deployment`/`DeploymentInfo` confirmed to have zero
  producers and zero consumers anywhere in the codebase — doc comment now
  marks it legacy, pointing at `SolutionBlueprint.architecture`
  (`CloudArchitectureSection`) as the real source of truth.
- `tests/cloud-generation.test.ts` (new) — 209 tests passing total.

**Still deferred, intentionally:**

- No IaC generation, no cloud SDK installed/invoked, no credentials, no
  network calls, no cost estimation.
- No HA/multi-region/multi-AZ/active-active/load-balanced/replicated/
  hot-standby/DR-site defaults, no backup/retention defaults.
- First concrete `CloudProvider` adapter (behind `framework/providers/cloud/`,
  vendor selectable, not hardcoded) remains a *later* concern — Phase 7B
  itself is the domain model, not an implementation; `CloudProvider.deploy()`
  is never invoked.
- No infrastructure metrics (CPU/memory/disk/pod/container counts) —
  Observability's own scope can extend to these in a future phase now that
  real compute/deployment architecture exists, but Phase 7B itself
  deliberately does not add them.

## Phase 7C — Cloud / Observability Export & Runtime Provider Adapters

Mirrors the Exporter-vs-Provider boundary Phases 5.5A/6.5 already
established, applied to both Cloud (7B) and Observability (7A) architecture.
Not implemented.

- **Cloud Exporters**: `CloudArchitecture` → IaC artifacts — Terraform,
  OpenTofu, AWS CloudFormation, AWS CDK, Azure Bicep, Pulumi — no real
  generation exists yet.
- **Observability Exporters**: `ObservabilityArchitecture` → OpenTelemetry
  instrumentation plan, Prometheus rules, Grafana dashboards, CloudWatch
  alarms, Datadog monitors — no real generation exists yet.
- **Runtime Providers**: `CloudArchitecture`/`ObservabilityArchitecture` →
  actual provisioning/telemetry/configuration APIs — no real provider exists
  yet, same as Phase 5.5B/6.5's runtime sides.

## Phase 8 — Legacy Modernization Assessment and Migration Strategy ✅ done

The eighth and last fully-generated capability, and the last cross-cutting
one: inspects `IntegrationDefinition[]`, `SecurityArchitecture`,
`ObservabilityArchitecture`, and `CloudArchitecture` — every other real
capability's output — and produces a vendor-neutral modernization
assessment and migration-strategy specification. Replaces the Phase 0
unstructured model (`{systemInventory, dependencies, applications,
integrations, technicalDebt, migrationCandidates` with a free-form
`recommendedStrategy: string`, `migrationStrategies, recommendations}` all
as `string[]`). See `docs/architecture/ARCHITECTURE.md` "Legacy
Modernization Assessment and Migration Strategy Architecture (Phase 8)" for
the full design, including the aggregate-need scoping bug caught and fixed
during this phase's own verification.

- `ModernizationNeed` (`framework/discovery/modernization/`) — a new
  Discovery entity, one aggregate per document, extracted from 12 dedicated
  section-heading aliases only.
- `ModernizationArchitecture` (`framework/capabilities/modernization/schemas/`)
  — `SystemModernizationProfile`, `SystemDependency`, `TechnicalDebtItem`,
  `PreservationRequirement`, `ModernizationSeam`, `MigrationConstraint`,
  `MigrationCandidate`/`ModernizationStrategyOption`, `ModernizationDelta`,
  `TargetStateRequirement`, `MigrationValidationRequirement`,
  `ModernizationRoadmap`/`ModernizationWorkstream` — every one evidence-
  backed, no provider/service/database/microservices/rewrite ever selected
  unless explicitly stated.
- `modernization.assessor.ts`/`.planner.ts` — structured selection where an
  explicitly `category: "legacy"` system is supporting-only (never
  `recommended` on its own, never selects a strategy).
- `generators/modernization-profile.generator.ts` + `migration-strategy.generator.ts`
  + `modernization-roadmap.generator.ts` + `modernization-architecture.generator.ts`
  — current-state profiles/dependencies/technical-debt/preservation/seams,
  future-state strategy classification (every `ModernizationStrategy` enum
  value reachable only via an explicit keyword/pattern, never from
  "legacy"/"monolith"/"old" language), target-state requirements referencing
  Cloud/Security/Observability without duplicating them, two deterministic
  risk rules (shared-database, coexistence), and materially-gated
  information gaps.
- `validators/modernization.validator.ts` — referential integrity,
  **candidate scope** (a system can never become a migration candidate
  without appearing in a real `ModernizationNeed.systemIds`), strategy/
  target-technology/lifecycle/technical-debt provenance.
- New examples — `examples/solution/legacy-java-modernization.md` (Order
  Portal, explicit WebSphere→Tomcat replatform, coexistence, 3 preservation
  requirements, 2 real dependencies) and `examples/solution/legacy-operations-assessment.md`
  (spreadsheet + desktop app + manual exchange, no replacement chosen —
  proving Stitchfy never fabricates a strategy when only intent is
  evidenced). All 6 pre-existing restraint examples re-verified to stay
  `not-recommended`.
- One small, justified additive change to Phase 1's `systems.extractor.ts`:
  a new `/\blegacy\b/i` category pattern (checked against `name + purpose`)
  so `category: "legacy"` — previously a dead enum value — becomes a real,
  usable signal.
- `tests/modernization-generation.test.ts` (new) — 230 tests passing total.

**Still deferred, intentionally:**

- No source-code/repository analysis, no external lifecycle/CVE lookup, no
  code generation (Java/Spring/Dockerfiles/Terraform/Kubernetes/migration
  scripts), no database migration, no deployment of replacement systems.
- No fake implementation schedule (no dates/durations/quarters) and no fake
  migration sequencing — dependency direction alone never determines order.

## Phase 8.5A — Local Codebase Evidence and Dependency Analysis ✅ done

A second, independent, optional evidence domain (`framework/analysis/codebase/`)
that inspects a user-supplied local repository in read-only mode and turns
manifests and limited source structure into provenance-backed facts
(`CodebaseAnalysisResult`), which Legacy Modernization may optionally
consume as additional, non-authoritative evidence for one explicitly-mapped
system. See `docs/architecture/CODEBASE_ANALYSIS.md` for the full design.

- `CodebaseAnalyzer`/`CodebaseAnalyzerRegistry` (`analyzers/`) — detection
  lives in each analyzer's own `supports()`, never orchestration branching;
  multiple analyzers may run against the same repository at once.
- Safe repository scanner (`scanner/`) — centralized directory/sensitive-
  file/binary/size exclusions, symlinks never followed, path-traversal
  rejected, deterministic sorted traversal.
- Implemented analyzers: **Repository/filesystem** (language histogram,
  build-descriptor detection, honest unsupported-ecosystem gaps — no
  per-ecosystem special-casing), **Maven** (a minimal dependency-free XML
  parser scoped to POM structure, DTD/entity resolution impossible by
  construction, local-only property resolution, unresolved versions
  preserved as the literal string `"unresolved"`), **npm** (`JSON.parse`
  only, scripts recorded never executed, ranges preserved verbatim),
  **Java source structure** (regex-based package/import/type-declaration/
  annotation extraction, no compilation).
- `CodebaseEvidenceReference`/`CodebaseFactMetadata` — a deliberately
  separate provenance contract from `EvidenceReference` (Discovery); every
  "derived" fact cites the "observed" fact it came from.
- Modernization integration (`generators/modernization-codebase-enrichment.generator.ts`)
  — fills a mapped `SystemModernizationProfile.codebaseAnalysis` reference,
  may append a narrow `TechnicalDebtItem`/`MigrationValidationRequirement`,
  and detects `CodebaseEvidenceConflict`s — **never touches
  `MigrationCandidate.strategyOptions`**; Phase 8's own strategy
  classification is completely unaffected by this phase's existence.
- `scripts/analyze-codebase.ts` (`npm run analyze:codebase -- --path <dir>`)
  — standalone inventory. `npm run solution -- --input ... --codebase <dir>
  --system-id <id>` — optional integrated enrichment; the plain
  `npm run solution -- --input ...` invocation is unchanged.
- 3 fixture repositories (`tests/fixtures/codebases/`) + `tests/codebase-analysis.test.ts`
  — 257 tests passing total, including static guards proving no
  `child_process`/network usage anywhere in the module.

**Still deferred, intentionally:**

- Gradle/.NET/Python/Go/container-image analyzers (extension points only).
- Git/commit-history analysis, dependency-upgrade recommendations,
  vulnerability/EOL evaluation, transitive dependency resolution.
- Any code-transformation or migration-recipe generation — deferred to
  Phase 8.5B.

## Phase 8.5B — Modernization Recipe & Transformation Export Adapters ✅ done

Mirrors the Exporter/Provider pattern established across Phases 5.5A/6.5/7C,
applied to Modernization: consumes `ModernizationArchitecture` +
`CodebaseAnalysisResult` together to generate a migration recipe,
dependency/configuration/build change proposals, source transformation
candidates, a test-impact specification, and a validation plan — never a
source-mutating transformer, never applied automatically. See
`docs/architecture/MODERNIZATION_EXPORTERS.md` for the full design.

- `ModernizationExporter`/`ModernizationExporterRegistry`
  (`framework/capabilities/modernization/exporters/`) — detection lives in
  each exporter's own `supports()`; `candidate` threaded through explicitly
  (an invited adaptation of the task's own `(architecture, codebase)`-only
  sketch, since export generation is scoped per `MigrationCandidate`).
- `ModernizationExportReadiness` (`ready`/`needs-review`/`blocked`/`unsupported`,
  no numeric score) — an unresolved `CodebaseEvidenceConflict` concerning the
  migrated runtime blocks; an unversioned explicit target or an unresolved
  dependency version lowers to `needs-review`.
- First concrete exporter: **`generic-java-replatform`** — supports a
  candidate only with an explicit Phase 8 `replatform` strategy, a proven
  Java codebase, and a real runtime `ModernizationDelta`; reasons generically
  from `ModernizationDelta`/`RuntimeFact`/`FrameworkFact`/`ConfigurationFact`/
  `CodeDependencyFact` — no `if (target === "Tomcat")` branching anywhere in
  orchestration. Acceptance fixture: WebSphere → Tomcat (explicit target
  preserved verbatim, no version/config/cloud/container/database invented,
  `javax` stays `javax` without explicit Jakarta target evidence).
- `MigrationRecipe`/`MigrationRecipeStep`, `TransformationProposalSet`
  (`DependencyChangeProposal`/`ConfigurationChangeProposal`/
  `BuildChangeProposal`/`SourceTransformationCandidate`/`ManualReviewItem`),
  `TestImpactSpecification`/`MigrationValidationPlan` — every proposal
  defaults to `retain`/`review`; `remove`/`replace` never appear without
  deterministic evidence (the shipped exporter never emits `remove` at all).
- `validateModernizationExportBundle()` — referential integrity, no
  absolute paths, no credential literals, target-version provenance (any
  concrete version must trace to a real `ModernizationDelta`), manifest
  self-consistency.
- CLI: `--modernization-export <target>` (explicit intent required — plain
  `--codebase`/`--system-id` stays analysis/enrichment-only, no automatic
  export). Single integrated `npm run solution` command, no separate script.
- `tests/modernization-exporters.test.ts` (new) — 288 tests passing total,
  including strategy/architecture/codebase-input immutability, no-repository-
  write (byte-identical fixture), no `child_process`/network imports, no
  fabricated versions/technologies/numeric criteria.
- A deliberate review boundary sits between codebase analysis and any
  transformation output — `CodebaseAnalysisResult → architecture/human
  review → Modernization Export Adapter → human/engineering review` — Phase
  8.5B is not assumed automatic, and Phase 8.5C was not automatically begun.

**Still deferred, intentionally:**

- No `SourceTransformer` of any kind — no patch/diff generation, no file
  writes to the analyzed repository.
- No build/test execution against the analyzed repository.
- No Maven Central/npm registry/CVE/EOL/vendor-compatibility lookups.
- No Gradle analyzer addition (kept out of scope per task item 112).
- No multi-exporter auto-selection — an explicit, single `--modernization-export`
  target is required.

## Phase 8.5C — Reviewed Source Transformation / Patch Generation

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

Not implemented. Even Phase 8.5C should not necessarily apply patches
automatically — a human-approval gate remains between a proposal and any
generated diff.

## Phase 9 — Reference Implementations / End-to-End Reference Solutions ✅ done

Not a new capability — proof that the seven capabilities plus the two
export adapters plus codebase analysis already built operate as one
coherent, traceable framework, via three canonical end-to-end worked
examples, matching templates, a capability-coverage matrix, semantic
regression validation, and documentation that accurately separates
"generates architecture" from "runs software." Preferred user-facing term:
**"Reference Solution"** — none of the three deploys, runs, or provisions
anything; see `docs/reference/END_TO_END.md`'s "Artifact taxonomy."

- **Three canonical reference solutions** (`examples/reference/`), each a
  coherent scenario exercising a real combination of capabilities together
  rather than one capability in isolation: `appointment-automation-ai.md`
  (Workflow + Integrations + AI Agents + Security/Governance + Observability,
  plus Cloud at low confidence via the AI-agent-runtime-hosting signal —
  not fabricated deployment language), `order-platform.md` (Workflow +
  Integrations, exported via `generic-rest-typescript` at readiness `ready`
  + Security/Governance + Observability + Cloud with an unspecified
  provider), `legacy-java-modernization.md` (Integrations +
  Security/Governance + Observability + Modernization, enriched with real
  codebase evidence and exported via `generic-java-replatform` at readiness
  `needs-review`). Existing `examples/solution/*.md` files are untouched.
- **Five starter templates** (`templates/solution/`): `business-automation.md`,
  `ai-assisted-workflow.md`, `api-platform.md`, `cloud-deployment.md`,
  `legacy-modernization.md` — every heading shown is a real, recognized
  Stitchfy heading (verified against each discovery extractor's own
  `SECTION_CANDIDATES`/heading-alias list before being documented), and
  every bullet distinguishes "fill in if known" from "leave out if
  unknown." The five old capability-named placeholder READMEs
  (`templates/{workflow,ai-agent,integration,cloud,modernization}/`) had
  their stale "once this capability has a real `execute()`" claim
  corrected — all five now do — and now point here.
- **`docs/reference/CAPABILITY_MATRIX.md`** — generated from real
  `npm run solution` runs of all three scenarios, not from capability
  existence; includes a "notes on non-obvious results" section explaining
  the AI-agent → Cloud signal and the pre-existing `PRESERVE-003`
  classification detail.
- **Semantic golden validation** — `tests/reference/reference-solutions.ts`
  (a `ReferenceSolutionDefinition[]` manifest with `ReferenceInvariant`
  closures; test/support infrastructure, never a `SolutionBlueprint`
  field) + `tests/reference/reference-runner.ts` (shared execution/
  normalization logic, imported by both the test suite and the validation
  script). `normalizeReferenceOutput()` strips only documented volatile
  fields (`generatedAt`, `timestamp`, `startedAt`/`completedAt`,
  `durationMs`, `ImplementationArtifact.id`/`HumanApproval.id`/
  `WorkflowState.projectId`'s `Date.now()`-based shapes, and ISO
  timestamps embedded inside pre-serialized `content` strings) — every
  other id stays, since it comes from a deterministic `makeIdGenerator()`
  counter. Golden fixtures (`tests/fixtures/reference-expected/*.json`)
  are intentionally partial — `assertGoldenSubset()` checks "every key
  path in the fixture matches," not full deep-equality.
- **`npm run reference:validate`** (`scripts/reference-validate.ts`) — runs
  all three scenarios via direct function calls (no subprocess), checks
  capability selection/artifact existence/invariants/golden subset, and
  writes `output/reference/reference-validation.md` +
  `reference-validation.json`. Fully offline; no `STITCH_API_KEY`/
  `OPENAI_API_KEY` required. Output isolation reuses the **already-existing**
  `--output <dir>` flag on `npm run solution` — no new CLI flag was added.
- **`tests/reference-solutions.test.ts`** — per-scenario invariant tests,
  cross-scenario capability/exporter coverage completeness, codebase-
  evidence byte-identity + no-strategy-mutation, reproducibility (re-run
  order-platform, normalized output identical), static no-`child_process`/
  no-network guards, reference-doc command validity (every `npm run ...`
  in the new docs resolves to a real `package.json` script), and README
  framework-positioning invariants.
- **Documentation**: `docs/reference/END_TO_END.md` (the 8-step pipeline +
  artifact taxonomy, canonical location for both), `docs/reference/APPOINTMENT_AUTOMATION_AI.md`,
  `ORDER_PLATFORM.md`, `LEGACY_JAVA_MODERNIZATION.md` (per-scenario
  walkthroughs with real generated IDs, each stating its explicit runtime
  boundary), `examples/reference/README.md`, `templates/README.md`.
- **README repositioning** — no longer opens with "static website
  generator only"; leads with the solution-engineering framing, keeps the
  website Quick Start fully intact (renamed, not hidden), adds a Solution
  Architecture Quick Start, an architecture diagram, a capability status
  table, and a framework-wide "Specification versus Runtime" section
  (the old website-only "What This Does NOT Include" is kept as its own
  subsection). Wording discipline throughout: "generates X," never
  "automates/runs/deploys/migrates X." No package-version or
  `SolutionBlueprint` schema-version bump.
- **331 tests passing** (288 existing + 43 new), zero `framework/**`
  production-code changes — this phase is purely additive (examples,
  templates, docs, test infrastructure, one new script, two doc/README
  edits).

## Architecture Stabilization / Release Candidate Review — RC1 ✅ done

The decision milestone Phase 9 recommended. Not a feature phase — no new
capability, exporter, analyzer, or runtime provider was built. Outcome:

- **Contracts classified** into STABLE/CANDIDATE/EXPERIMENTAL/INTERNAL —
  `docs/architecture/PUBLIC_CONTRACTS.md`. Nothing is STABLE yet (this is
  the first formal review); serialization contracts (`SolutionBlueprint`
  v1, `WebsiteBlueprint` v1, both export manifests, `CodebaseAnalysisResult`)
  and the 4 documented CLI commands are CANDIDATE; `StitchfyCapability`,
  `CapabilityRegistry`, both exporter interfaces, `CodebaseAnalyzer`, and
  the `Provider` family are EXPERIMENTAL.
- **`SolutionBlueprint` v1 frozen** — `docs/architecture/decisions/ADR-002-solution-blueprint-v1-stability.md`.
  A full Type/Zod parity audit across all 8 major domains (SolutionBlueprint,
  Workflow Automation, Integrations, AI Agents, Security & Governance,
  Observability, Cloud, Modernization) found **zero genuine mismatches** —
  the shape was already internally consistent going in.
- **Compatibility/deprecation policy documented** —
  `docs/architecture/COMPATIBILITY.md`. `SolutionBlueprint.deployment`
  (already `@deprecated`, already zero producers before this review) is
  the one applied example; policy covers serialization/enum/CLI evolution
  and Markdown-vs-JSON contract strength.
- **Package boundaries decided** (documentation only, no physical
  restructuring) — `docs/architecture/decisions/ADR-001-package-boundaries.md`
  (core vs. optional/future) and `ADR-003-runtime-provider-boundary.md`
  (why runtime providers stay outside core). Both offline exporters
  (`generic-rest-typescript`, `generic-java-replatform`) stay in core;
  Phase 5.5B/6.5/7C/8.5C stay out, explicitly, with rationale.
- **A real, verified stabilization defect found and fixed**: generated
  `project.frameworkVersion` disagreed with `package.json`'s version in
  both pipelines (hardcoded `"2.0.0"` and `"0.1.0-solution"` against
  `package.json`'s `"2.1.0"`) — centralized into `framework/core/version.ts`
  (`STITCHFY_VERSION`, `SOLUTION_BLUEPRINT_SCHEMA_VERSION`,
  `WEBSITE_BLUEPRINT_SCHEMA_VERSION`), regression-locked by
  `tests/contracts/versioning.contract.test.ts`. Two other small,
  targeted fixes: stale user-visible "(Phase 0)"/"(Phase 8.5A)" console
  banners removed; the three CLI scripts' fatal-error handlers no longer
  print a raw stack trace as the primary UX for expected errors (e.g. a
  missing repository path).
- **`tests/contracts/`** (new, 26 tests): `solution-blueprint-v1.contract.test.ts`,
  `versioning.contract.test.ts`, `cli-contract.test.ts` — reuse Phase 9's
  reference manifest/runner rather than duplicating pipeline logic.
- **`npm run rc:validate`** (new) composes `typecheck`/`test`/`reference:validate`
  and writes `output/release/rc-validation.{json,md}`; `npm run stitchfy`/
  `npm run solution` stay manual gates by design.
- **`package.json` description corrected** from the stale website-only
  framing to the current solution-engineering scope; no version bump.
- **`docs/architecture/RELEASE_CANDIDATE.md`**, **`KNOWN_TECHNICAL_DEBT.md`**,
  and **`docs/releases/RC1.md`** — the full RC report, a verified (not
  assumed) tech-debt register distinguishing real defects from deferred
  scope, and user-facing release notes.
- **357 tests passing** (331 existing + 26 new contract tests, 1
  pre-existing environment-appropriate skip). Zero reference-solution
  golden drift.
- **RC Result: PASSED.** **Merge recommendation: READY WITH DOCUMENTED
  CONDITIONS** (human review of the ADRs; a deliberate future decision
  point before exposing an npm library surface) — see
  `docs/architecture/RELEASE_CANDIDATE.md` for the full reasoning.
  **Recommended package version: retain `2.1.0`** — no breaking
  user-facing contract was introduced. No merge to `main`, no git tag, no
  npm publish performed by this review — those remain separate, explicitly
  human-approved actions.

**Still deferred, intentionally — this review did not begin any of them:**

## Deferred tracks (unchanged by Phase 9 or RC1, not automatically started)

- **Phase 5.5B — Runtime Integration Providers** — actually calling a
  real external system from a generated `IntegrationExportBundle`.
- **Phase 6.5 — AI Agent Export / Runtime Adapters** — actually invoking a
  model/provider from a generated `AIAgentDefinition`.
- **Phase 7C — Cloud / Observability Export & Runtime Provider Adapters** —
  actually provisioning infrastructure or configuring a monitoring vendor
  from `CloudArchitecture`/`ObservabilityArchitecture`.
- **Phase 8.5C — Reviewed Source Transformation / Patch Generation** —
  turning an approved `ModernizationExportBundle` into a reviewable unified
  diff (still gated behind human approval even once built — see its own
  section above).

Phase 9 exists to give the "Architecture Stabilization / Release Candidate
Review" milestone above enough real, end-to-end evidence to decide which of
these (if any) become Stitchfy core versus a separate, optional package —
that decision is explicitly not made in this phase.
