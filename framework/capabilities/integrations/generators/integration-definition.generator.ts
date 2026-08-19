/**
 * Turns each IntegrationCandidate into a full IntegrationDefinition.
 *
 * Every classification (direction, interaction pattern, protocol, auth,
 * reliability) is a deterministic regex match against already-structured
 * text (candidate.purpose, or an IntegrationNeed's explicitly captured
 * `details` — see integration-needs.extractor.ts) — never a guess, and
 * defaults to "unknown" whenever no explicit evidence exists (task item 3:
 * "unknown information must remain unknown"). Operations are derived from
 * WorkflowDefinition steps (Phase 3 output, passed in when available) whose
 * text names the target system — not from WorkflowStep.systemIds, which is
 * rarely populated by Phase 3's classifier in practice.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import { makeIdGenerator } from "../../../discovery/shared/section-lookup.js";
import type {
  IntegrationCandidate,
  IntegrationDefinition,
  IntegrationDirection,
  IntegrationInteractionPattern,
  IntegrationProtocol,
  IntegrationOperation,
  IntegrationOperationType,
  DataContract,
  DataContractField,
  AuthenticationMechanism,
  AuthenticationRequirement,
  AuthenticationPlacement,
  ReliabilityRequirements,
  IntegrationSecurityRequirements,
  RestContract,
  RestOperation,
  WebhookContract,
  IntegrationStatus,
} from "../schemas/integrations.types.js";

// ─── Deterministic classification (only fires on explicit evidence) ───────

const DIRECTION_PATTERNS: Array<{ pattern: RegExp; direction: IntegrationDirection }> = [
  { pattern: /\bsync\b|\bsynchron/i, direction: "bidirectional" },
  { pattern: /\bsend\b|\bpush\b|\bnotify\b|\bsubmit\b/i, direction: "outbound" },
  { pattern: /\breceive\b|\bretriev|\bfetch\b|\bpull\b|\bread\b/i, direction: "inbound" },
];

function classifyDirection(text: string): IntegrationDirection {
  return DIRECTION_PATTERNS.find((p) => p.pattern.test(text))?.direction ?? "unknown";
}

const AUTH_PATTERNS: Array<{ pattern: RegExp; mechanism: AuthenticationMechanism }> = [
  { pattern: /api[\s-]?key/i, mechanism: "api-key" },
  { pattern: /oauth\s*2|oauth2/i, mechanism: "oauth2" },
  { pattern: /\bmtls\b|mutual tls/i, mechanism: "mtls" },
  { pattern: /service account/i, mechanism: "service-account" },
  { pattern: /\bbasic auth|\bbasic\b/i, mechanism: "basic" },
  { pattern: /\bno auth|\bnone\b/i, mechanism: "none" },
];

function classifyAuth(text: string): AuthenticationMechanism {
  return AUTH_PATTERNS.find((p) => p.pattern.test(text))?.mechanism ?? "unknown";
}

const HEADER_PLACEMENT_PATTERN = /^([A-Za-z0-9-]+)\s+(?:request\s+)?header$/i;
const QUERY_PLACEMENT_PATTERN = /\bquery\s*(?:string|parameter)?\b/i;
const COOKIE_PLACEMENT_PATTERN = /\bcookie\b/i;

/**
 * Preserves an explicit "Authentication placement: X-API-Key request
 * header" detail line verbatim (Phase 5.5A) — knowing the auth mechanism
 * (e.g. api-key) never implies where the credential goes (task item 20).
 * Only fires on this exact detail key; never inferred from the mechanism.
 */
function classifyAuthPlacement(text: string | undefined): AuthenticationPlacement | undefined {
  if (!text) return undefined;
  const headerMatch = text.trim().match(HEADER_PLACEMENT_PATTERN);
  if (headerMatch) return { location: "header", name: headerMatch[1] };
  if (QUERY_PLACEMENT_PATTERN.test(text)) return { location: "query" };
  if (COOKIE_PLACEMENT_PATTERN.test(text)) return { location: "cookie" };
  return undefined;
}

