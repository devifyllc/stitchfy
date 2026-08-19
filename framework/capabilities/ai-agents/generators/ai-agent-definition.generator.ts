/**
 * Builds AIAgentDefinition from the already-generated solution
 * (DiscoveryResult + WorkflowDefinition[] + IntegrationDefinition[]).
 * Every tool/permission/guardrail cites real evidence; nothing here invents
 * a tool, a permission, a model, or a numeric threshold — see
 * docs/architecture/ARCHITECTURE.md "AI Agent Architecture and Governed
 * Tool Specification" for the full reasoning behind each rule below.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { AIAgentNeed, AICapabilityNeed } from "../../../discovery/ai-agents/ai-agent-need.types.js";
import type { WorkflowDefinition, WorkflowStep } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationDefinition, IntegrationOperation } from "../../integrations/schemas/integrations.types.js";
import { createApprovalRequest } from "../../../governance/approvals/human-approval.types.js";
import { makeIdGenerator, significantWords } from "../../../discovery/shared/section-lookup.js";
import type {
  AIAgentDefinition,
  AIAgentCandidate,
  AIAgentPlan,
  AIAgentInteractionMode,
  AIAgentAutonomy,
  AIModelRequirements,
  AIModelCapability,
  AIAgentToolSpecification,
  AIAgentToolSideEffect,
  AIAgentDataContract,
  AIAgentMemoryStrategy,
  AIAgentPermission,
  AIAgentGuardrail,
  AIConfidencePolicy,
  AIAgentRiskPolicy,
  AIAgentEscalationRule,
  AIAgentHumanOversight,
} from "../schemas/ai-agents.types.js";

// ─── Text patterns — scoped to already-structured AIAgentNeed.tasks text,
// never raw Markdown ───────────────────────────────────────────────────────

const PROHIBITION_PATTERN = /\bmust not\b|\bmay not\b|\bdoes not\b|\bcannot\b|\bshould not\b/i;
const GRANT_PATTERN = /\bmay\b|\bcan\b|\bable to\b|\bis permitted\b/i;
const OVERSIGHT_PATTERN = /without (employee|manager|human|staff) approval|requires? approval|\bapproval\b.*\brequired\b|must be approved/i;
const SESSION_MEMORY_PATTERN = /\bonly\b.*\b(during|for)\b.*\bsession\b|\bshould not persist\b|\bnot persist\b|\bactive (customer )?session\b/i;
const PERSISTENT_MEMORY_PATTERN = /\bpersist(ent|s)?\b.*\b(after|beyond|long.?term)\b|\bretain\b.*\bhistory\b|\blong.?term memory\b/i;
const AUTONOMOUS_PATTERN = /\bautonomous(ly)?\b/i;
const FULLY_AUTONOMOUS_PATTERN = /\bfully autonomous\b|\bwithout any (human|review)\b/i;
const ESCALATION_PATTERN = /route (?:the )?(?:request|conversation|customer)?s?\s*to (?:an? )?([a-z][a-z ]*?)(?:\.|$)/i;
const NUMERIC_THRESHOLD_PATTERN = /\b0\.\d+\b|\b\d{1,3}\s?%/;
// "should not persist after the session" contains "persist...after" — the
// same negation trap as autonomy: a negated statement must not be read as
// asserting the positive fact it's actually denying.
const NEGATES_PERSISTENCE_PATTERN = /\b(not|never)\b.{0,15}\bpersist/i;

/**
 * Generic actor/role/filler words that appear in almost every business
 * process description ("customer," "employee," "assistant," "request," ...)
 * — sharesSignificantWord() alone would treat these as a genuine match
 * between two otherwise-unrelated sentences (e.g. "summarize a customer's
 * request for the employee" incorrectly matching a workflow step that also
 * happens to mention "employee" and "customer"). Tool derivation needs a
 * stricter check than the dedup use case sharesSignificantWord() was
 * originally written for (Phase 3/4) — this stays local to AI tool
 * matching rather than changing that shared utility's behavior elsewhere.
 */
