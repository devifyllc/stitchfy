# AI Agent: Riverside Wellness Studio Assistant

_Status: **complete**_

> `implemented: true` on this capability means Stitchfy generated and validated vendor-neutral AI Agent architecture specifications based on the currently known business solution. It does not mean an LLM was executed, an AI agent was deployed, tools were invoked, outputs are accurate, or the agent is safe, compliant, or production-ready.

## Purpose

Customers should be able to ask the assistant questions about services and studio policies.

## Interaction Mode

conversational

## Autonomy

assistive

## Model Requirements

- Provider: unresolved
- Model: unresolved
- Capabilities: text-generation, tool-use
- Structured output required: unknown
- Tool use required: unknown

## Inputs

- **Customer message** — Natural-language input from the user — no structured schema captured by Discovery.

## Outputs

- **Assistant response** — Natural-language response to the user — no structured schema captured by Discovery.

## Tools

- **The system checks Google Calendar for availability** _(integration-operation, side effect: read)_ — The system checks Google Calendar for availability

## Permissions

- read

## Memory

- Mode: session
- Purpose: Conversation history is only needed during the active customer session and should not persist after the session ends.
- Contains sensitive data: true

## Human Oversight

None identified.

## Guardrails

- _(prohibited-action)_ The assistant must not confirm a conflicting appointment without front-desk employee approval — conflict approval can never be bypassed.
- _(prohibited-action)_ The assistant may not cancel appointments autonomously.
- _(prohibited-action)_ Conversation history is only needed during the active customer session and should not persist after the session ends.
- _(prohibited-action)_ When the assistant cannot confidently answer from known business information, escalate the conversation to a front-desk employee.

## Escalation

None identified.

## Information Gaps

- **Model / provider selection**: Which model/provider will satisfy the required capabilities (text-generation, tool-use)?

## Related Workflows

None.

## Related Integrations

INT-001

## Security / Governance Considerations

Security and governance requirements applying to this agent are generated separately by the Security & Governance capability (which runs after AI Agents) — see output/artifacts/security-governance/.

## Traceability

Related needs: AINEED-001
Evidence references: 1
