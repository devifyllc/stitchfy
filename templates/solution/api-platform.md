# Project: <Business Name>

<!--
Starter template for an integration-centric scenario — a system that talks
to another system over an API. Builds on
templates/solution/business-automation.md for the surrounding
Business/Goals/Users/Business Processes/Existing Systems sections; this
template focuses on "## Integrations" in full detail.

The sub-fields below are all real, independently recognized fields (see
examples/solution/rest-export-ready.md for a worked example). The more of
them you supply explicitly, the more likely the generated
IntegrationDefinition reaches export readiness "ready" instead of
"needs-review" for the generic-rest-typescript exporter — but nothing here
is required. An omitted field becomes an explicit information gap, never a
guess.
-->

## Integrations
- <Source system> sends <what> to <Target system>.
  Integration method: <REST over HTTPS / webhook / GraphQL / JDBC / ... — leave out if unknown>
  Base URL: <https://... — leave out if unknown; becomes required external configuration otherwise>
  Endpoint: <METHOD /path — e.g. "POST /v1/orders" — leave out if unknown>
  Authentication: <api-key / oauth2 / basic / none — leave out if unknown>
  Authentication placement: <e.g. "X-API-Key request header" — only meaningful once Authentication is known; affects export readiness>
  Request fields: <name (type, required/optional), ... — one line, comma-separated>
  Response fields: <name (type, required/optional), ... — one line, comma-separated>

<!--
Repeat the block above once per integration. A system mentioned only here
(never in "## Existing Systems" or a Business Process) is still recognized,
but naming it in "## Existing Systems" as well gives it a stable system id
other capabilities (Security & Governance, Observability, Cloud) can
reference.
-->

## Requirements
<!--
Operational facts about THIS integration — correlation ids, retry/alerting
behavior, and log-safety statements — belong here as plain bullets (see
examples/solution/operational-order-processing.md). There is no separate
"API Requirements" heading.
-->
- <e.g. "Every request must have a correlation identifier.">
- <e.g. "Operations must be notified after N consecutive failed submissions.">
- <e.g. "Credentials and payloads must not appear in operational logs.">

## Desired Outcomes
- <what "done" looks like for this integration>
