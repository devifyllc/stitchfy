# Legacy Modernization Capability

Status: **fully implemented capability** — the eighth and last capability to go from structured selection through a validated, artifact-producing specification, and the last of the **cross-cutting** capabilities: it inspects `IntegrationDefinition[]`, `SecurityArchitecture`, `ObservabilityArchitecture`, and `CloudArchitecture` — every other real capability's output — rather than producing its own architecture from Discovery alone. `implemented: true` means Stitchfy generated and validated a legacy-modernization assessment and migration-strategy architecture from currently known evidence — it does **not** mean application code was analyzed, code was migrated, dependencies were upgraded, databases were converted, tests passed, production behavior was preserved, a target system was deployed, or migration risk was eliminated. No source-code/repository analysis, external lifecycle/CVE lookup, or code generation (Java/Spring/Dockerfiles/Terraform/Kubernetes/migration scripts) exists anywhere in this module.

Modernization answers **"should this system change, and if so how"** — never assumes legacy = replace/rewrite/cloud/microservices/containerization. A system may be assessed and **retained**. Does not create a second system inventory — every profile/dependency/candidate references `SystemInventoryItem.id` (Phase 1); nothing here duplicates name/technology/purpose unnecessarily.

## Pipeline

```
DiscoveryResult (modernizationNeeds: ModernizationNeed[] — Phase 8, one aggregate per document)
     ↓ modernization.assessor.ts       (structured, explainable selection)
CapabilityAssessment
     ↓ modernization.planner.ts        (candidate systems — real objects built later)
ModernizationPlan
     ↓ execute() reads Integrations', Security & Governance's, Observability's, and Cloud's sibling output
IntegrationDefinition[], SecurityArchitecture, ObservabilityArchitecture, CloudArchitecture
     ↓ generators/modernization-profile.generator.ts    (profiles, dependencies, technical debt, preservation, seams)
     ↓ generators/migration-strategy.generator.ts        (constraints, strategy classification, target-state, risks)
     ↓ generators/modernization-roadmap.generator.ts     (workstreams)
     ↓ generators/modernization-architecture.generator.ts (orchestration, information gaps, status)
ModernizationArchitecture
     ↓ validators/modernization.validator.ts   (referential integrity, provenance, candidate scope)
     ↓ generators/modernization-artifact.generator.ts    (JSON/Markdown/Mermaid artifacts)
ImplementationArtifact[]  →  output/artifacts/modernization/
```

## Structure

```
modernization/
├── generators/
│   ├── modernization-profile.generator.ts     ← current-state half (profiles/dependencies/debt/preservation/seams)
│   ├── migration-strategy.generator.ts        ← future-state half (constraints/strategy/target-state/approach/risks)
│   ├── modernization-roadmap.generator.ts     ← workstreams
│   ├── modernization-architecture.generator.ts ← orchestration + information gaps + status
│   └── modernization-artifact.generator.ts    ← ModernizationArchitecture → JSON/Markdown/Mermaid artifacts
├── validators/
│   └── modernization.validator.ts             ← referential integrity, candidate scope, provenance
├── schemas/
│   ├── modernization.types.ts
│   └── modernization.schema.ts
├── modernization.assessor.ts   ← structured, explainable supports()/assess()
├── modernization.planner.ts    ← ModernizationPlan (candidate systems)
└── modernization.capability.ts

../../discovery/modernization/
├── modernization-need.types.ts        ← the new Discovery entity
└── modernization-needs.extractor.ts   ← extraction from 12 dedicated section-heading aliases
```

## Key design points

