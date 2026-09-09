# Reference Solutions

Three canonical, end to end worked examples. Each is a coherent business scenario (not a concatenation of the smaller `examples/solution/` files) that exercises a real combination of capabilities together, proving they operate as one traceable framework rather than as independent generators. See `docs/reference/END_TO_END.md` for the general walkthrough and `docs/reference/CAPABILITY_MATRIX.md` for exactly which capability fires in which scenario, generated from real runs.

## `appointment-automation-ai.md`: Appointment Automation & AI

A small wellness studio wants online appointment requests, a calendar integration, and a customer facing AI assistant, with a hard rule that a conflicting appointment always needs human approval before confirmation, and that conversation memory never outlives the session.

**Capabilities exercised:** Business Discovery, Workflow Automation (with human in the loop conflict approval), Integrations, AI Agents, Security & Governance, Observability, and, at low confidence (`needs-review`), Cloud Architecture, triggered purely by the AI agent's own need to host its runtime, not by any deployment language in the document. See `docs/reference/APPOINTMENT_AUTOMATION_AI.md`.

```bash
npm run solution -- --input examples/reference/appointment-automation-ai.md --output output/reference/appointment-automation-ai
```

**Expected output:** `output/reference/appointment-automation-ai/{context,blueprints,artifacts,reports}/`.

## `order-platform.md`: Operational Order Platform

A solution managed Order API and background Order Processor forward customer orders to an external Fulfillment API, with explicit deployment, resilience, and operational alerting requirements, and a REST integration contract detailed enough to reach export readiness `ready`.

**Capabilities exercised:** Business Discovery, Workflow Automation, Integrations (REST, exported via `generic-rest-typescript`), Security & Governance, Observability, Cloud Architecture (provider deliberately left unspecified). See `docs/reference/ORDER_PLATFORM.md`.

```bash
npm run solution -- --input examples/reference/order-platform.md --output output/reference/order-platform
```

**Expected output:** the same four output dirs, plus generated TypeScript integration scaffolding under `output/reference/order-platform/artifacts/integrations/exporters/fulfillment-api/generic-rest-typescript/`.

## `legacy-java-modernization.md`: Legacy Java Modernization

An internal Order Portal must move from IBM WebSphere to Apache Tomcat without disrupting existing order operations, its integration with the Integration Gateway, or its own order database.

**Capabilities exercised:** Business Discovery, Integrations, Security & Governance, Observability, Legacy Modernization, Codebase Evidence Analysis (against the read only fixture repository at `tests/fixtures/codebases/legacy-java-maven`), and the `generic-java-replatform` Modernization Exporter. See `docs/reference/LEGACY_JAVA_MODERNIZATION.md`.

```bash
npm run solution -- \
  --input examples/reference/legacy-java-modernization.md \
  --output output/reference/legacy-java-modernization \
  --codebase tests/fixtures/codebases/legacy-java-maven \
  --system-id SYS-001 \
  --modernization-export generic-java-replatform
```

`--codebase`, `--system-id`, and `--modernization-export` are all optional. Omit them to run architecture only, exactly as the other two scenarios do.

**Expected output:** the same four output dirs, plus `output/reference/legacy-java-modernization/analysis/codebase/` (repository evidence) and `output/reference/legacy-java-modernization/artifacts/modernization/exporters/legacy-java-maven/generic-java-replatform/` (the migration recipe and change proposals).

## Running all three at once

```bash
npm run reference:validate
```

Runs all three scenarios, checks the semantic invariants above, and writes `output/reference/reference-validation.md` and `.json`. No network calls, no `STITCH_API_KEY` or `OPENAI_API_KEY` required, and the codebase fixture is never modified.
