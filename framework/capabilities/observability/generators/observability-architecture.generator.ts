/**
 * Builds ObservabilityArchitecture from the already-generated solution
 * (DiscoveryResult + WorkflowDefinition[] + IntegrationDefinition[] +
 * AIAgentDefinition[] + SecurityArchitecture + GovernancePlan). Every
 * signal/requirement cites real architecture; nothing here invents a
 * threshold, a payload field, or a vendor telemetry format — see
 * docs/architecture/ARCHITECTURE.md "Observability and Operational
 * Architecture" for the full reasoning behind each rule below.
 */

import type { EvidenceReference } from "../../../core/contracts/evidence.js";
import type { ArchitectureReference } from "../../../core/contracts/architecture-reference.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { RequirementItem } from "../../../discovery/requirements/requirement.types.js";
import type { Constraint } from "../../../discovery/constraints/constraint.types.js";
import type { BusinessRule } from "../../../discovery/business-rules/business-rule.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { IntegrationDefinition } from "../../integrations/schemas/integrations.types.js";
import type { AIAgentDefinition } from "../../ai-agents/schemas/ai-agents.types.js";
import type { SecurityArchitecture, GovernancePlan } from "../../security-governance/schemas/security-governance.types.js";
import { makeIdGenerator } from "../../../discovery/shared/section-lookup.js";
import type {
  ObservabilityArchitecture,
  ObservabilitySignal,
  ObservabilityAttribute,
  TelemetryRequirement,
  LogRequirement,
  MetricRequirement,
  CorrelationRequirement,
  HealthRequirement,
  AlertRequirement,
  DashboardSpecification,
  AuditTelemetryMapping,
  OperationalObjective,
  OperationalObjectiveType,
} from "../schemas/observability.types.js";
import type { InformationGap } from "../../../discovery/gaps/information-gap.types.js";

// ─── Shared helpers ─────────────────────────────────────────────────────────

function attr(name: string, purpose: string, sensitivity: ObservabilityAttribute["sensitivity"] = "internal", required: ObservabilityAttribute["required"] = true): ObservabilityAttribute {
  return { name, purpose, sensitivity, required };
}

function workflowRef(id: string): ArchitectureReference {
  return { entityType: "workflow", entityId: id };
}
function stepRef(id: string): ArchitectureReference {
  return { entityType: "workflow-step", entityId: id };
}
function integrationRef(id: string): ArchitectureReference {
  return { entityType: "integration", entityId: id };
}
function agentRef(id: string): ArchitectureReference {
  return { entityType: "ai-agent", entityId: id };
}
function toolRef(id: string): ArchitectureReference {
  return { entityType: "ai-tool", entityId: id };
}

// ─── Workflow visibility (task items 13/14) ────────────────────────────────
// Baseline start/complete/fail per workflow, plus decisions/approvals/
// notifications — deliberately NOT one signal per plain WorkflowStep
// (external-task steps' visibility is already covered by the matching
// Integration's own operation signals below; blanket per-step telemetry
// would explode without adding evidence-backed value).

function buildWorkflowSignals(workflows: WorkflowDefinition[], nextId: () => string): ObservabilitySignal[] {
  const signals: ObservabilitySignal[] = [];

  for (const workflow of workflows) {
    for (const outcome of ["started", "completed", "failed"] as const) {
      signals.push({
        id: nextId(),
        name: `${workflow.name} ${outcome}`,
        type: "event",
        description: `Workflow "${workflow.name}" ${outcome}.`,
        source: workflowRef(workflow.id),
        attributes: [attr("workflowId", "correlates events to this workflow"), attr("outcome", "execution outcome")],
        sensitivity: "internal",
        provenance: "derived",
        evidenceRefs: workflow.evidenceRefs,
      });
    }

    for (const decision of workflow.decisions) {
      signals.push({
        id: nextId(),
        name: `Decision evaluated: ${decision.condition}`,
        type: "event",
        description: `Decision "${decision.condition}" was evaluated.`,
        source: stepRef(decision.stepId),
        attributes: [attr("workflowId", "correlates to the owning workflow"), attr("stepId", "the decision step"), attr("outcome", "which branch was taken")],
        sensitivity: "internal",
        provenance: "derived",
        evidenceRefs: decision.evidenceRefs,
      });
    }

    for (const approval of workflow.approvals) {
      for (const phase of ["requested", "completed"] as const) {
        signals.push({
          id: nextId(),
          name: `Approval ${phase}: ${approval.approval.reason}`,
          type: "event",
          description: `Human approval ("${approval.approval.reason}") was ${phase === "requested" ? "requested" : "resolved"}.`,
          source: stepRef(approval.stepId),
          attributes: [
            attr("workflowId", "correlates to the owning workflow"),
            attr("stepId", "the approval step"),
            ...(phase === "completed" ? [attr("outcome", "approval decision")] : []),
          ],
          sensitivity: "internal",
          provenance: "derived",
          evidenceRefs: approval.evidenceRefs,
        });
      }
    }

    for (const notification of workflow.notifications) {
      signals.push({
        id: nextId(),
        name: `Notification attempted: ${notification.description}`,
        type: "event",
        description: `Notification ("${notification.description}") delivery was attempted.`,
        source: workflowRef(workflow.id),
        attributes: [attr("workflowId", "correlates to the owning workflow"), attr("outcome", "delivery attempt outcome")],
        sensitivity: "internal",
        provenance: "derived",
        evidenceRefs: notification.evidenceRefs,
      });
    }
  }

  return signals;
}

