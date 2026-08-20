/**
 * Phase 6 — replaces the Phase 0 model (mandatory modelProvider/model,
 * confidenceThreshold: number, riskThreshold: string) with a vendor-neutral,
 * unknown-preserving AIAgentDefinition. No model is ever chosen by this
 * architecture; no numeric confidence/risk value is ever fabricated — see
 * docs/architecture/ARCHITECTURE.md "AI Agent Architecture and Governed
 * Tool Specification".
 *
 * `implemented: true` means Stitchfy generated and validated vendor-neutral
 * AI Agent architecture specifications for the currently known solution —
 * it does NOT mean an LLM was executed, a tool was invoked, an agent was
 * deployed, outputs are accurate, or the agent is safe/compliant/
 * production-ready (task item 51). Every generated artifact repeats this.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { HumanApprovalRequest } from "../../../governance/approvals/human-approval.types.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";

// ─── Planning (ai-agents.planner.ts) ───────────────────────────────────────

export interface AIAgentCandidate {
  id: string;
  needId: string;
  name: string;
  evidenceRefs: EvidenceReference[];
}

export interface AIAgentPlan {
  needIds: string[];
  processIds: string[];
  workflowIds: string[];
  integrationIds: string[];
  requirementIds: string[];
  agentCandidates: AIAgentCandidate[];
  informationGaps: string[];
  assumptions: string[];
}

// ─── AIAgentDefinition and its parts ───────────────────────────────────────

export type AIAgentInteractionMode =
  | "conversational"
  | "task"
  | "decision-support"
  | "classification"
  | "summarization"
  | "generation"
  | "orchestration"
  | "unknown";

/**
 * Only "semi-autonomous"/"autonomous" require the source to *explicitly*
 * authorize autonomous action — never inferred from tools existing (task
 * item 10).
 */
export type AIAgentAutonomy = "assistive" | "supervised" | "semi-autonomous" | "autonomous" | "unknown";

export type AIModelCapability =
  | "text-generation"
  | "classification"
  | "summarization"
  | "structured-output"
  | "tool-use"
  | "retrieval"
  | "unknown";

/** No provider/model is ever chosen by this architecture — both stay undefined unless the source explicitly names one (task item 11). */
export interface AIModelRequirements {
  provider?: string;
  model?: string;
  capabilities: AIModelCapability[];
  structuredOutputRequired: true | false | "unknown";
  toolUseRequired: true | false | "unknown";
  evidenceRefs: EvidenceReference[];
}

export type AIAgentToolKind = "integration-operation" | "workflow-action" | "knowledge-retrieval" | "human-escalation" | "unknown";
export type AIAgentToolSideEffect = "none" | "read" | "write" | "notify" | "unknown";

/** Generated only from a real IntegrationOperation/WorkflowStep — never invented (task item 13). */
export interface AIAgentToolSpecification {
  id: string;
  name: string;
  description: string;
  kind: AIAgentToolKind;
  sideEffect: AIAgentToolSideEffect;
  integrationId?: string;
  integrationOperationId?: string;
  workflowId?: string;
  workflowStepId?: string;
  inputContractIds: string[];
  outputContractIds: string[];
  approvalRequired: true | false | "unknown";
  evidenceRefs: EvidenceReference[];
}

export type AIAgentDataContractDirection = "input" | "output";

/** References existing DataEntity/DataContract ids where one exists — never a fabricated JSON schema (task item 24). */
export interface AIAgentDataContract {
  id: string;
  name: string;
  direction: AIAgentDataContractDirection;
  dataEntityIds: string[];
  integrationDataContractIds: string[];
  description?: string;
  evidenceRefs: EvidenceReference[];
}

export type AIAgentMemoryMode = "none" | "session" | "persistent" | "unknown";

/** Never defaults to persistent; no vector storage/embeddings/database is ever implied (task item 21). */
export interface AIAgentMemoryStrategy {
  mode: AIAgentMemoryMode;
  purpose?: string;
  dataEntityIds: string[];
  dataContractIds: string[];
  retention?: string;
  containsSensitiveData: true | false | "unknown";
  evidenceRefs: EvidenceReference[];
}