const METHOD_PATH_PATTERN = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/i;

function extractMethodPath(text: string): { method: NonNullable<RestOperation["method"]>; path: string } | undefined {
  const m = text.match(METHOD_PATH_PATTERN);
  if (!m) return undefined;
  return { method: m[1].toUpperCase() as NonNullable<RestOperation["method"]>, path: m[2] };
}

function protocolFrom(text: string): IntegrationProtocol {
  if (/https/i.test(text)) return "https";
  if (/\bhttp\b/i.test(text)) return "http";
  return "unknown";
}

function classifyInteraction(
  allText: string,
  hasMethodPath: boolean
): { pattern: IntegrationInteractionPattern; protocol: IntegrationProtocol } {
  if (/\bwebhook\b/i.test(allText)) return { pattern: "webhook", protocol: protocolFrom(allText) };
  if (hasMethodPath || /\brest\b|\bapi\b|request-response/i.test(allText)) {
    return { pattern: "request-response", protocol: protocolFrom(allText) };
  }
  if (/\bsftp\b|\bcsv\b|file transfer|\bfile\b/i.test(allText)) {
    return { pattern: "file-transfer", protocol: /sftp/i.test(allText) ? "sftp" : "unknown" };
  }
  if (/\bdatabase\b|\bjdbc\b/i.test(allText)) {
    return { pattern: "database", protocol: /jdbc/i.test(allText) ? "jdbc" : "unknown" };
  }
  if (/\bmanual\b/i.test(allText)) return { pattern: "manual", protocol: "unknown" };
  return { pattern: "unknown", protocol: "unknown" };
}

function classifyOperationType(text: string): IntegrationOperationType {
  const t = text.toLowerCase();
  if (t.includes("notif")) return "notify";
  if (t.includes("sync") || t.includes("synchron")) return "synchronize";
  if (t.includes("creat") || t.includes("enter") || t.includes(" add ")) return "create";
  if (t.includes("updat") || t.includes("modif")) return "update";
  if (t.includes("delet") || t.includes("remov")) return "delete";
  if (t.includes("submit") || t.includes("send")) return "submit";
  if (t.includes("check") || t.includes("retriev") || t.includes("fetch") || t.includes("read") || t.includes("view") || t.includes("receiv") || t.includes("get ")) {
    return "read";
  }
  return "unknown";
}

function operationTypeFromMethod(method: string): IntegrationOperationType {
  switch (method) {
    case "GET": return "read";
    case "POST": return "create";
    case "PUT": case "PATCH": return "update";
    case "DELETE": return "delete";
    default: return "unknown";
  }
}

/**
 * Splits a comma/"and"-joined field list into individual entries, but never
 * inside a parenthetical annotation — "externalOrderId (string, required),
 * amount (number, required)" must stay 2 fields, not 4 (Phase 5.5A: a naive
 * `text.split(/,| and /i)` would corrupt the new per-field type/required
 * annotation the moment two annotated fields share one line).
 */
function splitDataPoints(text: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let current = "";
  let i = 0;

  while (i < text.length) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") depth = Math.max(0, depth - 1);

    if (depth === 0 && text[i] === ",") {
      entries.push(current);
      current = "";
      i++;
      continue;
    }
    if (depth === 0 && / and /i.test(text.slice(i, i + 5))) {
      entries.push(current);
      current = "";
      i += 5;
      continue;
    }
    current += text[i];
    i++;
  }
  entries.push(current);

  return entries.map((s) => s.trim()).filter((s) => s.length > 0);
}

const FIELD_ANNOTATION_PATTERN = /^(.+?)\s*\(([^()]+)\)\s*$/;
const FIELD_ANNOTATION_BODY_PATTERN = /^(string|number|boolean)\s*,\s*(required|optional)$/i;