function buildWorkflowHealth(workflows: WorkflowDefinition[], nextId: () => string): HealthRequirement[] {
  return workflows.map((w) => ({
    id: nextId(),
    target: workflowRef(w.id),
    type: "business-process",
    description: `Ability to determine whether workflow "${w.name}" is completing successfully.`,
    evidenceRefs: w.evidenceRefs,
  }));
}

// ─── Integration visibility (task items 15/16) ─────────────────────────────

function buildIntegrationSignals(integrations: IntegrationDefinition[], nextId: () => string): ObservabilitySignal[] {
  const signals: ObservabilitySignal[] = [];

  for (const integration of integrations) {
    const restOp = integration.restContract?.operations[0];
    const httpAttrs: ObservabilityAttribute[] =
      restOp?.method && restOp?.path
        ? [attr("httpMethod", "explicit HTTP method", "internal", true), attr("httpPath", "explicit HTTP path", "internal", true)]
        : [];

    for (const operation of integration.operations) {
      for (const outcome of ["attempted", "succeeded", "failed"] as const) {
        signals.push({
          id: nextId(),
          name: `${operation.name} ${outcome}`,
          type: "event",
          description: `Integration operation "${operation.name}" (${integration.name}) ${outcome}.`,
          source: integrationRef(integration.id),
          attributes: [
            attr("integrationId", "correlates to the owning integration"),
            attr("operationId", "which operation"),
            attr("outcome", "attempt outcome"),
            ...(outcome !== "attempted" ? httpAttrs : []),
          ],
          sensitivity: "internal",
          provenance: "derived",
          evidenceRefs: operation.evidenceRefs,
        });
      }
    }
  }

  return signals;
}

function buildIntegrationMetrics(integrations: IntegrationDefinition[], nextId: () => string): MetricRequirement[] {
  const metrics: MetricRequirement[] = [];

  for (const integration of integrations) {
    if (integration.operations.length === 0) continue;
    metrics.push(
      {
        id: nextId(),
        name: `${integration.name} operation count`,
        kind: "counter",
        description: `Count of operation attempts for "${integration.name}".`,
        source: integrationRef(integration.id),
        evidenceRefs: integration.evidenceRefs,
      },
      {
        id: nextId(),
        name: `${integration.name} failure count`,
        kind: "counter",
        description: `Count of operation failures for "${integration.name}".`,
        source: integrationRef(integration.id),
        evidenceRefs: integration.evidenceRefs,
      },
      {
        id: nextId(),
        name: `${integration.name} operation duration`,
        kind: "timer",
        description: `Duration of operation attempts for "${integration.name}". No target/threshold implied.`,
        source: integrationRef(integration.id),
        evidenceRefs: integration.evidenceRefs,
      }
    );
  }

  return metrics;
}

function buildIntegrationHealth(integrations: IntegrationDefinition[], nextId: () => string): HealthRequirement[] {
  return integrations.map((i) => ({
    id: nextId(),
    target: integrationRef(i.id),
    type: "dependency",
    description: `Ability to determine whether "${i.name}" is operational.`,
    evidenceRefs: i.evidenceRefs,
  }));
}

// ─── AI Agent visibility (task items 17/18) ────────────────────────────────
// attributes are restricted to a fixed operational-metadata set built here —
// this function has no code path that reads message/response/prompt/
// conversation content, only real architecture ids (task item 18).

