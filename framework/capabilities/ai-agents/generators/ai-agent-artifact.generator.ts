/**
 * Renders ImplementationArtifacts (task items 44-47) strictly from
 * already-built AIAgentDefinition[] — no new inference happens here.
 * Language stays restrained throughout — never "safe AI"/"hallucination-
 * proof"/"guaranteed accurate" (task item 23).
 */

import { createArtifact } from "../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import { slugify } from "../../../core/slugify.js";
import type { AIAgentDefinition, AIAgentToolSpecification } from "../schemas/ai-agents.types.js";

const CAPABILITY_ID = "ai-agents";
const IMPLEMENTED_NOTE =
  "`implemented: true` on this capability means Stitchfy generated and validated vendor-neutral AI Agent architecture " +
  "specifications based on the currently known business solution. It does not mean an LLM was executed, an AI agent " +
  "was deployed, tools were invoked, outputs are accurate, or the agent is safe, compliant, or production-ready.";

// ─── Per-agent Markdown (task item 45) ─────────────────────────────────────

function renderAgentMarkdown(agent: AIAgentDefinition): string {
  const lines: string[] = [];

  lines.push(`# AI Agent: ${agent.name}`);
  lines.push("");
  lines.push(`_Status: **${agent.status}**${agent.statusReasons.length > 0 ? ` (${agent.statusReasons.join("; ")})` : ""}_`);
  lines.push("");
  lines.push(`> ${IMPLEMENTED_NOTE}`);
  lines.push("");

  lines.push("## Purpose", "", agent.purpose, "");
  lines.push("## Interaction Mode", "", agent.interactionMode, "");
  lines.push("## Autonomy", "", agent.autonomy, "");

  lines.push("## Model Requirements", "");
  lines.push(`- Provider: ${agent.modelRequirements.provider ?? "unresolved"}`);
  lines.push(`- Model: ${agent.modelRequirements.model ?? "unresolved"}`);
  lines.push(`- Capabilities: ${agent.modelRequirements.capabilities.join(", ") || "none identified"}`);
  lines.push(`- Structured output required: ${agent.modelRequirements.structuredOutputRequired}`);
  lines.push(`- Tool use required: ${agent.modelRequirements.toolUseRequired}`);
  lines.push("");

  lines.push("## Inputs", "");
  if (agent.inputContracts.length === 0) lines.push("None identified.");
  else for (const c of agent.inputContracts) lines.push(`- **${c.name}**${c.description ? ` — ${c.description}` : ""}`);
  lines.push("");

  lines.push("## Outputs", "");
  if (agent.outputContracts.length === 0) lines.push("None identified.");
  else for (const c of agent.outputContracts) lines.push(`- **${c.name}**${c.description ? ` — ${c.description}` : ""}`);
  lines.push("");

  lines.push("## Tools", "");
  if (agent.tools.length === 0) lines.push("None identified — no matching integration operation or workflow action was found.");
  else for (const t of agent.tools) lines.push(`- **${t.name}** _(${t.kind}, side effect: ${t.sideEffect})_ — ${t.description}`);
  lines.push("");

  lines.push("## Permissions", "");
  if (agent.permissions.length === 0) lines.push("None granted — tool existence alone does not imply permission.");
  else for (const p of agent.permissions) lines.push(`- ${p.action}${p.condition ? ` (condition: ${p.condition})` : ""}`);
  lines.push("");

  lines.push("## Memory", "");
  lines.push(`- Mode: ${agent.memory.mode}`);
  if (agent.memory.purpose) lines.push(`- Purpose: ${agent.memory.purpose}`);
  lines.push(`- Contains sensitive data: ${agent.memory.containsSensitiveData}`);
  lines.push("");

  lines.push("## Human Oversight", "");
  if (agent.humanOversight.length === 0) lines.push("None identified.");
  else for (const o of agent.humanOversight) lines.push(`- ${o.reason} — approval \`${o.approval.id}\` (${o.approval.decision})`);
  lines.push("");

  lines.push("## Guardrails", "");
  if (agent.guardrails.length === 0) lines.push("None identified.");
  else for (const g of agent.guardrails) lines.push(`- _(${g.type})_ ${g.description}`);
  lines.push("");

  lines.push("## Escalation", "");
  if (agent.escalationPolicy.length === 0) lines.push("None identified.");
  else for (const e of agent.escalationPolicy) lines.push(`- When "${e.trigger}" → ${e.action}`);
  lines.push("");

  lines.push("## Information Gaps", "");
  if (agent.informationGaps.length === 0) lines.push("None.");
  else for (const g of agent.informationGaps) lines.push(`- **${g.topic}**: ${g.question}`);
  lines.push("");

  lines.push("## Related Workflows", "");
  lines.push(agent.relatedWorkflowIds.join(", ") || "None.");
  lines.push("");

  lines.push("## Related Integrations", "");
  lines.push(agent.relatedIntegrationIds.join(", ") || "None.");
  lines.push("");

  lines.push("## Security / Governance Considerations", "");
  lines.push(
    "Security and governance requirements applying to this agent are generated separately by the Security & " +
      "Governance capability (which runs after AI Agents) — see output/artifacts/security-governance/."
  );
  lines.push("");

  lines.push("## Traceability", "");
  lines.push(`Related needs: ${agent.relatedNeedIds.join(", ")}`);
  lines.push(`Evidence references: ${agent.evidenceRefs.length}`);
  lines.push("");

  return lines.join("\n");
}