const GENERIC_ACTOR_WORDS = new Set(["custom", "employ", "assist", "busine", "reques", "provid", "select", "provis", "person"]);

/**
 * A need's own tasks are usually all about the same subject ("invoice," in
 * an invoice-triage need) — that subject word will trivially overlap with
 * an unrelated workflow step that happens to mention it too ("Clerk
 * manually enters invoice data into QuickBooks"), the same false-positive
 * failure mode as GENERIC_ACTOR_WORDS but specific to this need's own
 * vocabulary. A word present in at least half of a need's task bullets is
 * "background" for that need and excluded from matching, on top of the
 * static exclusion list.
 */
function backgroundWords(tasks: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const w of significantWords(task)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const threshold = Math.ceil(tasks.length / 2);
  return new Set([...counts.entries()].filter(([, count]) => count >= threshold).map(([w]) => w));
}

function sharesSpecificWord(a: string, b: string, extraExclusions: Set<string>): boolean {
  const stripped = (text: string) => [...significantWords(text)].filter((w) => !GENERIC_ACTOR_WORDS.has(w) && !extraExclusions.has(w));
  const wordsA = new Set(stripped(a));
  for (const w of stripped(b)) if (wordsA.has(w)) return true;
  return false;
}

const CAPABILITY_TO_INTERACTION_MODE: Partial<Record<AICapabilityNeed, AIAgentInteractionMode>> = {
  conversation: "conversational",
  "decision-support": "decision-support",
  classification: "classification",
  summarization: "summarization",
  generation: "generation",
  orchestration: "orchestration",
  "tool-use": "task",
  retrieval: "task",
  extraction: "task",
};
// Specific analytical capabilities outrank the vaguer "decision-support"
// (which can pick up incidental language about a human's decision, not the
// agent's own) — conversation still wins whenever a real customer-facing
// dialogue capability is present.
const INTERACTION_MODE_PRIORITY: AICapabilityNeed[] = [
  "conversation",
  "classification",
  "summarization",
  "extraction",
  "decision-support",
  "generation",
  "orchestration",
  "tool-use",
  "retrieval",
];

function resolveInteractionMode(need: AIAgentNeed): AIAgentInteractionMode {
  const dominant = INTERACTION_MODE_PRIORITY.find((c) => need.desiredCapabilities.includes(c));
  return dominant ? CAPABILITY_TO_INTERACTION_MODE[dominant] ?? "unknown" : "unknown";
}

const CAPABILITY_TO_MODEL_CAPABILITY: Partial<Record<AICapabilityNeed, AIModelCapability>> = {
  conversation: "text-generation",
  generation: "text-generation",
  summarization: "summarization",
  classification: "classification",
  extraction: "structured-output",
  "tool-use": "tool-use",
  retrieval: "retrieval",
};

function needEvidence(need: AIAgentNeed): EvidenceReference {
  return { entityType: "ai-agent-need", entityId: need.id, description: need.purpose };
}

// ─── Tools — only from a real IntegrationOperation/WorkflowStep ────────────

function operationSideEffect(type: IntegrationOperation["type"]): AIAgentToolSideEffect {
  switch (type) {
    case "read":
      return "read";
    case "create":
    case "update":
    case "synchronize":
    case "delete":
    case "submit":
      return "write";
    case "notify":
      return "notify";
    default:
      return "unknown";
  }
}

const WRITE_STEP_PATTERN = /\bcreat|\bupdat|\bcancel|\bconfirm|\bmodify|\bdelet|\bsubmit/i;
const READ_STEP_PATTERN = /\bcheck|\bview|\bretriev|\blook ?up|\bread\b/i;

function workflowStepSideEffect(step: WorkflowStep): AIAgentToolSideEffect {
  if (WRITE_STEP_PATTERN.test(step.description)) return "write";
  if (READ_STEP_PATTERN.test(step.description)) return "read";
  return "unknown";
}