function aiAttrs(...names: Array<"agentId" | "toolId" | "outcome" | "escalationReason">): ObservabilityAttribute[] {
  const purposes: Record<string, string> = {
    agentId: "correlates to the owning agent",
    toolId: "which tool",
    outcome: "invocation/interaction outcome",
    escalationReason: "why escalation occurred (metadata only, never conversation content)",
  };
  return names.map((n) => attr(n, purposes[n]));
}

function buildAIAgentSignals(agents: AIAgentDefinition[], nextId: () => string): ObservabilitySignal[] {
  const signals: ObservabilitySignal[] = [];

  for (const agent of agents) {
    for (const outcome of ["started", "completed"] as const) {
      signals.push({
        id: nextId(),
        name: `${agent.name} interaction ${outcome}`,
        type: "event",
        description: `Agent "${agent.name}" interaction ${outcome}.`,
        source: agentRef(agent.id),
        attributes: aiAttrs("agentId", "outcome"),
        sensitivity: "internal",
        provenance: "derived",
        evidenceRefs: agent.evidenceRefs,
      });
    }

    for (const tool of agent.tools) {
      for (const outcome of ["requested", "completed", "failed"] as const) {
        signals.push({
          id: nextId(),
          // "Tool invocation: " prefix disambiguates from the underlying
          // IntegrationOperation's own attempt/outcome signal when a tool
          // wraps one (same display name otherwise) — the two are related
          // but distinct facts: "the operation happened" vs. "the agent
          // specifically invoked it."
          name: `Tool invocation: ${tool.name} ${outcome}`,
          type: "event",
          description: `Tool "${tool.name}" invocation by agent "${agent.name}" ${outcome}.`,
          source: toolRef(tool.id),
          attributes: aiAttrs("agentId", "toolId", "outcome"),
          sensitivity: "internal",
          provenance: "derived",
          evidenceRefs: tool.evidenceRefs,
        });
      }
    }

    for (const escalation of agent.escalationPolicy) {
      signals.push({
        id: nextId(),
        name: `${agent.name} escalation occurred`,
        type: "event",
        description: `Agent "${agent.name}" escalated when "${escalation.trigger}".`,
        source: agentRef(agent.id),
        attributes: aiAttrs("agentId", "escalationReason"),
        sensitivity: "internal",
        provenance: "derived",
        evidenceRefs: escalation.evidenceRefs,
      });
    }

    for (const oversight of agent.humanOversight) {
      for (const phase of ["requested", "outcome"] as const) {
        signals.push({
          id: nextId(),
          name: `${agent.name} human approval ${phase}`,
          type: "event",
          description: `Human approval for agent "${agent.name}" ("${oversight.reason}") — ${phase}.`,
          source: agentRef(agent.id),
          attributes: aiAttrs("agentId", "outcome"),
          sensitivity: "internal",
          provenance: "derived",
          evidenceRefs: oversight.evidenceRefs,
        });
      }
    }
  }

  return signals;
}

// ─── Security-aware telemetry (task items 19/20) ───────────────────────────

function buildSecurityTelemetryRequirements(
  security: SecurityArchitecture,
  nextId: () => string
): { requirements: TelemetryRequirement[]; logRequirements: LogRequirement[] } {
  const requirements: TelemetryRequirement[] = [];
  const logRequirements: LogRequirement[] = [];

  for (const req of security.requirements) {
    if (req.domain !== "secrets") continue;
    for (const ref of req.appliesTo) {
      if (ref.entityType !== "integration") continue;
      logRequirements.push({
        id: nextId(),
        event: "integration operation outcome",
        level: "unknown",
        source: ref,
        fields: [],
        prohibitedData: ["credential/API-key material"],
        evidenceRefs: req.evidenceRefs,
      });
    }
  }

  for (const dp of security.dataProtection) {
    if (dp.classification === "public" || dp.classification === "internal") continue;
    const appliesTo: ArchitectureReference[] = dp.dataContractIds.map((id) => ({ entityType: "data-contract", entityId: id }));
    requirements.push({
      id: nextId(),
      purpose: "security",
      appliesTo,
      requiredSignals: [],
      description: `Telemetry must avoid recording the associated business payload until data classification (currently "${dp.classification}") and logging policy are resolved.`,
      evidenceRefs: dp.evidenceRefs,
      status: "needs-information",
    });
  }

  return { requirements, logRequirements };
}

// ─── Audit mapping (task items 25/26) ──────────────────────────────────────