/**
 * Parses an optional "name (type, required|optional)" annotation (Phase
 * 5.5A — needed so a fully explicit example can reach export readiness
 * "ready"). A bare name with no parenthetical (every example before this
 * phase) is unaffected — type/required stay undefined exactly as before.
 * Never invents a type/requiredness when the annotation isn't present or
 * doesn't match this exact shape.
 */
function parseFieldEntry(raw: string, source: string): DataContractField {
  const match = raw.match(FIELD_ANNOTATION_PATTERN);
  if (!match) return { name: raw, source };

  const bodyMatch = match[2].trim().match(FIELD_ANNOTATION_BODY_PATTERN);
  if (!bodyMatch) return { name: raw, source };

  return {
    name: match[1].trim(),
    type: bodyMatch[1].toLowerCase(),
    required: bodyMatch[2].toLowerCase() === "required",
    source,
  };
}

/** Reused by generic-rest-typescript.readiness.ts (Phase 5.5A) so the export-readiness "unresolved data sensitivity" check can't drift from this gap's actual topic string. */
export const DATA_SENSITIVITY_GAP_TOPIC = "Integration data sensitivity";

// ─── Sub-builders ───────────────────────────────────────────────────────────

function buildDataContracts(
  details: Record<string, string>,
  evidenceRefs: EvidenceReference[],
  nextContractId: () => string
): DataContract[] {
  const contracts: DataContract[] = [];

  const responseText = details["Response fields"] ?? details["Expected response"] ?? details["Response"];
  if (responseText) {
    contracts.push({
      id: nextContractId(),
      name: "Response",
      direction: "response",
      fields: splitDataPoints(responseText).map((entry) => parseFieldEntry(entry, responseText)),
      sensitivity: "unknown",
      evidenceRefs,
    });
  }

  const requestText = details["Request fields"] ?? details["Request"] ?? details["Payload"] ?? details["Data sent"];
  if (requestText) {
    contracts.push({
      id: nextContractId(),
      name: "Request",
      direction: "request",
      fields: splitDataPoints(requestText).map((entry) => parseFieldEntry(entry, requestText)),
      sensitivity: "unknown",
      evidenceRefs,
    });
  }

  return contracts;
}

function buildOperationsFromWorkflows(
  candidate: IntegrationCandidate,
  targetSystemName: string | undefined,
  workflows: WorkflowDefinition[],
  evidenceRefs: EvidenceReference[],
  nextOperationId: () => string
): { operations: IntegrationOperation[]; relatedWorkflowIds: string[] } {
  const operations: IntegrationOperation[] = [];
  const relatedWorkflowIds = new Set<string>();
  if (!targetSystemName) return { operations, relatedWorkflowIds: [] };

  for (const workflow of workflows) {
    const referencesSystem = workflow.externalSystems.some((es) => es.systemId === candidate.targetSystemId);
    if (!referencesSystem) continue;

    const matchingSteps = workflow.steps.filter((s) => s.description.toLowerCase().includes(targetSystemName.toLowerCase()));
    if (matchingSteps.length === 0) continue;

    relatedWorkflowIds.add(workflow.id);
    for (const step of matchingSteps) {
      operations.push({
        id: nextOperationId(),
        name: step.name,
        description: step.description,
        type: classifyOperationType(step.description),
        evidenceRefs,
      });
    }
  }

  return { operations, relatedWorkflowIds: [...relatedWorkflowIds] };
}

