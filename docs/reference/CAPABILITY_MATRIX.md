# Capability Coverage Matrix

Generated from real `npm run solution` runs of the three canonical reference
solutions (`examples/reference/`), not from what Stitchfy is theoretically
capable of. A ✓ means the capability actually executed and produced
artifacts in that run; a blank (`—`) means it was assessed and not selected
(or, for Codebase Analysis / the two exporters, not requested). Re-generate
and re-verify this table with `npm run reference:validate`, which checks it
against live output rather than letting it drift.

| Capability | Appointment Automation & AI | Operational Order Platform | Legacy Java Modernization |
|---|---|---|---|
| Discovery | ✓ | ✓ | ✓ |
| Planning | ✓ | ✓ | ✓ |
| Workflow Automation | ✓ | ✓ | — |
| Integrations | ✓ | ✓ | ✓ |
| AI Agents | ✓ | — | — |
| Security & Governance | ✓ | ✓ | ✓ |
| Observability | ✓ | ✓ | ✓ |
| Cloud / Deployment | ✓ *(see note)* | ✓ | — |
| Legacy Modernization | — | — | ✓ |
| Codebase Evidence Analysis | — | — | ✓ |
| Integration Export (`generic-rest-typescript`) | — | ✓ (readiness: `ready`) | — |
| Modernization Export (`generic-java-replatform`) | — | — | ✓ (readiness: `needs-review`) |

## Notes on non-obvious results

- **Cloud in Appointment Automation & AI is `needs-review` at `low` confidence**, not `recommended`. The scenario deliberately contains no `## Deployment Requirements` section — Cloud fires anyway because the AI agent's own tools/permissions are, per `framework/capabilities/cloud/cloud.assessor.ts`, "active software logic the solution itself would need to host, even before anything is known about where model inference runs." This is a real, evidence-based cross-capability signal (an `AIAgentNeed` alone is a *supporting*, not *strong*, signal — it only reaches `needs-review`), not a fabricated one. It is exactly the kind of coherent, non-obvious interaction Phase 9 exists to surface and regression-test — see `tests/reference-solutions.test.ts`.
- **Workflow Automation selects for the Order Platform scenario** even though its business process is a simple three-step handoff with no explicit approval step — driven by the process spanning multiple systems and actors, plus multiple automation-candidate/operational requirement bullets. Not assumed in advance; confirmed by the real run.
- **`Legacy Java Modernization` selects Integrations, Security & Governance, and Observability** even though the scenario is modernization-focused — the Order Portal → Integration Gateway (REST) and Order Portal → Order Database (JDBC) integrations are real `IntegrationDefinition`s, and Security/Observability are cross-cutting capabilities that read those plus the modernization preservation language.
- **`PRESERVE-003`** ("The Order Database technology must not change") classifies as `PreservationRequirement.type: "integration-contract"`, not `"data"` — a pre-existing Phase 8 classification detail (it matches via a JDBC integration's `mentionedDependency`, not a `"data"`-type keyword), unrelated to Phase 9 and out of scope to change here. `tests/reference-solutions.test.ts` verifies the exporter's own `"data"`-category handling separately, against a synthetic fixture, rather than assuming this example exercises it.
