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

See `docs/architecture/ROADMAP.md` for what comes next.
