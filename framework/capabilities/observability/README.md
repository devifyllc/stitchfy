# Observability Capability

Status: **fully implemented capability**. It's the sixth capability beyond the website (after Workflow Automation, Integrations, AI Agents, Security & Governance, and the Integration Export Adapter foundation) to go from structured selection through a validated, artifact producing specification, and the second **cross cutting** one (after Security & Governance): it inspects `WorkflowDefinition[]`, `IntegrationDefinition[]`, `AIAgentDefinition[]`, `SecurityArchitecture`, and `GovernancePlan`, all four already generated capabilities, rather than producing its own architecture from Discovery alone. `implemented: true` means Stitchfy generated and validated a vendor neutral observability and operational architecture for the currently known solution. It does **not** mean telemetry is being collected, logging exists, dashboards are deployed, alerts are active, tracing is installed, an SLO is being met, or production operations are ready. No telemetry SDK, vendor connection (OpenTelemetry, Prometheus, Grafana, Datadog, New Relic, CloudWatch, Azure Monitor, GCP Monitoring, Splunk, Loki, Tempo, Jaeger), or runtime instrumentation exists anywhere in this module.

## Pipeline

```
DiscoveryResult
     ↓ observability.assessor.ts       (structured, explainable selection)
CapabilityAssessment
     ↓ observability.planner.ts        (candidate sources — real objects built later)
ObservabilityPlan
     ↓ execute() reads Workflow Automation's, Integrations', AI Agents', and Security & Governance's sibling output
WorkflowDefinition[], IntegrationDefinition[], AIAgentDefinition[], SecurityArchitecture, GovernancePlan
     ↓ generators/observability-architecture.generator.ts   (signals, metrics, correlation, alerts, objectives — all evidence-derived)
ObservabilityArchitecture
     ↓ validators/observability.validator.ts   (referential integrity, no invented threshold/payload/secret)
     ↓ generators/observability-artifact.generator.ts       (JSON/Markdown/Mermaid artifacts)
ImplementationArtifact[]  →  output/artifacts/observability/
```

## Structure

```
observability/
├── generators/
│   ├── observability-architecture.generator.ts   ← the core generator (signals/metrics/alerts/objectives/...)
│   └── observability-artifact.generator.ts       ← ObservabilityArchitecture → JSON/Markdown/Mermaid artifacts
├── validators/
│   └── observability.validator.ts                ← referential integrity, threshold provenance, no secret/payload logging
├── schemas/
│   ├── observability.types.ts
│   └── observability.schema.ts
├── observability.assessor.ts   ← structured, explainable supports()/assess()
├── observability.planner.ts    ← ObservabilityPlan (candidate sources)
└── observability.capability.ts
```

## Key design points

- **Cross cutting, with no registry change needed.** `default-capabilities.ts`'s existing order (website, workflow-automation, integrations, ai-agents, cloud, **security-governance, observability**, modernization) already places observability strictly after all four capabilities it consumes. `execute()` reads them via `context.capabilityResults.find(...)`, the same sibling read pattern every capability since Phase 4 has used, now for four siblings. No `dependsOn` or `executionOrder` field exists or was needed: this is the fourth confirmation in this project that the static registration order is sufficient.
- **Architecture derived, never a generic checklist.** Every signal cites a real `WorkflowDefinition`, `IntegrationDefinition`, or `AIAgentDefinition` element via `ArchitectureReference`. There is no "add logging / add monitoring / add dashboards" boilerplate anywhere in the generator.
- **Avoiding signal explosion is a deliberate, documented policy.** Workflow visibility generates a baseline started/completed/failed trio per workflow, plus one signal per decision, approval, or notification, but **not** one signal per plain `WorkflowStep`. An external task step's operational visibility is already covered by the matching `IntegrationOperation`'s own attempt/success/failure signals; duplicating that at the workflow step level would explode the signal count without adding evidence backed value.
- **AI telemetry is metadata only by construction, not by a runtime filter.** The AI signal builder (`aiAttrs()`) only ever emits a fixed set of operational identifiers (`agentId`, `toolId`, `outcome`, `escalationReason`). The function has no code path that reads message, response, prompt, or conversation content, so there is nothing to filter out. A denylist check in the validator (`message`, `response`, `prompt`, `body`, `payload`, `content`, `conversation`) is defense in depth on top of that structural guarantee, not the primary safeguard.
- **A real bug caught during this phase's own verification:** a tool of `kind: "integration-operation"` shares its display name with the underlying `IntegrationOperation` (by Phase 6 design), so a naive `"${tool.name} failed"` signal collided textually with the integration's own `"${operation.name} failed"` signal. This was fixed by prefixing tool invocation signal names with `"Tool invocation: "`, so the two remain related but distinct facts ("the operation happened" versus "the agent specifically invoked it") without colliding.
- **No numeric threshold is ever fabricated.** `OperationalObjective.targetValue` and `AlertRequirement.threshold` are only ever populated when a dedicated regex finds a real percentage, time, or count value in already structured `RequirementItem`, `Constraint`, or `BusinessRule` text (never raw Markdown), and even then, the validator's **threshold provenance rule** independently re-checks that any concrete threshold has a real `EvidenceReference`, catching fabrication even if a future generator change tried to slip one in silently.
- **Alerts are narrow by design.** They're generated only from explicit operational text containing alert or threshold language, or from a workflow's approval required step (a pending human approval is treated as operationally significant), never one alert per integration or signal. An unresolved destination or threshold on a generated alert always surfaces a matching `InformationGap`, never a guessed value.
- **Security & Governance is consumed, never re-derived.** A `SecurityRequirement` with `domain: "secrets"` becomes a `LogRequirement.prohibitedData` entry (credential or API key material) attached to the relevant integration's signals; a `DataProtectionRequirement` with anything other than `public` or `internal` classification becomes a telemetry requirement to avoid recording the associated payload until classification and logging policy is resolved. Both reference the exact originating requirement, never duplicating or reinventing it. `AuditTelemetryMapping` links a real `AuditRequirement` to the signals that actually satisfy it; a mapping is only created when at least one matching signal exists.
- **Correlation, never distributed tracing.** `CorrelationRequirement` describes a vendor neutral "these architecture components should be correlatable" fact (workflow to integration, workflow to agent, agent to tool to integration). No W3C Trace Context, OpenTelemetry `traceparent`, or vendor specific trace ID format is ever generated. A future exporter can decide whether that becomes distributed tracing.
- **Two separate audit trails, never conflated.** Stitchfy's own capability execution audit trail (`framework/governance/audit/audit-logger.ts`) is not evidence that the *generated business solution* is auditable. This capability's `AuditTelemetryMapping`s are about the latter exclusively, derived from `SecurityArchitecture.auditRequirements`.

See `docs/architecture/ARCHITECTURE.md` "Observability and Operational Architecture" for the full design rationale, and `docs/architecture/ROADMAP.md` for **Phase 7B: Vendor Neutral Cloud Architecture** and **Phase 7C: Cloud / Observability Export & Provider Adapters** (mirroring the Exporter/Provider split already established in Phases 5.5A/6.5).
