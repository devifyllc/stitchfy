/**
 * Phase 4 — replaces the Phase 0 vendor-coupled model (RestApiIntegration.
 * baseUrl, WebhookIntegration.targetUrl, ...) with IntegrationDefinition: a
 * generic, vendor-neutral domain model. REST/webhook are optional
 * *specializations* attached to an IntegrationDefinition only when the
 * source evidence actually supports them — never the top-level model.
 *
 * The one rule that matters more than any field shape: unknown information
 * stays unknown. Nothing here is ever set to fill a field — see
 * docs/architecture/ARCHITECTURE.md "Integration Architecture".
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { IntegrationExportBundle } from "../exporters/exporter.types.js";

// ─── Phase 4 planning (integrations.planner.ts) ────────────────────────────

export interface IntegrationCandidate {
  id: string;
  sourceSystemId?: string;
  targetSystemId?: string;
  purpose: string;
  relatedWorkflowIds: string[];
  relatedProcessIds: string[];
  relatedRequirementIds: string[];
  /** The DiscoveryResult.integrationNeeds entries merged into this candidate (source of `.details` for technical extraction). */
  sourceIntegrationNeedIds: string[];
  evidenceRefs: EvidenceReference[];
}

export interface IntegrationPlan {
  integrationNeedIds: string[];
  workflowIds: string[];
  processIds: string[];
  requirementIds: string[];
  systemIds: string[];
  candidates: IntegrationCandidate[];
  informationGaps: string[];
  assumptions: string[];
}

// ─── IntegrationDefinition and its parts ───────────────────────────────────

export type IntegrationDirection = "inbound" | "outbound" | "bidirectional" | "unknown";

export type IntegrationInteractionPattern =
  | "request-response"
  | "webhook"
  | "event"
  | "batch"
  | "file-transfer"
  | "database"
  | "manual"
  | "unknown";

export type IntegrationProtocol = "http" | "https" | "websocket" | "sftp" | "jdbc" | "messaging" | "unknown";

export type IntegrationOperationType =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "notify"
  | "synchronize"
  | "submit"
  | "unknown";

export interface IntegrationOperation {
  id: string;
  name: string;
  description: string;
  type: IntegrationOperationType;
  requestContractId?: string;
  responseContractId?: string;
  evidenceRefs: EvidenceReference[];
}

export interface DataContractField {
  name: string;
  type?: string;
  required?: boolean;
  source?: string;
}

export type DataContractDirection = "request" | "response" | "event" | "file" | "unknown";
export type DataSensitivity = "public" | "internal" | "confidential" | "restricted" | "unknown";

export interface DataContract {
  id: string;
  name: string;
  direction: DataContractDirection;
  fields: DataContractField[];
  sensitivity: DataSensitivity;
  evidenceRefs: EvidenceReference[];
}

export type AuthenticationMechanism = "api-key" | "oauth2" | "basic" | "mtls" | "service-account" | "none" | "unknown";

/**
 * Where a credential is applied (header/query/cookie) — distinct from the
 * mechanism itself (Phase 5.5A, task item 33): knowing `mechanism: "api-key"`
 * never implies placement. Only populated when the source explicitly states
 * it (e.g. "Authentication placement: X-API-Key request header"); never
 * inferred from the mechanism alone.
 */
export interface AuthenticationPlacement {
  location: "header" | "query" | "cookie" | "unknown";
  name?: string;
}

export interface AuthenticationRequirement {
  mechanism: AuthenticationMechanism;
  placement?: AuthenticationPlacement;
  notes?: string[];
  evidenceRefs?: EvidenceReference[];
}

export interface ReliabilityRequirements {
  retryRequired: boolean | "unknown";
  idempotencyRequired: boolean | "unknown";
  timeoutRequired: boolean | "unknown";
  orderingRequired?: boolean | "unknown";
  notes: string[];
}

export type IntegrationFailureHandling = "retry" | "human-review" | "fail" | "ignore" | "unknown";

export interface IntegrationFailureScenario {
  id: string;
  condition: string;
  handling: IntegrationFailureHandling;
  evidenceRefs: EvidenceReference[];
}

export interface IntegrationSecurityRequirements {
  encryptionInTransit: boolean | "unknown";
  containsSensitiveData: boolean | "unknown";
  secretsRequired: boolean | "unknown";
  auditRequired: boolean | "unknown";
}

// ─── Specializations — only attached when evidence supports them ──────────

export interface RestOperation {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path?: string;
  description?: string;
  /** Correlates this REST endpoint to the IntegrationOperation it corresponds to — set only when unambiguous (Phase 5.5A, task item 28). */
  integrationOperationId?: string;
}

/** Nested directly on IntegrationDefinition (1:1) rather than a separate integrationId-backed object — same information, no redundant cross-reference layer. */
export interface RestContract {
  baseUrl?: string;
  operations: RestOperation[];
}

export interface WebhookContract {
  eventName?: string;
  /** "unknown" is preferred over guessing when the source doesn't say which way the webhook flows. */
  direction: "incoming" | "outgoing" | "unknown";
  targetUrl?: string;
  payloadContractId?: string;
}

export type IntegrationStatus = "draft" | "needs-review" | "complete";

export interface IntegrationDefinition {
  id: string;
  name: string;
  version: string;

  sourceSystemId?: string;
  targetSystemId?: string;

  purpose: string;
  direction: IntegrationDirection;
  interactionPattern: IntegrationInteractionPattern;
  protocol: IntegrationProtocol;

  operations: IntegrationOperation[];
  dataContracts: DataContract[];

  authentication?: AuthenticationRequirement;
  reliability: ReliabilityRequirements;
  failureScenarios: IntegrationFailureScenario[];
  security: IntegrationSecurityRequirements;

  restContract?: RestContract;
  webhookContract?: WebhookContract;

  relatedWorkflowIds: string[];
  relatedProcessIds: string[];
  relatedRequirementIds: string[];

  /** New gaps surfaced by generation itself, reusing InformationGap — never merged back into DiscoveryResult. */
  informationGaps: InformationGap[];
  evidenceRefs: EvidenceReference[];

  status: IntegrationStatus;
  statusReasons: string[];
}

/**
 * `implemented: true` means Stitchfy generated and validated one or more
 * vendor-neutral integration specifications — never that Stitchfy
 * connected to or exchanged data with an external system (same
 * distinction established by Workflow Automation in Phase 3).
 */
export interface IntegrationsSection {
  implemented: boolean;
  plan?: IntegrationPlan;
  integrations: IntegrationDefinition[];
  /**
   * Implementation-oriented export bundles (Phase 5.5A) — generated from
   * the validated `integrations` above by a technical-target exporter (see
   * framework/capabilities/integrations/exporters/). Always present,
   * possibly empty (same convention as `integrations`/`artifacts`/`notes`,
   * not `plan?`, which is genuinely absent when there's nothing to plan).
   * `IntegrationDefinition` stays the architecture; this is generated
   * scaffolding derived from it — never a replacement for it.
   */
  exports: IntegrationExportBundle[];
  artifacts: ImplementationArtifact[];
  notes: string[];
}
