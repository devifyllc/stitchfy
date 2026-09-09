/**
 * Builds the Implementation Backlog — a projection of actionable
 * engineering entities already present in the blueprint (see
 * docs/architecture/ARCHITECTURE.md "Solution Report"). Every extractor
 * below reads real fields off a real typed section; none of them compute a
 * new priority/status/risk-level. An id that appears in more than one
 * section (e.g. a gap referenced by both discovery and a capability) is
 * merged — its capabilityIds list grows — never duplicated as two rows.
 */

import type { SolutionBlueprint } from "../../schemas/solution-blueprint/solution-blueprint.types.js";
import type { InformationGap } from "../../discovery/gaps/information-gap.types.js";
import type { RiskAssessment } from "../../planning/risk-assessment/risk-assessment.types.js";
import type { RequirementItem } from "../../discovery/requirements/requirement.types.js";
import type { SolutionDecision } from "../../planning/capability-assessment/solution-plan.types.js";
import type {
  SecurityRequirement,
  InformationGapReference,
} from "../../capabilities/security-governance/schemas/security-governance.types.js";
import type {
  ModernizationArchitecture,
  TargetStateRequirement,
  MigrationValidationRequirement,
  ModernizationDelta,
  TechnicalDebtItem,
  MigrationCandidate,
  ModernizationWorkstream,
} from "../../capabilities/modernization/schemas/modernization.types.js";
import type { ModernizationExportBundle } from "../../capabilities/modernization/exporters/exporter.types.js";
import type { IntegrationDefinition } from "../../capabilities/integrations/schemas/integrations.types.js";
import type {
  TelemetryRequirement,
  AlertRequirement,
  HealthRequirement,
  OperationalObjective,
} from "../../capabilities/observability/schemas/observability.types.js";
import type { WorkflowDefinition } from "../../capabilities/workflow-automation/schemas/workflow-automation.types.js";
import type { AIAgentDefinition } from "../../capabilities/ai-agents/schemas/ai-agents.types.js";
import type { DiscoveryMetadata } from "../../core/contracts/provenance.js";
import type { BacklogItem, BacklogItemType, EntityIndexEntry } from "./types.js";
import { toReportEvidenceRefs, toArchitectureReportRefs, toCodebaseReportRefs } from "./evidence.js";

type Bag = Map<string, BacklogItem>;

function upsert(bag: Bag, item: BacklogItem): void {
  const existing = bag.get(item.id);
  if (!existing) {
    bag.set(item.id, item);
    return;
  }
  for (const capabilityId of item.capabilityIds) {
    if (!existing.capabilityIds.includes(capabilityId)) existing.capabilityIds.push(capabilityId);
  }
}

function metadataExplicitness(metadata: DiscoveryMetadata | undefined): string | undefined {
  if (!metadata) return undefined;
  if (metadata.inferred) return "inferred";
  return metadata.sources.some((s) => s.sourceType === "derived") ? "derived" : "explicit";
}

function metadataRationale(metadata: DiscoveryMetadata | undefined): string[] {
  if (!metadata) return [];
  return metadata.sources
    .map((s) => (s.text ? `${s.section ? `${s.section}: ` : ""}${s.text}` : s.section))
    .filter((s): s is string => Boolean(s));
}

// ─── Discovery-level ────────────────────────────────────────────────────────

function addRequirements(bag: Bag, requirements: RequirementItem[] | undefined): void {
  for (const r of requirements ?? []) {
    upsert(bag, {
      id: r.id,
      type: "Requirement",
      capabilityIds: [],
      title: r.description,
      category: r.type,
      priority: r.priority,
      explicitness: metadataExplicitness(r.metadata),
      rationale: metadataRationale(r.metadata),
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: [],
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: r,
    });
  }
}

function addInformationGaps(bag: Bag, gaps: InformationGap[] | undefined, capabilityIds: string[]): void {
  for (const g of gaps ?? []) {
    upsert(bag, {
      id: g.id,
      type: "Information Gap",
      capabilityIds: capabilityIds.length > 0 ? capabilityIds : g.relatedCapabilityIds,
      title: g.topic,
      description: g.question,
      category: g.importance,
      blocking: g.blocking,
      rationale: [],
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: [],
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: g,
    });
  }
}