- **Registry position unchanged.** Modernization already ran last in `default-capabilities.ts` (website, workflow-automation, integrations, ai-agents, security-governance, observability, cloud, **modernization**) — no reorder was needed for this phase.
- **`ModernizationNeed` is a deliberate aggregate, not a per-bullet atom.** Unlike `DeploymentNeed` (Phase 7B), the given interface (`systemIds, drivers, desiredOutcomes, preservationNeeds, constraints`) is one consolidated record. The extractor recognizes 12 heading aliases, partitioned into 6 semantic buckets (general-intent, goals, drivers, technical debt, constraints, preservation) and produces exactly one `ModernizationNeed` per document — never split per system, since nothing in the source text reliably distinguishes multiple concurrent modernization efforts.
- **A system named only in a preservation bullet is never promoted into modernization scope.** `systemIds` is resolved from `desiredOutcomes` text only, never from `preservationNeeds` text — "existing integration behavior with the Integration Gateway must remain compatible" mentions the Integration Gateway as a *constraint on Order Portal's own modernization*, not as evidence Integration Gateway itself should be modernized. This generalizes task item 66's "Legacy app → Salesforce does not imply Salesforce should be modernized" restraint beyond just external SaaS systems — the first implementation of this extractor got it wrong and pulled in every system merely mentioned anywhere in the modernization text, caught and fixed during this phase's own verification.
- **Selection signals**: `modernizationNeeds.length > 0` or explicit modernization/migration terminology in structured requirement/constraint/business-rule text are **strong**. A `SystemInventoryItem` explicitly classified `category: "legacy"` is a **supporting-only** signal — it alone reaches `needs-review` at low confidence, never `recommended`, and never selects a specific strategy by itself (task item 64). One small, justified addition to Phase 1's `systems.extractor.ts`: `classifyCategory()` previously had no path that ever produced `category: "legacy"` (a dead enum value) and never looked at `purpose` text — a new, most-specific-first `/\blegacy\b/i` pattern (checked against `name + purpose`) was added so this signal is real, not theoretical.
- **Every `ModernizationStrategy` enum value is reachable only through an explicit keyword/pattern match** — never from "legacy"/"monolith"/"old" language alone. An explicit "move the application from WebSphere to Tomcat" produces `replatform` plus a `ModernizationDelta` with the target technology preserved verbatim; explicit `rewrite`/`from scratch` → `replace`; explicit `retire`/`decommission` → `retire`; and so on for `rehost`/`refactor`/`rearchitect`/`encapsulate`/`retain`. When modernization intent exists but no pattern matches, exactly **one** fallback `{strategy: "unknown", status: "needs-review"}` option is produced — never a speculative menu of alternatives.
- **Dependencies are derived only from real `IntegrationDefinition`s** where both `sourceSystemId`/`targetSystemId` resolve — direction/protocol/interaction-pattern reused verbatim, never re-inferred. No source-code/module-level dependency (presentation module, DAO layer, EJB layer, ...) is ever invented — this phase does not inspect source code.
- **Preservation is the core concept.** `PreservationRequirement` answers "what must not be accidentally lost while changing technology" — derived from explicit preservation-language bullets, cross-referencing real `SecurityRequirement`/`OperationalObjective` ids only when they apply to an in-scope system's actual integration (a small additive `relatedSecurityRequirementIds`/`relatedObservabilityObjectiveIds` field pair, keeping the established "evidenceRefs always points at Discovery, cross-capability ids live in a dedicated field" convention from `CloudSecurityMapping`/`CloudObservabilityMapping`).
- **Risks are exactly two deterministic, evidence-required rules** — a shared-database dependency (≥2 dependencies targeting the same database system) and an explicit coexistence window — not a checklist of every possible migration risk. `RiskAssessment.category` gained one additive value, `"modernization"`.
- **No fake schedule, no fake sequence.** `ModernizationWorkstream.sequence`/`prerequisiteIds` are never populated without explicit sequencing evidence — dependency direction alone never determines migration order (task item 53); neither example in this phase produces any.
- **A real bug caught during this phase's own verification, unrelated to Modernization itself**: `observability.capability.ts`'s `validate()` only checked `signals.length`/`metricRequirements.length`, not `healthRequirements.length`, so an architecture with only health requirements (exactly what this phase's Java example produces) was incorrectly flagged as `implemented: true` with "no observability architecture was produced." Fixed by adding the missing check — a one-line correction to a validation gate, not a change to any generated architecture.

See `docs/architecture/ARCHITECTURE.md` "Legacy Modernization Assessment and Migration Strategy Architecture (Phase 8)" for the full design rationale, and `docs/architecture/ROADMAP.md` for **Phase 8.5 — Codebase Analysis and Modernization Export Adapters** (repository/dependency-manifest/build analyzers, migration recipe generation — not implemented here).
