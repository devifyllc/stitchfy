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