function refsOverlap(a: ArchitectureReference[], b: ArchitectureReference[]): boolean {
  return a.some((x) => b.some((y) => x.entityType === y.entityType && x.entityId === y.entityId));
}

function buildAuditMappings(
  auditRequirements: SecurityArchitecture["auditRequirements"],
  signals: ObservabilitySignal[],
  nextId: () => string
): AuditTelemetryMapping[] {
  const mappings: AuditTelemetryMapping[] = [];

  for (const audit of auditRequirements) {
    const matchingSignals = signals.filter((s) => refsOverlap(audit.appliesTo, [s.source]));
    if (matchingSignals.length === 0) continue;
    mappings.push({
      id: nextId(),
      auditRequirementId: audit.id,
      signalIds: matchingSignals.map((s) => s.id),
      evidenceRefs: audit.evidenceRefs,
    });
  }

  return mappings;
}

// ─── Correlation (task items 23/24) ────────────────────────────────────────

function buildCorrelationRequirements(
  integrations: IntegrationDefinition[],
  agents: AIAgentDefinition[],
  nextId: () => string
): CorrelationRequirement[] {
  const correlations: CorrelationRequirement[] = [];

  for (const integration of integrations) {
    for (const workflowId of integration.relatedWorkflowIds) {
      correlations.push({
        id: nextId(),
        description: `Operations for "${integration.name}" should be correlatable back to the workflow that triggered them.`,
        architecturePath: [workflowRef(workflowId), integrationRef(integration.id)],
        correlationRequired: true,
        evidenceRefs: integration.evidenceRefs,
      });
    }
  }

  for (const agent of agents) {
    for (const workflowId of agent.relatedWorkflowIds) {
      correlations.push({
        id: nextId(),
        description: `Agent "${agent.name}" interactions should be correlatable back to the workflow they participate in.`,
        architecturePath: [workflowRef(workflowId), agentRef(agent.id)],
        correlationRequired: true,
        evidenceRefs: agent.evidenceRefs,
      });
    }

    for (const tool of agent.tools) {
      if (tool.kind !== "integration-operation" || !tool.integrationId) continue;
      correlations.push({
        id: nextId(),
        description: `Tool "${tool.name}" invocations by agent "${agent.name}" should be correlatable to the underlying integration operation.`,
        architecturePath: [agentRef(agent.id), toolRef(tool.id), integrationRef(tool.integrationId)],
        correlationRequired: true,
        evidenceRefs: tool.evidenceRefs,
      });
    }
  }

  return correlations;
}

// ─── Operational objectives — explicit thresholds only (task items 28/41/52) ──

const PERCENT_PATTERN = /\b\d{1,3}(\.\d+)?\s?%/;
const TIME_PATTERN = /\b\d+(\.\d+)?\s?(ms|milliseconds?|seconds?|sec\b|minutes?|min\b)/i;
const COUNT_THRESHOLD_PATTERN = /\b\d+\s+consecutive\b/i;

function classifyObjectiveType(text: string): OperationalObjectiveType {
  if (/\blatenc|\bcomplete[sd]? within|\bresponse time/i.test(text) && TIME_PATTERN.test(text)) return "latency";
  if (/\bavailab|\buptime/i.test(text)) return "availability";
  if (/\berror\b/i.test(text)) return "error-rate";
  if (/\bthroughput\b/i.test(text)) return "throughput";
  if (/\bcomplet/i.test(text)) return "completion-time";
  return "unknown";
}

function extractThreshold(text: string): string | undefined {
  const percent = text.match(PERCENT_PATTERN);
  const time = text.match(TIME_PATTERN);
  if (percent && time) return `${percent[0]} within ${time[0]}`;
  return percent?.[0] ?? time?.[0];
}

interface TextSource {
  id: string;
  description: string;
  entityType: "requirement" | "constraint" | "business-rule";
  relatedProcessIds?: string[];
}

function collectTextSources(discovery: DiscoveryResult): TextSource[] {
  return [
    ...discovery.requirements.map((r: RequirementItem): TextSource => ({ id: r.id, description: r.description, entityType: "requirement", relatedProcessIds: r.relatedProcessIds })),
    ...discovery.constraints.map((c: Constraint): TextSource => ({ id: c.id, description: c.description, entityType: "constraint" })),
    ...discovery.businessRules.map((b: BusinessRule): TextSource => ({ id: b.id, description: b.description, entityType: "business-rule", relatedProcessIds: b.relatedProcessIds })),
  ];
}

