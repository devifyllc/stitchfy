# Reference Walkthrough: Operational Order Platform

Traces `examples/reference/order-platform.md` through the chain
`business requirement → integration → security → observability →
deployment architecture → REST TypeScript exporter`, using real IDs from an
actual run. See `docs/reference/END_TO_END.md` for the general 8-step
pipeline and artifact taxonomy this walkthrough assumes.

```bash
npm run solution -- --input examples/reference/order-platform.md --output output/reference/order-platform
```

## Business requirement → integration

The `## Integrations` block (method, base URL, endpoint, API-key
authentication with an explicit header placement, and typed request/
response fields) becomes `INT-001` in `IntegrationsSection.integrations` —
a full `IntegrationDefinition` with
`restContract.operations[0] = { method: "POST", path: "/v1/orders" }`,
preserved verbatim from the document, never re-derived or guessed.

**`IntegrationDefinition` ≠ a running integration.** Generating `INT-001`
does not open a connection to the Fulfillment API, does not send an HTTP
request, and does not validate that `https://api.fulfillment.example.test`
actually exists.

## → Security

`SecurityArchitecture.requirements` includes a `secrets` requirement for
the API key and an `integration` requirement for the external-boundary
interaction — both citing `INT-001` via `ArchitectureReference`, never
generated independently of it.

## → Observability

`ObservabilityArchitecture.signals` (6 total) cover the integration's
attempt/success/failure signals plus workflow visibility for the order
submission process; one `AlertRequirement` exists for the document's
explicit "5 consecutive failed submissions" threshold — a real number taken
from the text, never fabricated (see the observability capability's
threshold-provenance validation rule).

## → Deployment architecture

`CloudArchitectureSection.architecture.deploymentUnits` has exactly two
entries, both `responsibility: "solution-managed"`:

- `DEPLOYUNIT-001` — "Order API" (`kind: "api"`, `workloadProfile:
  "request-driven"`)
- `DEPLOYUNIT-002` — "Order Processor" (`kind: "worker"`, `workloadProfile:
  "background"`)

The external Fulfillment API — mentioned throughout the document — is
**not** a deployment unit; only the two components the document explicitly
says the solution itself owns and hosts became one.
`providerRequirement.provider: "unspecified"` — the document deliberately
never names AWS/Azure/GCP, and nothing invents one.

**`CloudArchitecture` ≠ provisioned infrastructure.** Generating these two
deployment units does not create a server, a container, a VPC, or any
billable cloud resource.

## → REST TypeScript exporter

Because `INT-001` has a complete method/path/base-URL/auth-mechanism/
auth-placement/request-response-field contract, `generic-rest-typescript`'s
`assessGenericRestTypeScriptReadiness()` reaches `status: "ready"` (no
warning-severity reasons) and generates one `IntegrationExportBundle` under
`output/reference/order-platform/artifacts/integrations/exporters/fulfillment-api/generic-rest-typescript/`:
`client.ts`, `types.ts`, `config.ts`, `integration.manifest.json`, and a
`README.md` explaining what was generated and what remains to be wired up.

## Runtime boundary

```text
IntegrationDefinition
        ↓
IntegrationExportBundle            (generated TypeScript scaffolding)
        ↓
runtime provider                   — deferred, not implemented
```

No HTTP request to the Fulfillment API — real or mocked — occurs anywhere
in this pipeline or in `npm run reference:validate`. The generated
`client.ts` is source code a person would review, wire up credentials for,
and deploy — see `docs/architecture/ROADMAP.md`'s Phase 5.5B (Runtime
Integration Providers, deferred) and Phase 7C (Cloud/Observability Export &
Runtime Provider Adapters, deferred).