interface ToolBuildResult {
  tools: AIAgentToolSpecification[];
  toolsByTask: Map<string, AIAgentToolSpecification>;
}

function buildTools(
  need: AIAgentNeed,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[],
  nextId: () => string
): ToolBuildResult {
  const tools: AIAgentToolSpecification[] = [];
  const toolsByTask = new Map<string, AIAgentToolSpecification>();
  const background = backgroundWords(need.tasks);

  for (const task of need.tasks) {
    if (PROHIBITION_PATTERN.test(task)) continue; // never derive a tool from a forbidden action

    for (const integration of integrations) {
      const op = integration.operations.find((o) => sharesSpecificWord(task, o.description, background) || sharesSpecificWord(task, o.name, background));
      if (!op) continue;

      const tool: AIAgentToolSpecification = {
        id: nextId(),
        name: op.name,
        description: op.description,
        kind: "integration-operation",
        sideEffect: operationSideEffect(op.type),
        integrationId: integration.id,
        integrationOperationId: op.id,
        inputContractIds: [],
        outputContractIds: [],
        approvalRequired: operationSideEffect(op.type) === "read" || operationSideEffect(op.type) === "none" ? false : "unknown",
        evidenceRefs: [needEvidence(need), ...op.evidenceRefs],
      };
      tools.push(tool);
      toolsByTask.set(task, tool);
      break;
    }
    if (toolsByTask.has(task)) continue;

    for (const workflow of workflows) {
      const step = workflow.steps.find(
        (s) => (s.type === "automated-task" || s.type === "external-task") && (sharesSpecificWord(task, s.description, background) || sharesSpecificWord(task, s.name, background))
      );
      if (!step) continue;

      const sideEffect = workflowStepSideEffect(step);
      const tool: AIAgentToolSpecification = {
        id: nextId(),
        name: step.name,
        description: step.description,
        kind: "workflow-action",
        sideEffect,
        workflowId: workflow.id,
        workflowStepId: step.id,
        inputContractIds: [],
        outputContractIds: [],
        approvalRequired: sideEffect === "read" || sideEffect === "none" ? false : "unknown",
        evidenceRefs: [needEvidence(need), ...step.evidenceRefs],
      };
      tools.push(tool);
      toolsByTask.set(task, tool);
      break;
    }
  }

  return { tools, toolsByTask };
}

// ─── Permissions — independent grant-language evidence required, not just tool existence ──

function buildPermissions(need: AIAgentNeed, toolsByTask: Map<string, AIAgentToolSpecification>, nextId: () => string): AIAgentPermission[] {
  const permissions: AIAgentPermission[] = [];

  for (const [task, tool] of toolsByTask.entries()) {
    if (!GRANT_PATTERN.test(task)) continue;

    const action = tool.sideEffect === "read" ? "read" : tool.sideEffect === "write" ? "write" : tool.sideEffect === "notify" ? "notify" : "unknown";
    const appliesTo: ArchitectureReference[] = [{ entityType: "ai-tool", entityId: tool.id }];

    permissions.push({
      id: nextId(),
      action,
      appliesTo,
      evidenceRefs: [needEvidence(need)],
    });
  }

  return permissions;
}

// ─── Guardrails + human oversight — from explicit prohibitions, cross-referencing existing WorkflowApproval (never a competing approval model) ──

interface GuardrailBuildResult {
  guardrails: AIAgentGuardrail[];
  humanOversight: AIAgentHumanOversight[];
  riskConditions: AIAgentRiskPolicy["requireHumanReviewFor"];
}

