/**
 * Phase 7A — replaces the Phase 0 checklist-shaped model (unstructured
 * `string[]` for logging/metrics/tracing/alerting/dashboards/auditEvents)
 * with a real, evidence-backed ObservabilityArchitecture. Observability is
 * *derived from the solution already generated*
 * (WorkflowDefinition[]/IntegrationDefinition[]/AIAgentDefinition[]/
 * SecurityArchitecture/GovernancePlan), never a generic checklist — see
 * docs/architecture/ARCHITECTURE.md "Observability and Operational
 * Architecture".
 *
 * `implemented: true` means Stitchfy generated and validated a vendor-
 * neutral observability and operational architecture for the currently
 * known solution — it does NOT mean telemetry is being collected, logging
 * exists, dashboards are deployed, alerts are active, tracing is
 * installed, an SLO is being met, or production operations are ready.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";

// ─── Planning (observability.planner.ts) ───────────────────────────────────

export type TelemetryCandidateSourceKind = "workflow" | "integration" | "ai-agent" | "security";

export interface TelemetryCandidate {
  id: string;
  sourceKind: TelemetryCandidateSourceKind;
  sourceId: string;
  rationale: string;
}

export interface ObservabilityPlan {
  workflowIds: string[];
  integrationIds: string[];
  agentIds: string[];
  securityRequirementIds: string[];
  auditRequirementIds: string[];
  telemetryCandidates: TelemetryCandidate[];
  explicitOperationalRequirementIds: string[];
  informationGapIds: string[];
  assumptions: string[];
}

// ─── Shared sensitivity / attribute vocabulary ─────────────────────────────

export type ObservabilitySensitivity = "public" | "internal" | "confidential" | "restricted" | "unknown";

/**
 * Operational metadata only — never a business payload field. Generators in
 * this capability have no code path that reads message/response/prompt/
 * conversation/body content, only real architecture ids (workflowId,
 * stepId, integrationId, operationId, agentId, toolId, outcome, ...) —
 * restraint by construction, not by a runtime filter (task items 12, 18).
 */
export interface ObservabilityAttribute {
  name: string;
  purpose: string;
  sensitivity: ObservabilitySensitivity;
  required: true | false | "unknown";
}

// ─── TelemetryRequirement ───────────────────────────────────────────────────

export type TelemetryPurpose = "operational" | "diagnostic" | "audit" | "security" | "business" | "performance" | "reliability";
export type TelemetryRequirementStatus = "defined" | "needs-information";

export interface TelemetryRequirement {
  id: string;
  purpose: TelemetryPurpose;
  appliesTo: ArchitectureReference[];
  requiredSignals: string[];
  description: string;
  evidenceRefs: EvidenceReference[];
  status: TelemetryRequirementStatus;
}

// ─── ObservabilitySignal ─────────────────────────────────────────────────────

export type ObservabilitySignalType = "log" | "metric" | "trace" | "event" | "audit-event";
/** Distinguishes a user-stated fact from an architecture-derived recommendation (task item 41) — never presented as user-supplied when it isn't. */
export type ObservabilityProvenance = "explicit" | "derived";

export interface ObservabilitySignal {
  id: string;
  name: string;
  type: ObservabilitySignalType;
  description: string;
  source: ArchitectureReference;
  attributes: ObservabilityAttribute[];
  sensitivity: ObservabilitySensitivity;
  provenance: ObservabilityProvenance;
  evidenceRefs: EvidenceReference[];
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warning" | "error" | "unknown";

export interface LogRequirement {
  id: string;
  event: string;
  level: LogLevel;
  source: ArchitectureReference;
  fields: ObservabilityAttribute[];
  prohibitedData: string[];
  evidenceRefs: EvidenceReference[];
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export type MetricKind = "counter" | "gauge" | "histogram" | "timer" | "unknown";

export interface MetricRequirement {
  id: string;
  name: string;
  kind: MetricKind;
  description: string;
  unit?: string;
  source: ArchitectureReference;
  evidenceRefs: EvidenceReference[];
}

// ─── Correlation ─────────────────────────────────────────────────────────────

export interface CorrelationRequirement {
  id: string;
  description: string;
  architecturePath: ArchitectureReference[];
  correlationRequired: true | false | "unknown";
  evidenceRefs: EvidenceReference[];
}

// ─── Health ──────────────────────────────────────────────────────────────────

export type HealthRequirementType = "availability" | "dependency" | "readiness" | "liveness" | "business-process" | "unknown";

export interface HealthRequirement {
  id: string;
  target: ArchitectureReference;
  type: HealthRequirementType;
  description: string;
  evidenceRefs: EvidenceReference[];
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "warning" | "critical" | "unknown";

export interface AlertRequirement {
  id: string;
  name: string;
  sourceSignalIds: string[];
  condition: string;
  threshold?: string;
  destination?: string;
  severity: AlertSeverity;
  provenance: ObservabilityProvenance;
  evidenceRefs: EvidenceReference[];
}

// ─── Dashboards ──────────────────────────────────────────────────────────────

export interface DashboardSpecification {
  id: string;
  name: string;
  purpose: string;
  signalIds: string[];
  audienceRoles: string[];
  evidenceRefs: EvidenceReference[];
}

// ─── Audit mapping ───────────────────────────────────────────────────────────
// Answers "which observability signals satisfy this architecture's audit
// requirement" — never a competing audit domain; auditRequirementId always
// points at a real SecurityArchitecture.auditRequirements entry (task item 25).

export interface AuditTelemetryMapping {
  id: string;
  auditRequirementId: string;
  signalIds: string[];
  evidenceRefs: EvidenceReference[];
}

// ─── Operational objectives ─────────────────────────────────────────────────

export type OperationalObjectiveType = "availability" | "latency" | "error-rate" | "throughput" | "completion-time" | "unknown";

export interface OperationalObjective {
  id: string;
  name: string;
  target: ArchitectureReference[];
  objectiveType: OperationalObjectiveType;
  targetValue?: string;
  explicit: boolean;
  evidenceRefs: EvidenceReference[];
}

// ─── ObservabilityArchitecture ──────────────────────────────────────────────

export type ObservabilityArchitectureStatus = "draft" | "needs-review" | "complete";

export interface ObservabilityArchitecture {
  version: string;
  telemetryRequirements: TelemetryRequirement[];
  signals: ObservabilitySignal[];
  logRequirements: LogRequirement[];
  metricRequirements: MetricRequirement[];
  correlationRequirements: CorrelationRequirement[];
  healthRequirements: HealthRequirement[];
  alertRequirements: AlertRequirement[];
  dashboardSpecifications: DashboardSpecification[];
  auditMappings: AuditTelemetryMapping[];
  operationalObjectives: OperationalObjective[];
  informationGaps: InformationGap[];
  evidenceRefs: EvidenceReference[];
  status: ObservabilityArchitectureStatus;
  statusReasons: string[];
}

// ─── Capability output ──────────────────────────────────────────────────────

export interface ObservabilitySection {
  implemented: boolean;
  plan?: ObservabilityPlan;
  architecture: ObservabilityArchitecture;
  artifacts: ImplementationArtifact[];
  notes: string[];
}
