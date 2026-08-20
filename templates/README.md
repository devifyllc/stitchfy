# Templates

Starting points for writing your own Markdown input, one per common scenario
shape. Copy the sections you need — every heading is a real, recognized
Stitchfy heading (never an invented one), and every bullet is written as
"fill in if known, leave out if not" rather than a default to accept as-is.

**Templates vs. examples:** templates (this directory) are blank starting
points meant to be copied and filled in. `examples/` holds completed,
already-filled-in scenarios meant to be read or run as-is — including the
three canonical, end-to-end references under `examples/reference/` (see
`examples/reference/README.md`) and the smaller, single-capability examples
under `examples/solution/`.

## `solution/` — Solution Architecture pipeline (`npm run solution`)

| Template | For | Recognized headings |
|---|---|---|
| `business-automation.md` | A business process to automate, plus an existing system to integrate with | `## Business`, `## Goals`, `## Users`, `## Business Processes`, `## Existing Systems`, `## Data`, `## Integrations`, `## Requirements`, `## Desired Outcomes` |
| `ai-assisted-workflow.md` | Adding an AI assistant alongside a business process | `## AI Agent Needs` (the only recognized AI heading — see the template's own note on why there is no separate heading per concern) |
| `api-platform.md` | An integration-centric system talking to another system over an API | `## Integrations` with the full REST sub-field set (method/base URL/endpoint/auth/auth placement/request+response fields), `## Requirements` |
| `cloud-deployment.md` | The hosting/deployment side of a solution-managed platform | `## Deployment Requirements` (and its 7 synonyms — see the template) |
| `legacy-modernization.md` | Assessing or planning a legacy-system modernization | `## Existing Systems`, `## Modernization Requirements`, `## Modernization Drivers`, `## Preservation Requirements`, `## Migration Constraints`, `## Target State Requirements`, `## Deployment Requirements` (optional) |

Combine templates freely — e.g. `business-automation.md` + `api-platform.md`
+ `cloud-deployment.md` for an operational API platform, or
`business-automation.md` + `ai-assisted-workflow.md` for an AI-assisted
business process. `examples/reference/` shows three such combinations
already filled in.

## Unknown-value policy

Every template follows the same rule: an unknown value is a bullet you
**leave out**, never a bullet you fill with a guess. Stitchfy represents an
unresolved fact as an explicit information gap rather than inventing a
default — filling in a guessed value would hide that gap instead of
surfacing it.

## Website generator

`input/project.md` (the original Markdown-to-static-website pipeline,
`npm run stitchfy`) has its own template shape — see the "Writing Your
Input" section of the top-level `README.md`, not this directory.

## Legacy per-capability placeholders

`templates/workflow/`, `templates/ai-agent/`, `templates/integration/`,
`templates/cloud/`, `templates/modernization/` are earlier, capability-named
placeholders from when those capabilities did not yet have a real
`execute()`. All five are now implemented; each stub now just points here
and at its capability's own `framework/capabilities/*/README.md`.