export type AIAgentPermissionAction = "read" | "write" | "notify" | "execute" | "approve" | "unknown";

/** A tool existing does NOT imply permission — permission requires independent evidence (task item 16). */
export interface AIAgentPermission {
  id: string;
  action: AIAgentPermissionAction;
  appliesTo: ArchitectureReference[];
  condition?: string;
  evidenceRefs: EvidenceReference[];
}

export type AIAgentGuardrailType = "scope" | "tool-use" | "data" | "human-approval" | "output" | "prohibited-action" | "unknown";

/** Every guardrail must come from real evidence — never generic filler like "AI must be ethical" (task item 22). */
export interface AIAgentGuardrail {
  id: string;
  type: AIAgentGuardrailType;
  description: string;
  appliesToToolIds: string[];
  evidenceRefs: EvidenceReference[];
}

export type AIConfidenceMode = "explicit-threshold" | "human-review" | "abstain" | "not-specified";
export type AIUncertaintyAction = "ask-user" | "human-review" | "abstain" | "unknown";

/** A numeric threshold may ONLY appear when the source explicitly provides one — never a fabricated default like 0.7/0.8/0.9 (task item 19). */
export interface AIConfidencePolicy {
  mode: AIConfidenceMode;
  threshold?: number;
  actionWhenUncertain?: AIUncertaintyAction;
  evidenceRefs: EvidenceReference[];
}

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface AgentRiskCondition {
  description: string;
  toolIds: string[];
  evidenceRefs: EvidenceReference[];
}

/** Unresolved (empty requireHumanReviewFor, no maximumAutonomousRisk) rather than an invented threshold when no risk policy exists (task item 20). */
export interface AIAgentRiskPolicy {
  maximumAutonomousRisk?: RiskLevel;
  requireHumanReviewFor: AgentRiskCondition[];
  evidenceRefs: EvidenceReference[];
}

export interface AIAgentEscalationRule {
  id: string;
  trigger: string;
  action: string;
  evidenceRefs: EvidenceReference[];
}

/** Wraps the existing HumanApprovalRequest (governance/approvals) — never a competing approval domain (task item 17). */
export interface AIAgentHumanOversight {
  id: string;
  reason: string;
  approval: HumanApprovalRequest;
  appliesToToolIds: string[];
  evidenceRefs: EvidenceReference[];
}

export type AIAgentDefinitionStatus = "draft" | "needs-review" | "complete";

export interface AIAgentDefinition {
  id: string;
  name: string;
  version: string;

  purpose: string;

  interactionMode: AIAgentInteractionMode;
  autonomy: AIAgentAutonomy;

  modelRequirements: AIModelRequirements;

  tools: AIAgentToolSpecification[];

  inputContracts: AIAgentDataContract[];
  outputContracts: AIAgentDataContract[];

  memory: AIAgentMemoryStrategy;

  permissions: AIAgentPermission[];

  guardrails: AIAgentGuardrail[];

  humanOversight: AIAgentHumanOversight[];

  confidencePolicy: AIConfidencePolicy;
  riskPolicy: AIAgentRiskPolicy;

  escalationPolicy: AIAgentEscalationRule[];

  relatedNeedIds: string[];
  relatedProcessIds: string[];
  relatedWorkflowIds: string[];
  relatedIntegrationIds: string[];
  relatedRequirementIds: string[];

  informationGaps: InformationGap[];

  evidenceRefs: EvidenceReference[];

  status: AIAgentDefinitionStatus;
  statusReasons: string[];
}

// ─── Capability output ──────────────────────────────────────────────────────

export interface AIAgentsSection {
  implemented: boolean;
  plan?: AIAgentPlan;
  agents: AIAgentDefinition[];
  toolCatalog: AIAgentToolSpecification[];
  artifacts: ImplementationArtifact[];
  notes: string[];
}
