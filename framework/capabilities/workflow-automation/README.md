# Workflow Automation Capability

Status: **fully implemented capability** — the first non-website capability
to go from selection through a validated, artifact-producing specification.
`implemented: true` means Stitchfy generated and validated a vendor-neutral
workflow specification — it does **not** mean the workflow is deployed or
running against real systems. No execution engine, vendor SDK, or API
client is used anywhere in this module.

## Pipeline

```
DiscoveryResult
     ↓ workflow-automation.assessor.ts     (structured, explainable selection)
CapabilityAssessment
     ↓ workflow-automation.planner.ts      (architectural plan + HITL touchpoints)
WorkflowAutomationPlan
     ↓ generators/workflow-definition.generator.ts   (one WorkflowDefinition per relevant process)
WorkflowDefinition[]
     ↓ validators/workflow-definition.validator.ts   (referential/structural integrity, reachability, cycles)
     ↓ generators/workflow-artifact.generator.ts      (JSON + Markdown-with-Mermaid, per workflow)
ImplementationArtifact[]  →  output/artifacts/workflow-automation/
```

## Structure

```
workflow-automation/
├── generators/
│   ├── workflow-definition.generator.ts   ← BusinessProcess → WorkflowDefinition
│   └── workflow-artifact.generator.ts     ← WorkflowDefinition → JSON/Markdown artifacts
├── validators/
│   └── workflow-definition.validator.ts   ← referential/structural integrity, reachability, cycles
├── schemas/
│   ├── workflow-automation.types.ts
│   └── workflow-automation.schema.ts
├── workflow-automation.assessor.ts        ← Phase 1.5: structured, explainable supports()/assess()
├── workflow-automation.planner.ts         ← Phase 1.5: WorkflowAutomationPlan + HITL touchpoints
└── workflow-automation.capability.ts
```

No `agents/` folder — nothing here fits that shape; it isn't created empty.

## Key design points

- **AS-IS is never rebuilt.** `DiscoveryResult.processes` (Phase 1) stays the
  authoritative record of what the business currently does.
  `WorkflowDefinition` is the proposed, vendor-neutral TO-BE automation —
  built by walking `process.steps` in source order and classifying each
  deterministically (approval/review language always stays `human-task`;
  a step overlapping a discovered `automationCandidates`/`manualSteps`
  entry — by shared-keyword, not semantic matching — gets reclassified;
  everything else falls back to an actor/system-name match). Every step
  carries `evidenceRefs` back to the source process.
- **Decisions only come from `HumanTouchpoint`s** (Phase 1.5) — one
  `WorkflowDecision` per touchpoint, never speculative. Branch targets
  ("Proceed" / "Human Review") are always freshly synthesized rather than
  fuzzy-matched onto an existing step.
- **Nothing is guessed**: no trigger without an explicit
  `BusinessProcess.trigger`, no notification channel without explicit
  wording, no technology/interaction type without existing evidence
  (`SystemInventoryItem`/`IntegrationNeed`). Where something is missing,
  a workflow-scoped `InformationGap` is raised instead — see task item 16.
- **Approvals reuse `HumanApprovalRequest`** (`framework/governance/approvals/`)
  rather than a parallel approval model.
- **Status** (`draft | needs-review | complete`) is a small deterministic
  rule table, never a numeric score — see `statusReasons` for why.

See `docs/architecture/ARCHITECTURE.md` "Workflow Specification Generation"
for the full design rationale, and `docs/architecture/ROADMAP.md` for what's
still deferred to Phase 4 (Integration Architecture — REST payloads, API
clients, real vendor connections) and beyond (exporters to concrete
orchestration engines).