function buildOperationalObjectives(
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  nextId: () => string
): OperationalObjective[] {
  const objectives: OperationalObjective[] = [];

  for (const source of collectTextSources(discovery)) {
    const threshold = extractThreshold(source.description);
    if (!threshold) continue;

    const matchingWorkflows = workflows.filter((w) => source.relatedProcessIds?.includes(w.processId));
    const target: ArchitectureReference[] = matchingWorkflows.map((w) => workflowRef(w.id));

    objectives.push({
      id: nextId(),
      name: source.description,
      target,
      objectiveType: classifyObjectiveType(source.description),
      targetValue: threshold,
      explicit: true,
      evidenceRefs: [{ entityType: source.entityType, entityId: source.id, description: source.description }],
    });
  }

  return objectives;
}

// ─── Alerts — narrow, evidence-only (task items 29/30) ─────────────────────

const ALERT_LANGUAGE_PATTERN = /\bnotif(y|ied)\b.*\bafter\b|\balert\b|\bmust be notified\b/i;

function buildAlertRequirements(
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  nextId: () => string,
  nextGapId: () => string
): { alerts: AlertRequirement[]; gaps: InformationGap[] } {
  const alerts: AlertRequirement[] = [];
  const gaps: InformationGap[] = [];

  for (const source of collectTextSources(discovery)) {
    if (!ALERT_LANGUAGE_PATTERN.test(source.description)) continue;
    const threshold = source.description.match(COUNT_THRESHOLD_PATTERN)?.[0] ?? extractThreshold(source.description);

    const alertId = nextId();
    alerts.push({
      id: alertId,
      name: source.description,
      sourceSignalIds: [],
      condition: source.description,
      threshold,
      destination: undefined,
      severity: "warning",
      provenance: "explicit",
      evidenceRefs: [{ entityType: source.entityType, entityId: source.id, description: source.description }],
    });

    gaps.push({
      id: nextGapId(),
      topic: "Alert destination",
      question: `Who or what system should receive the alert for "${source.description}"?`,
      importance: "medium",
      blocking: false,
      relatedCapabilityIds: ["observability"],
    });
  }

  for (const workflow of workflows) {
    if (workflow.approvals.length === 0) continue;
    const requestSignalName = `Approval requested: ${workflow.approvals[0].approval.reason}`;

    alerts.push({
      id: nextId(),
      name: `${workflow.name} approval pending review`,
      sourceSignalIds: [],
      condition: `Workflow "${workflow.name}" has a pending human approval requiring review.`,
      threshold: undefined,
      destination: undefined,
      severity: "warning",
      provenance: "derived",
      evidenceRefs: workflow.approvals[0].evidenceRefs,
    });

    gaps.push({
      id: nextGapId(),
      topic: "Alert destination",
      question: `Who should be notified when workflow "${workflow.name}" has a pending approval (${requestSignalName})?`,
      importance: "low",
      blocking: false,
      relatedCapabilityIds: ["observability"],
    });
  }

  return { alerts, gaps };
}

// ─── Dashboards (task item 31) ─────────────────────────────────────────────

function buildDashboards(
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[],
  agents: AIAgentDefinition[],
  signals: ObservabilitySignal[],
  nextId: () => string
): DashboardSpecification[] {
  const dashboards: DashboardSpecification[] = [];

  if (workflows.length > 0) {
    const signalIds = signals.filter((s) => s.source.entityType === "workflow" || s.source.entityType === "workflow-step").map((s) => s.id);
    if (signalIds.length > 0) {
      dashboards.push({
        id: nextId(),
        name: "Workflow Operations View",
        purpose: "Operational visibility into generated workflow execution outcomes, decisions, and approvals.",
        signalIds,
        audienceRoles: ["operations"],
        evidenceRefs: workflows.flatMap((w) => w.evidenceRefs),
      });
    }
  }

  if (integrations.length > 0) {
    const signalIds = signals.filter((s) => s.source.entityType === "integration").map((s) => s.id);
    if (signalIds.length > 0) {
      dashboards.push({
        id: nextId(),
        name: "Integration Health View",
        purpose: "Operational visibility into external integration operation outcomes.",
        signalIds,
        audienceRoles: ["operations"],
        evidenceRefs: integrations.flatMap((i) => i.evidenceRefs),
      });
    }
  }

  if (agents.length > 0) {
    const signalIds = signals.filter((s) => s.source.entityType === "ai-agent" || s.source.entityType === "ai-tool").map((s) => s.id);
    if (signalIds.length > 0) {
      dashboards.push({
        id: nextId(),
        name: "AI Agent Operations View",
        purpose: "Operational visibility into AI agent interactions, tool invocations, and escalations.",
        signalIds,
        audienceRoles: ["operations"],
        evidenceRefs: agents.flatMap((a) => a.evidenceRefs),
      });
    }
  }

  return dashboards;
}