function buildGaps(
  candidate: IntegrationCandidate,
  targetSystemName: string | undefined,
  interactionPattern: IntegrationInteractionPattern,
  authentication: AuthenticationRequirement,
  reliability: ReliabilityRequirements,
  operations: IntegrationOperation[],
  discovery: DiscoveryResult,
  nextGapId: () => string
): InformationGap[] {
  const gaps: InformationGap[] = [];
  const purpose = candidate.purpose;

  if (!candidate.sourceSystemId) {
    gaps.push({
      id: nextGapId(),
      topic: "Integration source system",
      question: `What system will initiate: ${purpose}?`,
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: ["integrations"],
    });
  }

  if (interactionPattern === "unknown") {
    gaps.push({
      id: nextGapId(),
      topic: "Integration protocol",
      question: `What protocol or mechanism does "${purpose}" use?`,
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: ["integrations"],
    });
  }

  if (authentication.mechanism === "unknown") {
    gaps.push({
      id: nextGapId(),
      topic: "Integration authentication",
      question: `What authentication mechanism is required for "${purpose}"?`,
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: ["integrations", "security-governance"],
    });
  }

  // Reference — never silently resolve — an existing Discovery data gap (task item 13).
  const customerDataGap = discovery.informationGaps.find((g) => g.topic === "Customer data");
  if (customerDataGap) {
    gaps.push({
      id: nextGapId(),
      topic: DATA_SENSITIVITY_GAP_TOPIC,
      question: `What exact data crosses this boundary for "${purpose}"? Discovery's data-sensitivity gap (${customerDataGap.id}) is still unresolved.`,
      importance: "high",
      blocking: false,
      relatedCapabilityIds: ["integrations", "security-governance"],
    });
  }

  if (reliability.idempotencyRequired === "unknown" && operations.some((o) => o.type === "create" || o.type === "submit" || o.type === "update")) {
    gaps.push({
      id: nextGapId(),
      topic: "Duplicate submission protection",
      question: `Is duplicate submission protection required for "${purpose}"?`,
      importance: "low",
      blocking: false,
      relatedCapabilityIds: ["integrations"],
    });
  }

  if (reliability.retryRequired === "unknown") {
    gaps.push({
      id: nextGapId(),
      topic: "Integration failure handling",
      question: `What should happen if ${targetSystemName ?? "the external system"} is unavailable during "${purpose}"?`,
      importance: "low",
      blocking: false,
      relatedCapabilityIds: ["integrations"],
    });
  }

  return gaps;
}

// ─── Main build ─────────────────────────────────────────────────────────────

interface IdGenerators {
  integration: () => string;
  operation: () => string;
  contract: () => string;
  gap: () => string;
}

