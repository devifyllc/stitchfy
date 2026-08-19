/**
 * Extracts AIAgentNeed from a dedicated "AI Agent Needs" section (+ aliases
 * — SECTION_CANDIDATES.aiAgentNeeds). Deliberately does NOT scan
 * "Automation"/"Workflow"/"Integration" sections (task item 4) — those
 * drive Workflow Automation's own signals, never this one.
 *
 * The whole section is treated as describing one coherent need (both this
 * phase's worked examples — and the task's own literal example — are a
 * single flat bullet list, not multiple named needs) — `tasks` captures
 * every bullet verbatim, positive and negative alike; interpretation
 * (guardrails, permissions) happens later in
 * framework/capabilities/ai-agents/generators/ai-agent-definition.generator.ts.
 */

import type { ParsedProject } from "../../core/markdown-parser.js";
import { explicitMetadata } from "../../core/contracts/provenance.js";
import { findSection, sectionEntries, makeIdGenerator, SECTION_CANDIDATES } from "../shared/section-lookup.js";
import type { BusinessActor } from "../actors/business-actor.types.js";
import type { AIAgentNeed, AICapabilityNeed } from "./ai-agent-need.types.js";

// Order matters — .find() returns the first match. Highly specific patterns
// (summarization/classification/extraction) come first; "conversation" is
// checked before the broader "retrieval"/"tool-use" patterns so a
// customer-facing question about e.g. "policies" classifies as
// conversational rather than a retrieval capability (task item 9's
// "conversational" example must actually resolve to "conversation").
const CAPABILITY_PATTERNS: Array<{ pattern: RegExp; capability: AICapabilityNeed }> = [
  { pattern: /\bsummar/i, capability: "summarization" },
  { pattern: /\bclassif|categor/i, capability: "classification" },
  { pattern: /\bextract|highlight.*missing|missing information/i, capability: "extraction" },
  { pattern: /\bask\b.*question|\bquestion|convers|\bchat\b/i, capability: "conversation" },
  { pattern: /\bcheck\b.*availab|\blook ?up\b.*(system|integration|calendar)|\busing the existing\b/i, capability: "tool-use" },
  { pattern: /\bretriev/i, capability: "retrieval" },
  { pattern: /\bdecision|recommend|\badvis|route the request|\bdecide\b/i, capability: "decision-support" },
  { pattern: /\bgenerat|\bdraft\b|\bwrite\b|\bcompos/i, capability: "generation" },
  { pattern: /\borchestrat|\bcoordinat/i, capability: "orchestration" },
];

function classifyCapability(text: string): AICapabilityNeed {
  return CAPABILITY_PATTERNS.find(({ pattern }) => pattern.test(text))?.capability ?? "unknown";
}

const OVERSIGHT_PATTERN = /without (employee|manager|human|staff) approval|requires? approval|\bapproval\b.*\brequired\b|must be approved/i;

export function extractAIAgentNeeds(parsed: ParsedProject, actors: BusinessActor[]): AIAgentNeed[] {
  const nextId = makeIdGenerator("AINEED");
  const section = findSection(parsed, SECTION_CANDIDATES.aiAgentNeeds);
  if (!section) return [];

  const tasks = sectionEntries(section);
  if (tasks.length === 0) return [];

  const allText = tasks.join(" ");
  const actorIds = actors.filter((a) => allText.toLowerCase().includes(a.role.toLowerCase())).map((a) => a.id);

  const desiredCapabilities = [...new Set(tasks.map(classifyCapability))];

  const need: AIAgentNeed = {
    id: nextId(),
    name: "AI Agent Need",
    purpose: tasks[0],
    actorIds,
    tasks,
    relatedProcessIds: [],
    relatedRequirementIds: [],
    relatedOutcomeIds: [],
    desiredCapabilities,
    humanOversightRequired: OVERSIGHT_PATTERN.test(allText) ? true : "unknown",
    metadata: explicitMetadata("ai-agent-needs", tasks[0]),
  };

  return [need];
}
