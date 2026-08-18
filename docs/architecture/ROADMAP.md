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

## Phase 1 — Business Discovery

- Replace the heading-lookup heuristic in `business-discovery.agent.ts` with
  richer extraction (multi-section goals/pain-points, confidence scoring).
- Populate `framework/discovery/{processes,systems,constraints,requirements}/`
  from real input instead of leaving them as empty typed arrays.
- Add an OPENAI INTEGRATION POINT to business discovery, matching the
  existing blueprint agents' pattern.

## Phase 2 — Website Capability Migration

- Move `framework/agents/*`, `site-generator.ts`, `stitch-generator.ts`
  under `framework/capabilities/website/{agents,generators,validators}/`
  without changing behavior.
- Decide whether `WebsiteBlueprint` becomes a capability-owned schema
  referenced by `SolutionBlueprint`, or stays fully independent.

## Phase 3 — Workflow Automation

- Real `triggers`/`steps`/`decisions`/`approvals` derivation from
  `BusinessContext.processes`.
- First real use of `framework/governance/approvals` from a capability
  output (workflow approval steps).

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
  `BusinessContext.businessRules`/`constraints`/`data` plus the existing
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
