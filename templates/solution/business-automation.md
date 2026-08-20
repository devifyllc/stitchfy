# Project: <Business Name>

<!--
Starter template for a general business-process scenario: a business wants
to automate a process, integrate with a system it already uses, and keep
that automation observable and reviewable. Exercises Workflow Automation +
Integration Architecture, plus the cross-cutting Security/Governance and
Observability capabilities (which have no dedicated headings of their own —
see the note under "## Requirements" below).

Every heading below is a REAL heading Stitchfy's discovery extractors
recognize. Leave a bullet out entirely if the fact isn't known yet — do not
fill it with a guess. See examples/solution/appointment-business.md and
examples/solution/invoice-approval.md for two worked examples using exactly
this shape.
-->

## Business
- **Business Name:** <name>
- **Industry:** <industry — free text; a small set of keywords (beauty, wellness, medical, restaurant) get special handling elsewhere in the framework>
- **Description:** <one paragraph: what the business does today, and the automation opportunity>

## Goals
- <one goal per bullet — what should get better>

## Users
- <one role per bullet — who is involved in the process>

## Business Processes

<Process Name>

Trigger:
<what starts the process>

Actors:
<one role per line>

Current systems:
<one system name per line — leave empty if the process is currently fully manual>

Steps:
1. <step>
2. <step>

Pain points:
- <what's currently wrong — optional>

Business rules:
- <a constraint that must always hold, e.g. an approval requirement — optional>

Automation candidates:
- <a specific automatable step — optional, but drives Workflow Automation's confidence>

## Existing Systems
- <system name — repeat "## Business Processes"'s "Current systems" list here if useful>

## Data
- <a data entity the process touches — mention explicitly if it's sensitive (health, payment, personal, etc.); do not omit sensitivity language if it applies>

## Integrations
- <Source> sends/receives <what> to/from <Target>.
  Integration method: <REST over HTTPS / webhook / JDBC / ... — leave out if unknown>
  Authentication: <api-key / oauth2 / ... — leave out if unknown>

## Requirements
<!--
No "## Security Requirements" or "## Observability Requirements" heading
exists. Security & Governance and Observability are cross-cutting — they
read the Workflow/Integration/Data facts above plus plain bullets here.
Mentioning secrets, audit trails, access control, alert thresholds, or
compliance-framework names here is how those two capabilities get
evidence; a bullet with no such language produces no fabricated
requirement.
-->
- <a requirement that mentions e.g. audit trail, access control, notification-on-failure, or a measurable threshold — optional>

## Desired Outcomes
- <what "done" looks like, in business terms>
