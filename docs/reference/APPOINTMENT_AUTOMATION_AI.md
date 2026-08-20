# Reference Walkthrough: Appointment Automation & AI

Traces `examples/reference/appointment-automation-ai.md` through the chain
`business requirement → process → workflow → integration → AI agent →
human approval → security/governance → observability`, using real IDs from
an actual run. See `docs/reference/END_TO_END.md` for the general 8-step
pipeline and artifact taxonomy this walkthrough assumes.

```bash
npm run solution -- --input examples/reference/appointment-automation-ai.md --output output/reference/appointment-automation-ai
```

## Business requirement → process

The document's one `## Business Processes` entry, "Appointment Booking",
becomes `PROC-001` in `DiscoveryResult.processes`, with a business rule
requiring front-desk approval for conflicting requests
(`Business rule "A conflicting appointment request must always be approved
by a front-desk employee before confirmation"`).

## Process → workflow

Workflow Automation generates `WF-001` ("Appointment Booking Workflow")
with 10 steps, including two `decision` steps and two `human-task` steps —
one per conflict-approval trigger found in the document (the process's own
business rule, and the matching `## Requirements` bullet). Both produce a
`WorkflowApproval` (`APPROVAL-001`, `APPROVAL-002`) with
`approval.approvalRequired: true` and `approverRole: "Front-desk employee"`
— **this is the human-in-the-loop boundary**: nothing downstream can mark a
conflicting appointment confirmed without one of these approvals being
granted, and generating the `WorkflowDefinition` does not grant either of
them.

## Workflow → integration

The `## Integrations` bullet ("The booking system checks and reserves
availability in Google Calendar") becomes `INT-001` in
`IntegrationsSection.integrations` — an `IntegrationDefinition`, not a live
Google Calendar connection. No integration export bundle is generated for
it (no explicit REST method/path was supplied — see
`docs/reference/ORDER_PLATFORM.md` for a scenario where one is).

## Integration → AI agent

AI Agents generates `AIAGENT-001` ("Riverside Wellness Studio Assistant")
with `autonomy: "assistive"` (never `"autonomous"`) and one tool,
`AITOOL-001` ("The system checks Google Calendar for availability"), whose
`kind: "integration-operation"` and `integrationId: "INT-001"` tie it back
to the *real* integration above — the tool was never invented independently
of an integration Stitchfy already generated.

## AI agent → human approval boundary

`AIAGENT-001.guardrails` includes `AIGUARD-001`: *"The assistant must not
confirm a conflicting appointment without front-desk employee approval —
conflict approval can never be bypassed."* This is a guardrail on the
agent's own specification, generated verbatim from the document's explicit
prohibition — it exists alongside, and independently of, the workflow-level
`WorkflowApproval`s above. `AIAGENT-001.memory.mode: "session"` (never
persistent) and `containsSensitiveData: true` (the agent's memory touches
`DATA-001`, the sensitive customer-information entity).

## → Security & Governance

`SecurityArchitecture.requirements` includes two `human-oversight`-domain
requirements (one per approval trigger above) plus a `secrets` requirement
for the Google Calendar credential and an `integration` requirement for the
boundary itself — four `SecurityRequirement`s total, each with a real
`appliesTo` reference (never an empty one).

## → Observability

`ObservabilityArchitecture.signals` (18 total) cover workflow start/
complete/fail, the two decision/approval points, the integration's own
attempt/success/failure signals, and agent/tool invocation signals (agent
tool-invocation signals are prefixed `"Tool invocation: "` specifically so
they never collide textually with the integration's own signal — see
`framework/capabilities/observability/README.md`). Two `AlertRequirement`s
exist, one of them for automated-confirmation/reminder-delivery failure per
the document's explicit `## Requirements` bullet.

## A non-obvious result: Cloud fires at low confidence

Even though this document has no `## Deployment Requirements` section,
Cloud Architecture still executes — at `needs-review` status and `low`
confidence, driven by exactly one signal:
`AIAgentSignal("AINEED-001 implies solution-owned orchestration logic that
requires a runtime, even though where it runs is not yet known")`. This is
real, evidence-based reasoning in `framework/capabilities/cloud/cloud.assessor.ts`
(an AI agent is active software logic the solution itself would need to
host), not something fabricated for this reference — see
`docs/reference/CAPABILITY_MATRIX.md`'s notes section.

## Runtime boundary

```text
AIAgentDefinition
        ↓
tool specification / permissions   (this pipeline stops here)
        ↓
runtime model execution            — deferred, not implemented
```

Nothing above calls an LLM, checks a real calendar, or sends a real
reminder. `AIAGENT-001` is a specification an engineering team would
implement against — see `docs/architecture/ROADMAP.md`'s Phase 6.5 (AI
Agent Export / Runtime Adapters, deferred).