function buildGuardrailsAndOversight(
  need: AIAgentNeed,
  workflows: WorkflowDefinition[],
  nextGuardrailId: () => string,
  nextOversightId: () => string,
  nextApprovalId: () => string
): GuardrailBuildResult {
  const guardrails: AIAgentGuardrail[] = [];
  const humanOversight: AIAgentHumanOversight[] = [];
  const riskConditions: AIAgentRiskPolicy["requireHumanReviewFor"] = [];
  const background = backgroundWords(need.tasks);

  const allApprovals = workflows.flatMap((w) => w.approvals);

  for (const task of need.tasks) {
    if (!PROHIBITION_PATTERN.test(task)) continue;
    // "When the assistant cannot confidently answer... route to an
    // employee" matches PROHIBITION_PATTERN's bare \bcannot\b, but it's an
    // uncertainty/escalation trigger, not a prohibited action — that's
    // handled separately by buildConfidenceAndEscalation(); treating it as
    // a guardrail here too would mischaracterize it.
    if (ESCALATION_PATTERN.test(task)) continue;

    guardrails.push({
      id: nextGuardrailId(),
      type: "prohibited-action",
      description: task,
      appliesToToolIds: [],
      evidenceRefs: [needEvidence(need)],
    });

    if (!OVERSIGHT_PATTERN.test(task)) continue;

    const matchingApproval = allApprovals.find((a) => sharesSpecificWord(task, a.approval.reason, background));

    const approval = matchingApproval
      ? matchingApproval.approval
      : createApprovalRequest({
          approverRole: "designated approver",
          reason: task,
          riskLevel: "medium",
          id: nextApprovalId(),
        });

    humanOversight.push({
      id: nextOversightId(),
      reason: task,
      approval,
      appliesToToolIds: [],
      evidenceRefs: [needEvidence(need), ...(matchingApproval?.evidenceRefs ?? [])],
    });

    guardrails.push({
      id: nextGuardrailId(),
      type: "human-approval",
      description: `Agent must not perform "${task}" without the existing approval control being satisfied.`,
      appliesToToolIds: [],
      evidenceRefs: [needEvidence(need)],
    });

    riskConditions.push({
      description: task,
      toolIds: [],
      evidenceRefs: [needEvidence(need)],
    });
  }

  return { guardrails, humanOversight, riskConditions };
}

// ─── Memory ──────────────────────────────────────────────────────────────

function buildMemory(need: AIAgentNeed, discovery: DiscoveryResult): AIAgentMemoryStrategy {
  const sessionTask = need.tasks.find((t) => SESSION_MEMORY_PATTERN.test(t));
  const persistentTask = need.tasks.find((t) => PERSISTENT_MEMORY_PATTERN.test(t) && !NEGATES_PERSISTENCE_PATTERN.test(t));

  const mode = persistentTask ? "persistent" : sessionTask ? "session" : "unknown";
  const purposeTask = persistentTask ?? sessionTask;

  const sensitiveEntities = discovery.dataEntities.filter((d) => d.sensitive);
  const customerDataGap = discovery.informationGaps.find((g) => g.topic === "Customer data");
  const containsSensitiveData: true | false | "unknown" = sensitiveEntities.length > 0 ? true : customerDataGap ? "unknown" : false;

  return {
    mode,
    purpose: purposeTask,
    dataEntityIds: sensitiveEntities.map((d) => d.id),
    dataContractIds: [],
    containsSensitiveData,
    evidenceRefs: [needEvidence(need)],
  };
}

// ─── Autonomy ────────────────────────────────────────────────────────────

function resolveAutonomy(need: AIAgentNeed, tools: AIAgentToolSpecification[]): AIAgentAutonomy {
  // Only a task that POSITIVELY authorizes autonomous action counts —
  // "may not cancel appointments autonomously" mentions the word but is a
  // prohibition, not a grant, so prohibited bullets are excluded before
  // scanning for autonomy language.
  const positiveText = need.tasks.filter((t) => !PROHIBITION_PATTERN.test(t)).join(" ");
  if (FULLY_AUTONOMOUS_PATTERN.test(positiveText)) return "autonomous";
  if (AUTONOMOUS_PATTERN.test(positiveText)) return "semi-autonomous";
  if (need.humanOversightRequired === true) return "supervised";

  const writeOrNotifyTools = tools.filter((t) => t.sideEffect === "write" || t.sideEffect === "notify");
  if (writeOrNotifyTools.length === 0) return "assistive";
  return writeOrNotifyTools.every((t) => t.approvalRequired === true) ? "supervised" : "unknown";
}