// ─── Aggregate architecture Markdown ────────────────────────────────────────

function renderArchitectureMarkdown(agents: AIAgentDefinition[]): string {
  const lines: string[] = ["# AI Agent Architecture", "", `> ${IMPLEMENTED_NOTE}`, ""];

  lines.push(`${agents.length} agent(s) generated.`, "");

  for (const agent of agents) {
    lines.push(`## ${agent.name}`, "");
    lines.push(`- Status: ${agent.status}`);
    lines.push(`- Interaction mode: ${agent.interactionMode}`);
    lines.push(`- Autonomy: ${agent.autonomy}`);
    lines.push(`- Tools: ${agent.tools.length}`);
    lines.push(`- Human oversight controls: ${agent.humanOversight.length}`);
    lines.push("");
  }

  const nodes = new Set<string>();
  const edges: string[] = [];
  for (const agent of agents) {
    const agentNode = agent.id.replace(/-/g, "_");
    nodes.add(`${agentNode}["${agent.name.replace(/"/g, "'")}"]`);
    for (const tool of agent.tools) {
      const toolNode = tool.id.replace(/-/g, "_");
      nodes.add(`${toolNode}["${tool.name.replace(/"/g, "'")}"]`);
      edges.push(`${agentNode} --> ${toolNode}`);
    }
    for (const oversight of agent.humanOversight) {
      const oversightNode = oversight.id.replace(/-/g, "_");
      nodes.add(`${oversightNode}{{"${oversight.reason.replace(/"/g, "'").slice(0, 40)}"}}`);
      edges.push(`${agentNode} --> ${oversightNode}`);
    }
  }

  if (nodes.size > 0) {
    lines.push("```mermaid", "flowchart LR", ...[...nodes].map((n) => `    ${n}`), ...edges.map((e) => `    ${e}`), "```", "");
  }

  return lines.join("\n");
}

// ─── Tool catalog (task item 46) ───────────────────────────────────────────

function renderToolCatalogMarkdown(agents: AIAgentDefinition[]): string {
  const lines: string[] = ["# AI Agent Tool Catalog", "", `> ${IMPLEMENTED_NOTE}`, ""];

  for (const agent of agents) {
    for (const tool of agent.tools) {
      lines.push(`## ${tool.id} — ${tool.name}`, "");
      lines.push("Used by:", agent.name, "");
      lines.push("Source:", tool.integrationId ? `${tool.integrationId} / ${tool.integrationOperationId}` : `${tool.workflowId} / ${tool.workflowStepId}`, "");
      lines.push("Side effect:", tool.sideEffect, "");
      lines.push("Approval:", String(tool.approvalRequired), "");
      lines.push("Input contracts:", tool.inputContractIds.join(", ") || "none", "");
      lines.push("Output contracts:", tool.outputContractIds.join(", ") || "none", "");
      lines.push("Traceability:", `${tool.evidenceRefs.length} evidence reference(s)`, "");
    }
  }

  if (agents.every((a) => a.tools.length === 0)) lines.push("No tools generated for the currently known solution.", "");

  return lines.join("\n");
}

// ─── Artifact assembly ──────────────────────────────────────────────────────

export function buildAIAgentArtifacts(agents: AIAgentDefinition[]): ImplementationArtifact[] {
  const artifacts: ImplementationArtifact[] = [];

  for (const agent of agents) {
    const slug = slugify(agent.name) || agent.id.toLowerCase();
    artifacts.push(
      createArtifact({
        capabilityId: CAPABILITY_ID,
        type: "config",
        path: `artifacts/ai-agents/${slug}.agent.json`,
        content: JSON.stringify(agent, null, 2),
        metadata: { agentId: agent.id },
      }),
      createArtifact({
        capabilityId: CAPABILITY_ID,
        type: "document",
        path: `artifacts/ai-agents/${slug}.agent.md`,
        content: renderAgentMarkdown(agent),
        metadata: { agentId: agent.id },
      })
    );
  }

  artifacts.push(
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/ai-agents/ai-agent-architecture.json",
      content: JSON.stringify(agents, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/ai-agents/ai-agent-architecture.md",
      content: renderArchitectureMarkdown(agents),
    })
  );

  const toolCatalog: AIAgentToolSpecification[] = agents.flatMap((a) => a.tools);
  artifacts.push(
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/ai-agents/tool-catalog.json",
      content: JSON.stringify(toolCatalog, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/ai-agents/tool-catalog.md",
      content: renderToolCatalogMarkdown(agents),
    })
  );

  return artifacts;
}
