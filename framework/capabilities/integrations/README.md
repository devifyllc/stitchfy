# Integrations Capability

Status: **fully implemented capability** — the second non-website capability
(after Workflow Automation) to go from structured selection through a
validated, artifact-producing specification. `implemented: true` means
Stitchfy generated and validated one or more vendor-neutral integration
specifications — it does **not** mean Stitchfy connected to or exchanged
data with any external system. No vendor client, OAuth flow, HTTP call, or
credential store exists anywhere in this module.

## Pipeline

```
DiscoveryResult
     ↓ integrations.assessor.ts        (structured, explainable selection)
CapabilityAssessment
     ↓ integrations.planner.ts         (candidate discovery + deduplication)
IntegrationPlan
     ↓ generators/integration-definition.generator.ts   (vendor-neutral contract)
IntegrationDefinition[]
     ↓ validators/integration-definition.validator.ts   (referential integrity, boundary, duplicates)
     ↓ generators/integration-artifact.generator.ts     (JSON + Markdown-with-Mermaid, + OpenAPI when justified)
ImplementationArtifact[]  →  output/artifacts/integrations/
     ↓ exporters/ (Phase 5.5A, run separately from solution-orchestrator.ts — see below)
IntegrationExportBundle[]  →  output/artifacts/integrations/exporters/<slug>/<target>/
```

## Structure

```
integrations/
├── generators/
│   ├── integration-definition.generator.ts   ← IntegrationCandidate → IntegrationDefinition
│   └── integration-artifact.generator.ts     ← IntegrationDefinition → JSON/Markdown/OpenAPI artifacts
├── validators/
│   └── integration-definition.validator.ts   ← referential integrity, same-system-boundary, duplicates
├── exporters/                                 ← Phase 5.5A — IntegrationDefinition → implementation scaffolding
│   ├── exporter.types.ts, exporter-registry.ts, default-exporters.ts, generate-integration-exports.ts
│   ├── naming/typescript-identifier.ts
│   └── generic-rest-typescript/               ← the first concrete exporter (see exporters/README.md)
├── schemas/
│   ├── integrations.types.ts
│   └── integrations.schema.ts
├── integrations.assessor.ts   ← structured, explainable supports()/assess()
├── integrations.planner.ts    ← IntegrationPlan (candidate discovery + dedup)
└── integrations.capability.ts
```

The Phase 0 planned structure (`api/`, `webhooks/`, `saas/` subfolders) is
superseded by this — REST/webhook are optional *specializations* on
`IntegrationDefinition`, not separate top-level protocol folders (see
below).

## Key design points

- **`IntegrationDefinition` is generic and vendor-neutral** — `sourceSystemId`/
  `targetSystemId` (both optional — a system merely appearing in a process
  is not enough evidence of a boundary crossing; only an explicit
  `IntegrationNeed`, or two systems named together in one sentence, resolves
  them), `direction`, `interactionPattern`, `protocol`, `operations`,
  `dataContracts`, `authentication`, `reliability`, `security` — all
  classified by deterministic regex over already-structured text, **never**
  inferred from a system's name or category alone (a system categorized
  `saas` does not imply REST — see `ARCHITECTURE.md`).
- **Unknown stays unknown.** Every classification defaults to `"unknown"`
  (or `boolean | "unknown"` for reliability/security flags) unless the
  exact triggering text is found. `REST`/webhook contracts are only
  attached when explicit method+path or webhook language exists —
  `framework/discovery/integrations/integration-need.types.ts`'s optional
  `details` field (Phase 1, additive) is where that explicit text is
  captured; nothing is invented in this capability.
- **Deduplication**: the same logical integration mentioned across a
  process, a requirement, a desired outcome, and a workflow becomes *one*
  `IntegrationDefinition` with merged evidence — never duplicates. Uses the
  same deterministic keyword-overlap technique as Workflow Automation
  (`sharesSignificantWord`, `framework/discovery/shared/section-lookup.ts`).
- **Workflow cross-referencing without capability-order coupling**: the
  assessment (selection) only ever reads `DiscoveryResult` — `WorkflowDefinition`
  doesn't exist yet at planning time. `execute()` (which runs after
  Workflow Automation, per the existing, unchanged registry order) reads
  `context.capabilityResults` for workflow-automation's output purely to
  *enrich* `relatedWorkflowIds`/`operations` — never to change whether
  Integrations was selected. See `ARCHITECTURE.md` "Integration Architecture"
  for the full reasoning.
- **Operations come from workflow steps**, not `WorkflowStep.systemIds`
  (rarely populated) — derived by matching the target system's name against
  step description text, same technique used throughout.
- **Existing Discovery gaps are referenced, never silently resolved**: if a
  blocking customer-data gap already exists, a new integration-level gap
  points back to it by id instead of guessing a data-sensitivity answer.

See `docs/architecture/ARCHITECTURE.md` "Integration Architecture" (Phase 4)
and "Integration Export Adapter Foundation" (Phase 5.5A) for the full design
rationale, `exporters/README.md` for the Exporter/Provider boundary, and
`docs/architecture/ROADMAP.md` for **Phase 5.5B — Runtime Integration
Providers** (real vendor clients, OAuth flows, an implemented
`IntegrationProvider`) and beyond.