// ─── Confidence / escalation ────────────────────────────────────────────

function buildConfidenceAndEscalation(
  need: AIAgentNeed,
  nextEscalationId: () => string
): { confidencePolicy: AIConfidencePolicy; escalationPolicy: AIAgentEscalationRule[] } {
  const escalationPolicy: AIAgentEscalationRule[] = [];
  let confidencePolicy: AIConfidencePolicy = { mode: "not-specified", evidenceRefs: [] };

  for (const task of need.tasks) {
    const numeric = task.match(NUMERIC_THRESHOLD_PATTERN);
    if (numeric) {
      const raw = numeric[0];
      const threshold = raw.includes("%") ? parseFloat(raw) / 100 : parseFloat(raw);
      confidencePolicy = { mode: "explicit-threshold", threshold, evidenceRefs: [needEvidence(need)] };
      continue;
    }

    const escalation = task.match(ESCALATION_PATTERN);
    if (escalation) {
      escalationPolicy.push({
        id: nextEscalationId(),
        trigger: task,
        action: `Route to ${escalation[1].trim()}.`,
        evidenceRefs: [needEvidence(need)],
      });
      if (confidencePolicy.mode === "not-specified") {
        confidencePolicy = { mode: "human-review", actionWhenUncertain: "human-review", evidenceRefs: [needEvidence(need)] };
      }
    }
  }

  return { confidencePolicy, escalationPolicy };
}

// ─── Model requirements, input/output contracts ────────────────────────

function buildModelRequirements(need: AIAgentNeed): AIModelRequirements {
  const capabilities = [...new Set(need.desiredCapabilities.map((c) => CAPABILITY_TO_MODEL_CAPABILITY[c]).filter((c): c is AIModelCapability => Boolean(c)))];
  const structuredOutputRequired = need.desiredCapabilities.some((c) => c === "extraction" || c === "classification") ? true : "unknown";

  return {
    capabilities,
    structuredOutputRequired,
    toolUseRequired: "unknown",
    evidenceRefs: [needEvidence(need)],
  };
}

function buildContracts(need: AIAgentNeed, interactionMode: AIAgentInteractionMode, nextId: () => string): { inputContracts: AIAgentDataContract[]; outputContracts: AIAgentDataContract[] } {
  const inputContracts: AIAgentDataContract[] = [];
  const outputContracts: AIAgentDataContract[] = [];

  if (interactionMode === "conversational") {
    inputContracts.push({
      id: nextId(),
      name: "Customer message",
      direction: "input",
      dataEntityIds: [],
      integrationDataContractIds: [],
      description: "Natural-language input from the user — no structured schema captured by Discovery.",
      evidenceRefs: [needEvidence(need)],
    });
    outputContracts.push({
      id: nextId(),
      name: "Assistant response",
      direction: "output",
      dataEntityIds: [],
      integrationDataContractIds: [],
      description: "Natural-language response to the user — no structured schema captured by Discovery.",
      evidenceRefs: [needEvidence(need)],
    });
  }

  return { inputContracts, outputContracts };
}

// ─── Main build ─────────────────────────────────────────────────────────