function addSecurityGapReferences(bag: Bag, refs: InformationGapReference[] | undefined): void {
  for (const ref of refs ?? []) {
    if (!ref.isNew) continue; // references an already-listed discovery gap — don't duplicate it as a new row
    upsert(bag, {
      id: ref.gapId,
      type: "Information Gap",
      capabilityIds: ["security-governance"],
      title: ref.topic,
      description: ref.question,
      rationale: [],
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: [],
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: ref,
    });
  }
}

function addDecisions(bag: Bag, decisions: SolutionDecision[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const d of decisions ?? []) {
    upsert(bag, {
      id: d.id,
      type: "Architecture Decision",
      capabilityIds: [d.capabilityId],
      title: `${d.capabilityId}: ${d.decision}`,
      description: d.rationale.join(" "),
      status: d.decision,
      rationale: d.rationale,
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: toReportEvidenceRefs(d.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: d,
    });
  }
}

function addRisks(bag: Bag, risks: RiskAssessment[] | undefined, capabilityIds: string[], entityIndex: Record<string, EntityIndexEntry>): void {
  for (const r of risks ?? []) {
    upsert(bag, {
      id: r.id,
      type: "Risk",
      capabilityIds,
      title: r.description,
      category: r.category,
      likelihood: r.likelihood,
      impact: r.impact,
      status: r.status,
      rationale: [`Treatment: ${r.treatment}`],
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: toArchitectureReportRefs(r.relatedArchitectureRefs, entityIndex),
      evidenceRefs: toReportEvidenceRefs(r.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: r,
    });
  }
}

// ─── Security-governance ────────────────────────────────────────────────────

function addSecurityRequirements(bag: Bag, requirements: SecurityRequirement[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const r of requirements ?? []) {
    upsert(bag, {
      id: r.id,
      type: "Security Requirement",
      capabilityIds: ["security-governance"],
      title: r.description,
      category: r.domain,
      priority: r.priority,
      status: r.status,
      rationale: [],
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: toArchitectureReportRefs(r.appliesTo, entityIndex),
      evidenceRefs: toReportEvidenceRefs(r.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: r,
    });
  }
}

// ─── Observability ──────────────────────────────────────────────────────────

function addTelemetryRequirements(bag: Bag, items: TelemetryRequirement[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const t of items ?? []) {
    upsert(bag, {
      id: t.id,
      type: "Observability Requirement",
      capabilityIds: ["observability"],
      title: t.description,
      category: `telemetry: ${t.purpose}`,
      status: t.status,
      rationale: [`Required signals: ${t.requiredSignals.join(", ") || "none specified"}`],
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: toArchitectureReportRefs(t.appliesTo, entityIndex),
      evidenceRefs: toReportEvidenceRefs(t.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: t,
    });
  }
}

function addAlertRequirements(bag: Bag, items: AlertRequirement[] | undefined): void {
  for (const a of items ?? []) {
    upsert(bag, {
      id: a.id,
      type: "Observability Requirement",
      capabilityIds: ["observability"],
      title: a.name,
      description: a.condition,
      category: `alert: ${a.severity}`,
      explicitness: a.provenance,
      rationale: a.threshold ? [`Threshold: ${a.threshold}`] : [],
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: [],
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: a,
    });
  }
}

function addHealthRequirements(bag: Bag, items: HealthRequirement[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const h of items ?? []) {
    upsert(bag, {
      id: h.id,
      type: "Observability Requirement",
      capabilityIds: ["observability"],
      title: h.description,
      category: `health: ${h.type}`,
      rationale: [],
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: toArchitectureReportRefs([h.target], entityIndex),
      evidenceRefs: toReportEvidenceRefs(h.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: h,
    });
  }
}

function addOperationalObjectives(bag: Bag, items: OperationalObjective[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const o of items ?? []) {
    upsert(bag, {
      id: o.id,
      type: "Observability Requirement",
      capabilityIds: ["observability"],
      title: o.name,
      category: `objective: ${o.objectiveType}`,
      explicitness: o.explicit ? "explicit" : "derived",
      description: o.targetValue ? `Target: ${o.targetValue}` : undefined,
      rationale: [],
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: toArchitectureReportRefs(o.target, entityIndex),
      evidenceRefs: toReportEvidenceRefs(o.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: o,
    });
  }
}

// ─── Integrations ───────────────────────────────────────────────────────────

function addIntegrationActions(bag: Bag, integrations: IntegrationDefinition[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const i of integrations ?? []) {
    upsert(bag, {
      id: i.id,
      type: "Integration Action",
      capabilityIds: ["integrations"],
      title: i.name,
      description: i.purpose,
      category: i.interactionPattern,
      status: i.status,
      rationale: i.statusReasons,
      relatedSystemIds: [i.sourceSystemId, i.targetSystemId].filter((s): s is string => Boolean(s)),
      relatedRequirementIds: i.relatedRequirementIds,
      architectureRefs: [],
      evidenceRefs: toReportEvidenceRefs(i.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: i.informationGaps.map((g) => g.id),
      raw: i,
    });
    addInformationGaps(bag, i.informationGaps, ["integrations"]);
  }
}

// ─── Workflow automation / AI agents (per-item information gaps only) ──────

function addWorkflowGaps(bag: Bag, workflows: WorkflowDefinition[] | undefined): void {
  for (const w of workflows ?? []) addInformationGaps(bag, w.informationGaps, ["workflow-automation"]);
}

function addAgentGaps(bag: Bag, agents: AIAgentDefinition[] | undefined): void {
  for (const a of agents ?? []) addInformationGaps(bag, a.informationGaps, ["ai-agents"]);
}

// ─── Modernization ──────────────────────────────────────────────────────────

function addTargetStateRequirements(bag: Bag, items: TargetStateRequirement[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const t of items ?? []) {
    upsert(bag, {
      id: t.id,
      type: "Target-State Requirement",
      capabilityIds: ["modernization"],
      title: t.description,
      category: t.category,
      explicitness: t.explicit ? "explicit" : "derived",
      relatedSystemIds: t.relatedSystemIds,
      rationale: [],
      relatedRequirementIds: [],
      architectureRefs: toArchitectureReportRefs(t.architectureRefs, entityIndex),
      evidenceRefs: toReportEvidenceRefs(t.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: t,
    });
  }
}

function addValidationRequirements(bag: Bag, items: MigrationValidationRequirement[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const v of items ?? []) {
    upsert(bag, {
      id: v.id,
      type: "Validation Requirement",
      capabilityIds: ["modernization"],
      title: v.description,
      category: v.type,
      preservationRequirementIds: v.preservationRequirementIds,
      rationale: [],
      relatedSystemIds: [],
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: [...toReportEvidenceRefs(v.evidenceRefs, entityIndex), ...toCodebaseReportRefs(v.codebaseEvidenceRefs)],
      prerequisiteIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: v,
    });
  }
}

function addModernizationDeltas(bag: Bag, items: ModernizationDelta[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const d of items ?? []) {
    upsert(bag, {
      id: d.id,
      type: "Modernization Delta",
      capabilityIds: ["modernization"],
      title: `${d.currentState} → ${d.targetState}`,
      category: d.category,
      relatedSystemIds: [d.systemId],
      rationale: [],
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: toReportEvidenceRefs(d.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: d,
    });
  }
}

function addTechnicalDebt(bag: Bag, items: TechnicalDebtItem[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const t of items ?? []) {
    upsert(bag, {
      id: t.id,
      type: "Technical Debt Finding",
      capabilityIds: ["modernization"],
      title: t.description,
      category: t.category,
      impact: t.impact,
      relatedSystemIds: [t.systemId],
      rationale: [],
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: [...toReportEvidenceRefs(t.evidenceRefs, entityIndex), ...toCodebaseReportRefs(t.codebaseEvidenceRefs)],
      prerequisiteIds: [],
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: t,
    });
  }
}

function addMigrationCandidates(bag: Bag, items: MigrationCandidate[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const c of items ?? []) {
    const options = c.strategyOptions.map((o) => `${o.strategy} (${o.status})`).join(", ");
    upsert(bag, {
      id: c.id,
      type: "Architecture Decision",
      capabilityIds: ["modernization"],
      title: `Modernization strategy for ${entityIndex[c.systemId]?.label ?? c.systemId}`,
      description: options.length > 0 ? `Strategy options: ${options}` : undefined,
      status: c.status,
      relatedSystemIds: [c.systemId],
      rationale: c.strategyOptions.map((o) => o.rationale).filter(Boolean),
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: toReportEvidenceRefs(c.evidenceRefs, entityIndex),
      prerequisiteIds: [],
      preservationRequirementIds: c.preservationRequirementIds,
      validationRequirementIds: [],
      riskIds: c.riskIds,
      informationGapIds: c.informationGapIds,
      raw: c,
    });
  }
}

function addWorkstreams(bag: Bag, items: ModernizationWorkstream[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const w of items ?? []) {
    upsert(bag, {
      id: w.id,
      type: "Workstream",
      capabilityIds: ["modernization"],
      title: w.name,
      description: w.objective,
      relatedSystemIds: w.systemIds,
      prerequisiteIds: w.prerequisiteIds,
      rationale: [],
      relatedRequirementIds: [],
      architectureRefs: [],
      evidenceRefs: toReportEvidenceRefs(w.evidenceRefs, entityIndex),
      preservationRequirementIds: [],
      validationRequirementIds: [],
      riskIds: [],
      informationGapIds: [],
      raw: w,
    });
  }
}

function addExportBundleItems(bag: Bag, bundles: ModernizationExportBundle[] | undefined, entityIndex: Record<string, EntityIndexEntry>): void {
  for (const bundle of bundles ?? []) {
    for (const step of bundle.recipe.steps) {
      upsert(bag, {
        id: step.id,
        type: "Implementation Step",
        capabilityIds: ["modernization"],
        title: step.description,
        category: step.category,
        explicitness: step.confidence,
        prerequisiteIds: step.prerequisiteIds,
        preservationRequirementIds: step.preservationRequirementIds,
        validationRequirementIds: step.validationRequirementIds,
        rationale: [],
        relatedSystemIds: [],
        relatedRequirementIds: [],
        architectureRefs: [],
        evidenceRefs: toCodebaseReportRefs(step.evidenceRefs),
        riskIds: [],
        informationGapIds: [],
        raw: step,
      });
    }

    const t = bundle.transformations;
    for (const d of t.dependencyChanges) {
      upsert(bag, {
        id: d.id,
        type: "Change Proposal",
        capabilityIds: ["modernization"],
        title: d.reason,
        category: "dependency",
        status: d.status,
        description: d.currentDependency ? `${d.currentDependency.group ?? ""}${d.currentDependency.group ? ":" : ""}${d.currentDependency.name}${d.currentDependency.version ? `@${d.currentDependency.version}` : ""}` : undefined,
        rationale: [],
        relatedSystemIds: [],
        relatedRequirementIds: [],
        architectureRefs: [],
        evidenceRefs: toCodebaseReportRefs(d.evidenceRefs),
        prerequisiteIds: [],
        preservationRequirementIds: [],
        validationRequirementIds: [],
        riskIds: [],
        informationGapIds: [],
        raw: d,
      });
    }
    for (const c of t.configurationChanges) {
      upsert(bag, {
        id: c.id,
        type: "Change Proposal",
        capabilityIds: ["modernization"],
        title: c.description,
        category: "configuration",
        status: c.status,
        rationale: [],
        relatedSystemIds: [],
        relatedRequirementIds: [],
        architectureRefs: [],
        evidenceRefs: toCodebaseReportRefs(c.evidenceRefs),
        prerequisiteIds: [],
        preservationRequirementIds: [],
        validationRequirementIds: [],
        riskIds: [],
        informationGapIds: [],
        raw: c,
      });
    }
    for (const b of t.buildChanges) {
      upsert(bag, {
        id: b.id,
        type: "Change Proposal",
        capabilityIds: ["modernization"],
        title: b.description,
        category: "build",
        status: b.status,
        rationale: [],
        relatedSystemIds: [],
        relatedRequirementIds: [],
        architectureRefs: [],
        evidenceRefs: toCodebaseReportRefs(b.evidenceRefs),
        prerequisiteIds: [],
        preservationRequirementIds: [],
        validationRequirementIds: [],
        riskIds: [],
        informationGapIds: [],
        raw: b,
      });
    }
    for (const s of t.sourceCandidates) {
      upsert(bag, {
        id: s.id,
        type: "Change Proposal",
        capabilityIds: ["modernization"],
        title: s.observedState,
        description: s.proposedDirection,
        category: "source",
        status: s.status,
        rationale: [],
        relatedSystemIds: [],
        relatedRequirementIds: [],
        architectureRefs: [],
        evidenceRefs: toCodebaseReportRefs(s.evidenceRefs),
        prerequisiteIds: [],
        preservationRequirementIds: [],
        validationRequirementIds: [],
        riskIds: [],
        informationGapIds: [],
        raw: s,
      });
    }
    for (const m of t.manualReviews) {
      upsert(bag, {
        id: m.id,
        type: "Manual Review",
        capabilityIds: ["modernization"],
        title: m.topic,
        description: m.description,
        rationale: [m.reason],
        relatedSystemIds: [],
        relatedRequirementIds: [],
        architectureRefs: [],
        evidenceRefs: toCodebaseReportRefs(m.evidenceRefs),
        prerequisiteIds: [],
        preservationRequirementIds: [],
        validationRequirementIds: [],
        riskIds: [],
        informationGapIds: [],
        raw: m,
      });
    }

    for (const area of bundle.testImpact.testAreas) {
      upsert(bag, {
        id: area.id,
        type: "Test Impact",
        capabilityIds: ["modernization"],
        title: area.description,
        category: area.category,
        description: area.expectedBehavior,
        rationale: [],
        relatedSystemIds: [],
        relatedRequirementIds: [],
        architectureRefs: toArchitectureReportRefs(area.affectedArchitectureRefs, entityIndex),
        evidenceRefs: toCodebaseReportRefs(area.evidenceRefs),
        prerequisiteIds: [],
        preservationRequirementIds: [],
        validationRequirementIds: [],
        riskIds: [],
        informationGapIds: [],
        raw: area,
      });
    }

    for (const gate of bundle.validationPlan.validationGates) {
      upsert(bag, {
        id: gate.id,
        type: "Validation Gate",
        capabilityIds: ["modernization"],
        title: gate.name,
        description: gate.description,
        status: gate.status,
        rationale: [],
        relatedSystemIds: [],
        relatedRequirementIds: [],
        architectureRefs: [],
        evidenceRefs: [],
        prerequisiteIds: [],
        preservationRequirementIds: [],
        validationRequirementIds: bundle.validationPlan.existingValidationRequirementIds,
        riskIds: [],
        informationGapIds: [],
        raw: gate,
      });
    }
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────

export function buildBacklog(blueprint: SolutionBlueprint, entityIndex: Record<string, EntityIndexEntry>): BacklogItem[] {
  const bag: Bag = new Map();

  addRequirements(bag, blueprint.requirements);
  addDecisions(bag, blueprint.planning?.decisions, entityIndex);
  addInformationGaps(bag, blueprint.informationGaps, []);
  addRisks(bag, blueprint.risks, [], entityIndex);

  addSecurityRequirements(bag, blueprint.security?.requirements, entityIndex);
  addSecurityGapReferences(bag, blueprint.security?.informationGaps);
  addRisks(bag, blueprint.security?.risks, ["security-governance"], entityIndex);

  const architecture = blueprint.observability?.architecture;
  addTelemetryRequirements(bag, architecture?.telemetryRequirements, entityIndex);
  addAlertRequirements(bag, architecture?.alertRequirements);
  addHealthRequirements(bag, architecture?.healthRequirements, entityIndex);
  addOperationalObjectives(bag, architecture?.operationalObjectives, entityIndex);
  addInformationGaps(bag, architecture?.informationGaps, ["observability"]);

  addIntegrationActions(bag, blueprint.integrations?.integrations, entityIndex);
  addWorkflowGaps(bag, blueprint.automation?.workflows);
  addAgentGaps(bag, blueprint.ai?.agents);
  addInformationGaps(bag, blueprint.architecture?.architecture.informationGaps, ["cloud"]);

  const modernization: ModernizationArchitecture | undefined = blueprint.modernization?.architecture;
  addTargetStateRequirements(bag, modernization?.targetStateRequirements, entityIndex);
  addValidationRequirements(bag, modernization?.validationRequirements, entityIndex);
  addModernizationDeltas(bag, modernization?.modernizationDeltas, entityIndex);
  addTechnicalDebt(bag, modernization?.technicalDebt, entityIndex);
  addMigrationCandidates(bag, modernization?.migrationCandidates, entityIndex);
  addWorkstreams(bag, modernization?.roadmap.workstreams, entityIndex);
  addRisks(bag, modernization?.risks, ["modernization"], entityIndex);
  addInformationGaps(bag, modernization?.informationGaps, ["modernization"]);
  addExportBundleItems(bag, blueprint.modernization?.exports, entityIndex);

  return Array.from(bag.values());
}

export type { BacklogItemType };
