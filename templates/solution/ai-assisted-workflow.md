# Project: <Business Name>

<!--
Starter template for a scenario that includes an AI assistant alongside a
business process. Builds on templates/solution/business-automation.md — copy
that template's Business/Goals/Users/Business Processes/Existing
Systems/Data/Integrations/Requirements/Desired Outcomes sections in
alongside this one.

IMPORTANT — read before filling this in:
Stitchfy recognizes exactly ONE AI-specific heading: "## AI Agent Needs"
(aliases: "AI Agent", "AI Assistant", "AI Capabilities", "AI Requirements").
There is no separate parsed heading for "Allowed Actions," "Prohibited
Actions," "Human Approval," "Memory," "Model Requirements," "Escalation," or
"Tool Requirements" — a heading with any of those names would simply be
ignored. Instead, write ALL of those concerns as bullets inside the single
"## AI Agent Needs" section below, one concern per bullet. Stitchfy
classifies each bullet by its own wording (a question/chat bullet becomes a
conversational capability, an availability-check bullet becomes tool-use,
etc.) — see examples/solution/customer-support-agent.md for a worked
example using exactly this shape.

Nothing here is assumed by default: no autonomous operation, no persistent
memory across sessions, and no specific model/provider — say so explicitly
per bullet, or leave the bullet out if genuinely undecided.
-->

## AI Agent Needs
- <what the assistant should be able to do — e.g. "Customers should be able to ask questions about ___">
- <a read-only capability that uses an EXISTING integration above — e.g. "The assistant may check ___ using the existing ___ integration">
- <an explicit prohibition — e.g. "The assistant must not ___ without human approval">
- <another explicit prohibition — e.g. "The assistant may not ___ autonomously">
- <a memory statement — e.g. "Conversation history is only needed during the active session and should not persist after it ends" (say so explicitly; do not leave memory unstated if you want session-only behavior)>
- <a model/provider statement — e.g. "Model or provider has not been selected" (leave the bullet out entirely if you have no opinion yet; do not guess a vendor)>
- <an escalation statement — e.g. "When the assistant cannot confidently answer, route the conversation to a human">

<!--
Human-approval boundaries that apply to the WORKFLOW itself (e.g. "a
conflicting request always requires employee approval before confirmation")
belong in "## Business Processes" / "## Requirements" (Workflow Automation's
own headings, see business-automation.md), not here — Workflow Automation
and AI Agents each read their own evidence and are cross-referenced, not
merged.
-->