function buildOne(
  candidate: AIAgentCandidate,
  need: AIAgentNeed,
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[],
  ids: {
    agent: () => string;
    tool: () => string;
    permission: () => string;
    guardrail: () => string;
    oversight: () => string;
    approval: () => string;
    escalation: () => string;
    contract: () => string;
    gap: () => string;
  }
): AIAgentDefinition {
  const interactionMode = resolveInteractionMode(need);
  const { tools, toolsByTask } = buildTools(need, workflows, integrations, ids.tool);
  const autonomy = resolveAutonomy(need, tools);
  const permissions = buildPermissions(need, toolsByTask, ids.permission);
  const { guardrails, humanOversight, riskConditions } = buildGuardrailsAndOversight(need, workflows, ids.guardrail, ids.oversight, ids.approval);
  const memory = buildMemory(need, discovery);
  const { confidencePolicy, escalationPolicy } = buildConfidenceAndEscalation(need, ids.escalation);
  const modelRequirements = buildModelRequirements(need);
  const { inputContracts, outputContracts } = buildContracts(need, interactionMode, ids.contract);

  const informationGaps = [];
  if (!modelRequirements.provider && !modelRequirements.model) {
    informationGaps.push({
      id: ids.gap(),
      topic: "Model / provider selection",
      question: `Which model/provider will satisfy the required capabilities (${modelRequirements.capabilities.join(", ") || "unspecified"})?`,
      importance: "medium" as const,
      blocking: false,
      relatedCapabilityIds: ["ai-agents"],
    });
  }

  const statusReasons: string[] = [];
  if (interactionMode === "unknown") statusReasons.push("interaction mode unresolved");
  if (autonomy === "unknown") statusReasons.push("autonomy classification unresolved");
  if (memory.mode === "unknown") statusReasons.push("memory strategy unresolved");
  if (tools.some((t) => (t.sideEffect === "write" || t.sideEffect === "notify") && t.approvalRequired === "unknown")) {
    statusReasons.push("a side-effecting tool has unresolved approval status");
  }

  const status = need.tasks.length === 0 ? "draft" : statusReasons.length > 0 ? "needs-review" : "complete";

  const evidenceRefs: EvidenceReference[] = [needEvidence(need)];

  return {
    id: ids.agent(),
    name: candidate.name,
    version: "1.0",
    purpose: need.purpose,
    interactionMode,
    autonomy,
    modelRequirements,
    tools,
    inputContracts,
    outputContracts,
    memory,
    permissions,
    guardrails,
    humanOversight,
    confidencePolicy,
    riskPolicy: { requireHumanReviewFor: riskConditions, evidenceRefs: [needEvidence(need)] },
    escalationPolicy,
    relatedNeedIds: [need.id],
    relatedProcessIds: need.relatedProcessIds,
    relatedWorkflowIds: [...new Set(tools.filter((t) => t.workflowId).map((t) => t.workflowId!))],
    relatedIntegrationIds: [...new Set(tools.filter((t) => t.integrationId).map((t) => t.integrationId!))],
    relatedRequirementIds: need.relatedRequirementIds,
    informationGaps,
    evidenceRefs,
    status,
    statusReasons,
  };
}

export function buildAIAgentDefinitions(
  discovery: DiscoveryResult,
  plan: AIAgentPlan,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[]
): AIAgentDefinition[] {
  const ids = {
    agent: makeIdGenerator("AIAGENT"),
    tool: makeIdGenerator("AITOOL"),
    permission: makeIdGenerator("AIPERM"),
    guardrail: makeIdGenerator("AIGUARD"),
    oversight: makeIdGenerator("AIOVERSIGHT"),
    approval: makeIdGenerator("APPROVAL-AI"),
    escalation: makeIdGenerator("AIESCALATION"),
    contract: makeIdGenerator("AICONTRACT"),
    gap: makeIdGenerator("AIGAP"),
  };

  const definitions: AIAgentDefinition[] = [];
  for (const candidate of plan.agentCandidates) {
    const need = discovery.aiAgentNeeds.find((n) => n.id === candidate.needId);
    if (!need) continue;
    definitions.push(buildOne(candidate, need, discovery, workflows, integrations, ids));
  }

  return definitions;
}