function buildOne(
  candidate: IntegrationCandidate,
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  ids: IdGenerators
): IntegrationDefinition {
  const sourceSystem = candidate.sourceSystemId ? discovery.systems.find((s) => s.id === candidate.sourceSystemId) : undefined;
  const targetSystem = candidate.targetSystemId ? discovery.systems.find((s) => s.id === candidate.targetSystemId) : undefined;

  const needs = discovery.integrationNeeds.filter((n) => candidate.sourceIntegrationNeedIds.includes(n.id));
  const details: Record<string, string> = {};
  for (const need of needs) Object.assign(details, need.details ?? {});

  const allText = [candidate.purpose, ...Object.values(details)].join(" ");

  const direction = classifyDirection(allText);
  const methodPath = extractMethodPath(details["Endpoint"] ?? allText);
  const { pattern: interactionPattern, protocol } = classifyInteraction(allText, Boolean(methodPath));

  const authMechanism = classifyAuth(details["Authentication"] ?? allText);
  const authPlacement = classifyAuthPlacement(details["Authentication placement"]);
  const authentication: AuthenticationRequirement = {
    mechanism: authMechanism,
    ...(authPlacement ? { placement: authPlacement } : {}),
    evidenceRefs: candidate.evidenceRefs,
  };

  const dataContracts = buildDataContracts(details, candidate.evidenceRefs, ids.contract);

  const { operations: workflowOperations, relatedWorkflowIds } = buildOperationsFromWorkflows(
    candidate,
    targetSystem?.name,
    workflows,
    candidate.evidenceRefs,
    ids.operation
  );

  let operations = workflowOperations;
  let restContract: RestContract | undefined;
  if (methodPath) {
    if (operations.length === 0) {
      operations = [
        {
          id: ids.operation(),
          name: "Explicit REST operation",
          description: `${methodPath.method} ${methodPath.path}`,
          type: operationTypeFromMethod(methodPath.method),
          evidenceRefs: candidate.evidenceRefs,
        },
      ];
    }

    // Correlates the one explicit REST endpoint to the one integration
    // operation it produced (Phase 5.5A) — only when unambiguous. Phase 4
    // only ever extracts a single method+path per integration today, so
    // "exactly one operation" is the honest, non-fuzzy case to link; 0 or
    // 2+ operations stay uncorrelated rather than guessed (task item 28).
    const integrationOperationId = operations.length === 1 ? operations[0].id : undefined;

    restContract = {
      ...(details["Base URL"] ? { baseUrl: details["Base URL"] } : {}),
      operations: [
        {
          method: methodPath.method,
          path: methodPath.path,
          description: details["Integration method"] ?? candidate.purpose,
          ...(integrationOperationId ? { integrationOperationId } : {}),
        },
      ],
    };
  }

  let webhookContract: WebhookContract | undefined;
  if (/\bwebhook\b/i.test(allText)) {
    webhookContract = {
      eventName: details["Event"],
      direction: /\bincoming\b|\breceives?\b/i.test(allText) ? "incoming" : /\boutgoing\b|\bsends?\b/i.test(allText) ? "outgoing" : "unknown",
      targetUrl: details["Target URL"] ?? details["Webhook URL"],
      payloadContractId: dataContracts[0]?.id,
    };
  }

  const reliability: ReliabilityRequirements = {
    retryRequired: /\bretry\b|\bretries\b/i.test(allText) ? true : "unknown",
    idempotencyRequired: /\bidempotent\b|\bduplicate\b/i.test(allText) ? true : "unknown",
    timeoutRequired: /\btimeout\b/i.test(allText) ? true : "unknown",
    orderingRequired: /\border(ed|ing)?\b|\bsequence\b/i.test(allText) ? true : "unknown",
    notes: [],
  };

  const security: IntegrationSecurityRequirements = {
    encryptionInTransit: protocol === "https" ? true : "unknown",
    containsSensitiveData: discovery.dataEntities.some((d) => d.sensitive) ? true : "unknown",
    secretsRequired: authMechanism === "none" ? false : authMechanism === "unknown" ? "unknown" : true,
    auditRequired: "unknown",
  };

  const informationGaps = buildGaps(candidate, targetSystem?.name, interactionPattern, authentication, reliability, operations, discovery, ids.gap);

  const statusReasons: string[] = [];
  if (!candidate.sourceSystemId) statusReasons.push("source system unknown");
  if (interactionPattern === "unknown") statusReasons.push("interaction pattern unknown");
  if (authentication.mechanism === "unknown") statusReasons.push("authentication mechanism unknown");

  const status: IntegrationStatus = !candidate.targetSystemId ? "draft" : statusReasons.length > 0 ? "needs-review" : "complete";

  return {
    id: ids.integration(),
    name: candidate.purpose,
    version: "1.0",
    sourceSystemId: candidate.sourceSystemId,
    targetSystemId: candidate.targetSystemId,
    purpose: candidate.purpose,
    direction,
    interactionPattern,
    protocol,
    operations,
    dataContracts,
    authentication,
    reliability,
    failureScenarios: [],
    security,
    restContract,
    webhookContract,
    relatedWorkflowIds,
    relatedProcessIds: candidate.relatedProcessIds,
    relatedRequirementIds: candidate.relatedRequirementIds,
    informationGaps,
    evidenceRefs: candidate.evidenceRefs,
    status,
    statusReasons,
  };
}

export function buildIntegrationDefinitions(
  discovery: DiscoveryResult,
  candidates: IntegrationCandidate[],
  workflows: WorkflowDefinition[] = []
): IntegrationDefinition[] {
  const ids: IdGenerators = {
    integration: makeIdGenerator("INT"),
    operation: makeIdGenerator("OP"),
    contract: makeIdGenerator("CONTRACT"),
    gap: makeIdGenerator("INTGAP"),
  };

  return candidates.map((candidate) => buildOne(candidate, discovery, workflows, ids));
}