// ─── Main build ─────────────────────────────────────────────────────────

export function buildObservabilityArchitecture(
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[],
  integrations: IntegrationDefinition[],
  agents: AIAgentDefinition[],
  security: SecurityArchitecture,
  _governance: GovernancePlan
): ObservabilityArchitecture {
  const ids = {
    signal: makeIdGenerator("SIGNAL"),
    telemetryReq: makeIdGenerator("TELREQ"),
    log: makeIdGenerator("LOGREQ"),
    metric: makeIdGenerator("METRIC"),
    correlation: makeIdGenerator("CORR"),
    health: makeIdGenerator("HEALTH"),
    alert: makeIdGenerator("ALERT"),
    dashboard: makeIdGenerator("DASH"),
    auditMapping: makeIdGenerator("AUDITMAP"),
    objective: makeIdGenerator("OBJ"),
    gap: makeIdGenerator("OBSGAP"),
  };

  const workflowSignals = buildWorkflowSignals(workflows, ids.signal);
  const integrationSignals = buildIntegrationSignals(integrations, ids.signal);
  const agentSignals = buildAIAgentSignals(agents, ids.signal);
  const signals = [...workflowSignals, ...integrationSignals, ...agentSignals];

  const metricRequirements = buildIntegrationMetrics(integrations, ids.metric);
  const healthRequirements = [...buildWorkflowHealth(workflows, ids.health), ...buildIntegrationHealth(integrations, ids.health)];
  const correlationRequirements = buildCorrelationRequirements(integrations, agents, ids.correlation);
  const { requirements: securityTelemetryRequirements, logRequirements } = buildSecurityTelemetryRequirements(security, ids.telemetryReq);
  const auditMappings = buildAuditMappings(security.auditRequirements, signals, ids.auditMapping);
  const operationalObjectives = buildOperationalObjectives(discovery, workflows, ids.objective);
  const { alerts: alertRequirements, gaps: alertGaps } = buildAlertRequirements(discovery, workflows, ids.alert, ids.gap);
  const dashboardSpecifications = buildDashboards(workflows, integrations, agents, signals, ids.dashboard);

  const telemetryRequirements = securityTelemetryRequirements;

  // Reference (never duplicate) an existing unresolved "Customer data" gap
  // when there's telemetry it's actually relevant to — task item 32's
  // "deduplicate against Discovery/Integration/Security/AI gaps" — the
  // exact same InformationGap object/id is reused, no new id minted.
  const customerDataGap = discovery.informationGaps.find((g) => g.topic === "Customer data");
  const referencedDiscoveryGaps = customerDataGap && signals.length > 0 ? [customerDataGap] : [];

  const informationGaps = [...alertGaps, ...referencedDiscoveryGaps];

  const statusReasons: string[] = [];
  if (telemetryRequirements.some((r) => r.status === "needs-information")) statusReasons.push("some telemetry requirements need more information (data classification/logging policy)");
  if (alertRequirements.some((a) => !a.destination)) statusReasons.push("some alert requirements have no known destination");
  if (operationalObjectives.length === 0 && (workflows.length > 0 || integrations.length > 0)) statusReasons.push("no explicit operational objectives were stated");
  if (informationGaps.length > 0) statusReasons.push(`${informationGaps.length} unresolved information gap(s)`);

  const hasAnyArchitecture = signals.length > 0 || metricRequirements.length > 0 || healthRequirements.length > 0;
  const status = !hasAnyArchitecture ? "draft" : statusReasons.length > 0 ? "needs-review" : "complete";

  const evidenceRefs: EvidenceReference[] = [
    ...signals.flatMap((s) => s.evidenceRefs),
    ...telemetryRequirements.flatMap((r) => r.evidenceRefs),
  ];

  return {
    version: "1.0",
    telemetryRequirements,
    signals,
    logRequirements,
    metricRequirements,
    correlationRequirements,
    healthRequirements,
    alertRequirements,
    dashboardSpecifications,
    auditMappings,
    operationalObjectives,
    informationGaps,
    evidenceRefs,
    status,
    statusReasons,
  };
}
