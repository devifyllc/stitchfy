# Integration Exporters (Phase 5.5A)

Status: **first exporter implemented** (`generic-rest-typescript`). Converts a validated, vendor-neutral `IntegrationDefinition` into implementation-oriented TypeScript scaffolding. `implemented`-style semantics: producing and validating an export bundle means Stitchfy generated reviewable scaffolding for the currently known integration — it does **not** mean that code runs, connects to anything, or is production-ready. No network call, vendor SDK, or credential value exists anywhere in this module.

## Exporter vs. Provider — do not conflate

| | Exporter (this directory) | Provider (`framework/providers/integrations/integration-provider.types.ts`) |
|---|---|---|
| Answers | "What implementation scaffolding can be generated from this architecture?" | "How do I actually call this external system?" |
| Input | `IntegrationDefinition` (a domain model) | `IntegrationRequest` (a real HTTP call) |
| Output | Generated source files (`ImplementationArtifact[]`) | `IntegrationResponse` (a real HTTP result) |
| Executes anything? | Never | Would, if implemented |
| Status today | `generic-rest-typescript` implemented | Still a pure, unimplemented type — no concrete provider exists |

`IntegrationExporter` does not extend, import, or call `IntegrationProvider` (or vice versa) — they solve different problems on purpose. A future Phase 5.5B could implement a real `IntegrationProvider` that *executes* the transport a generated client's `HttpTransport` interface describes, but that is out of scope here.

## Pipeline

```
IntegrationDefinition (validated, Phase 4)
     ↓ exporter-registry.ts findSupported()   (source of truth: restContract, never system name/SaaS category)
IntegrationExporter
     ↓ assessReadiness()                       (consumes SecurityArchitecture — never regenerates it)
ExportReadiness (ready | needs-review | blocked | unsupported)
     ↓ export()                                (generic-rest-typescript.generator.ts)
IntegrationExportBundle  →  output/artifacts/integrations/exporters/<slug>/<target>/
```

Invoked from `solution-orchestrator.ts` (`generate-integration-exports.ts`) *after* the full capabilities loop — see `docs/architecture/ARCHITECTURE.md` "Integration Export Adapter Foundation (Phase 5.5A)" for why this can't live inside `integrations.capability.ts`'s own `execute()` (Security & Governance, which export readiness depends on, registers *after* Integrations and hasn't run yet at that point).

## Readiness semantics

No numeric score. `ready`: enough explicit information for a meaningful skeleton (REST method+path known; an unknown `baseUrl` is fine — it becomes required external configuration). `needs-review`: a real skeleton can still be generated, but something implementation-relevant stays unresolved (auth mechanism, or a known mechanism with unresolved placement, or unresolved data sensitivity) — the bundle is still produced, visibly incomplete. `blocked`: used sparingly, only when a `SecurityRequirement` applying to this integration is both `priority: "required"` and `status: "needs-information"` — produces readiness/reasons/references but no client/types/config source. `unsupported`: the integration doesn't match this exporter's target (e.g. `interactionPattern: "unknown"`, no `restContract`) — not an error, no bundle produced at all.

## Unknown-value preservation

Everything follows the same rule as the rest of this codebase: unknown stays unknown. Unresolved API-key placement never becomes a guessed `Authorization`/`X-API-Key` header. An unresolved request/response field type becomes TypeScript `unknown`, never an invented shape. Unresolved requiredness renders as an optional (`?:`) property — documented, not silently made required. `DataContractField.name` is always free text from the source ("Order identifier," never a real wire field name) — every generated interface carries a disclaimer comment saying so.

## Generated artifacts

5 files per bundle: `client.ts` (transport-abstracted class, every method throws `"Transport implementation not configured."` — Stitchfy never executes this), `types.ts`, `config.ts` (credential *shape* only, never a credential *value*), `integration.manifest.json`, `README.md` (exact disclaimer: "This output is implementation scaffolding generated from the currently known IntegrationDefinition. It does not establish that the integration is production-ready, secure, authenticated, deployed, or operational.").

## Future work

`docs/architecture/ROADMAP.md`'s **Phase 5.5B — Runtime Integration Providers** — real `HttpTransport` implementation, credential injection, OAuth lifecycle, retries/timeouts, vendor adapters. None of that is implemented here.
