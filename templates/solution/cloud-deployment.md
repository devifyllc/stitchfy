# Project: <Business Name>

<!--
Starter template for the deployment/hosting side of a solution-managed
platform. Builds on templates/solution/api-platform.md or
business-automation.md for the surrounding sections; this template focuses
on "## Deployment Requirements" in detail.

Stitchfy recognizes EIGHT heading aliases as the same deployment-needs
family — use whichever name reads most naturally for your document, they
are genuine synonyms, not different concepts:
  Deployment Requirements | Runtime Requirements | Hosting Requirements
  Infrastructure Requirements | Cloud Requirements | Environment Requirements
  Scalability Requirements | Resilience Requirements

Only write a bullet for something you actually know. Cloud Architecture is
only ever generated from explicit bullets like these (or, independently,
from an AI Agent Need that implies the solution itself must host
orchestration logic) — never fabricated just because a business sounds
"technical." See examples/solution/cloud-order-platform.md for a full
worked example, and examples/solution/cloud-provider-explicit.md for the
smallest possible one.
-->

## Deployment Requirements
- <e.g. "The solution includes a solution-managed <Component> that <does something>." — one bullet per solution-owned component; a THIRD-PARTY system your solution merely calls (like a Fulfillment API) is never a deployment unit>
- <e.g. "The <Component> must be publicly reachable over HTTPS." or "... must not expose a public endpoint.">
- <e.g. "The business requires separate Test and Production environments.">
- <e.g. "<Component> state must persist and survive application restarts.">
- <e.g. "Production must support at least N concurrent <requests/orders/...>.">
- <e.g. "The solution must continue operating when <external system> is temporarily unavailable.">
- <e.g. "Cloud provider requirement: <AWS/Azure/GCP/...>" — leave out entirely if no provider has been chosen; "No cloud provider has been selected" is also a valid, explicit bullet that records the gap rather than hiding it>
- <e.g. "No database technology has been selected." — same idea; explicit "not yet decided" beats silence>
- <e.g. "Region: <region>" — leave out if not yet decided>
