/**
 * Renders ImplementationArtifacts (task item 42) strictly from an
 * already-built ObservabilityArchitecture — no new inference happens here,
 * including the Mermaid diagram (task item 45). Language stays restrained
 * throughout — never claims telemetry is collected, dashboards are
 * deployed, or an SLO is being met (task item 56).
 */

import { createArtifact } from "../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { ObservabilityArchitecture, ObservabilitySignal } from "../schemas/observability.types.js";

const CAPABILITY_ID = "observability";
const IMPLEMENTED_NOTE =
  "`implemented: true` on this capability means Stitchfy generated and validated a vendor-neutral observability and " +
  "operational architecture for the currently known solution. It does not mean telemetry is being collected, logging " +
  "exists, dashboards are deployed, alerts are active, tracing is installed, an SLO is being met, or production " +
  "operations are ready.";

function describeSource(source: ObservabilitySignal["source"]): string {
  return `${source.entityType}/${source.entityId}`;
}

// ─── Observability Architecture Markdown (task item 44) ───────────────────

function renderArchitectureMarkdown(arch: ObservabilityArchitecture): string {
  const lines: string[] = [];

  lines.push("# Observability Architecture", "");
  lines.push(`_Status: **${arch.status}**${arch.statusReasons.length > 0 ? ` (${arch.statusReasons.join("; ")})` : ""}_`, "");
  lines.push(`> ${IMPLEMENTED_NOTE}`, "");

  lines.push("## Scope", "");
  lines.push(
    `${arch.signals.length} signal(s), ${arch.metricRequirements.length} metric(s), ${arch.alertRequirements.length} alert requirement(s), ${arch.operationalObjectives.length} operational objective(s) identified from the generated solution.`,
    ""
  );

  lines.push("## Observable Components", "");
  const componentIds = new Set(arch.signals.map((s) => describeSource(s.source)));
  if (componentIds.size === 0) lines.push("None identified.");
  else for (const c of componentIds) lines.push(`- ${c}`);
  lines.push("");

  lines.push("## Workflow Visibility", "");
  const workflowSignals = arch.signals.filter((s) => s.source.entityType === "workflow" || s.source.entityType === "workflow-step");
  if (workflowSignals.length === 0) lines.push("None identified.");
  else for (const s of workflowSignals) lines.push(`- **${s.name}** _(${s.type}, ${s.provenance})_ — ${s.description}`);
  lines.push("");

  lines.push("## Integration Visibility", "");
  const integrationSignals = arch.signals.filter((s) => s.source.entityType === "integration");
  if (integrationSignals.length === 0) lines.push("None identified.");
  else for (const s of integrationSignals) lines.push(`- **${s.name}** _(${s.type}, ${s.provenance})_ — ${s.description}`);
  lines.push("");

  lines.push("## AI Agent Visibility", "");
  const aiSignals = arch.signals.filter((s) => s.source.entityType === "ai-agent" || s.source.entityType === "ai-tool");
  if (aiSignals.length === 0) lines.push("None identified.");
  else for (const s of aiSignals) lines.push(`- **${s.name}** _(${s.type}, ${s.provenance})_ — ${s.description}`);
  lines.push("");

  lines.push("## Logs and Events", "");
  if (arch.logRequirements.length === 0) lines.push("None identified.");
  else for (const l of arch.logRequirements) lines.push(`- **${l.event}** _(level: ${l.level})_ — prohibited: ${l.prohibitedData.join(", ") || "none"}`);
  lines.push("");

  lines.push("## Metrics", "");
  if (arch.metricRequirements.length === 0) lines.push("None identified.");
  else for (const m of arch.metricRequirements) lines.push(`- **${m.name}** _(${m.kind})_ — ${m.description}`);
  lines.push("");

  lines.push("## Correlation / Tracing", "");
  if (arch.correlationRequirements.length === 0) lines.push("None identified.");
  else for (const c of arch.correlationRequirements) lines.push(`- ${c.description} (path: ${c.architecturePath.map(describeSource).join(" → ")})`);
  lines.push("");

  lines.push("## Auditability", "");
  if (arch.auditMappings.length === 0) lines.push("None identified.");
  else for (const m of arch.auditMappings) lines.push(`- Audit requirement \`${m.auditRequirementId}\` is satisfied by signal(s): ${m.signalIds.join(", ")}`);
  lines.push("");

  lines.push("## Health Requirements", "");
  if (arch.healthRequirements.length === 0) lines.push("None identified.");
  else for (const h of arch.healthRequirements) lines.push(`- **${describeSource(h.target)}** _(${h.type})_ — ${h.description}`);
  lines.push("");

  lines.push("## Alert Requirements", "");
  if (arch.alertRequirements.length === 0) lines.push("None identified.");
  else
    for (const a of arch.alertRequirements) {
      lines.push(`- **${a.name}** _(${a.severity}, ${a.provenance})_ — ${a.condition}; threshold: ${a.threshold ?? "unresolved"}; destination: ${a.destination ?? "unresolved"}`);
    }
  lines.push("");

  lines.push("## Operational Objectives", "");
  if (arch.operationalObjectives.length === 0) lines.push("None stated.");
  else
    for (const o of arch.operationalObjectives) {
      lines.push(`- **${o.name}** _(${o.objectiveType}, ${o.explicit ? "explicit" : "derived"})_ — target: ${o.targetValue ?? "none stated"}`);
    }
  lines.push("");

  lines.push("## Dashboards / Operational Views", "");
  if (arch.dashboardSpecifications.length === 0) lines.push("None identified.");
  else for (const d of arch.dashboardSpecifications) lines.push(`- **${d.name}** — ${d.purpose} (${d.signalIds.length} signal(s))`);
  lines.push("");

  lines.push("## Data Protection in Telemetry", "");
  const securityTelemetry = arch.telemetryRequirements.filter((r) => r.purpose === "security");
  if (securityTelemetry.length === 0 && arch.logRequirements.every((l) => l.prohibitedData.length === 0)) lines.push("None identified.");
  else {
    for (const r of securityTelemetry) lines.push(`- ${r.description}`);
    for (const l of arch.logRequirements.filter((l) => l.prohibitedData.length > 0)) lines.push(`- Prohibited from telemetry for ${describeSource(l.source)}: ${l.prohibitedData.join(", ")}`);
  }
  lines.push("");

  lines.push("## Information Gaps", "");
  if (arch.informationGaps.length === 0) lines.push("None.");
  else for (const g of arch.informationGaps) lines.push(`- **${g.topic}**: ${g.question}`);
  lines.push("");

  lines.push("## Traceability", "");
  lines.push(`Signals: ${arch.signals.length}, Metrics: ${arch.metricRequirements.length}, Evidence references: ${arch.evidenceRefs.length}`, "");

  const mermaidLines = buildMermaid(arch);
  if (mermaidLines) {
    lines.push("```mermaid", mermaidLines, "```", "");
  }

  return lines.join("\n");
}

function buildMermaid(arch: ObservabilityArchitecture): string | undefined {
  const nodes = new Map<string, string>();
  const edges = new Set<string>();

  for (const signal of arch.signals) {
    const nodeId = signal.source.entityId.replace(/[^a-zA-Z0-9]/g, "_");
    nodes.set(nodeId, `${nodeId}["${signal.source.entityType}/${signal.source.entityId}"]`);
  }
  for (const c of arch.correlationRequirements) {
    for (let i = 0; i < c.architecturePath.length - 1; i++) {
      const fromId = c.architecturePath[i].entityId.replace(/[^a-zA-Z0-9]/g, "_");
      const toId = c.architecturePath[i + 1].entityId.replace(/[^a-zA-Z0-9]/g, "_");
      nodes.set(fromId, `${fromId}["${c.architecturePath[i].entityType}/${c.architecturePath[i].entityId}"]`);
      nodes.set(toId, `${toId}["${c.architecturePath[i + 1].entityType}/${c.architecturePath[i + 1].entityId}"]`);
      edges.add(`${fromId} --> ${toId}`);
    }
  }

  if (nodes.size === 0) return undefined;
  return ["flowchart LR", ...[...nodes.values()].map((n) => `    ${n}`), ...[...edges].map((e) => `    ${e}`)].join("\n");
}

// ─── Telemetry Catalog (task item 43) ──────────────────────────────────────

function renderTelemetryCatalogMarkdown(arch: ObservabilityArchitecture): string {
  const lines: string[] = ["# Telemetry Catalog", "", `> ${IMPLEMENTED_NOTE}`, ""];

  if (arch.signals.length === 0) {
    lines.push("No telemetry signals identified for the currently known solution.", "");
    return lines.join("\n");
  }

  for (const signal of arch.signals) {
    lines.push(`## ${signal.id} — ${signal.name}`, "");
    lines.push("Type:", signal.type, "");
    lines.push("Source:", describeSource(signal.source), "");
    lines.push("Provenance:", signal.provenance, "");
    lines.push("Sensitivity:", signal.sensitivity, "");
    lines.push("Required attributes:");
    for (const a of signal.attributes) lines.push(`- ${a.name}`);
    lines.push("");

    const relatedLogRequirement = arch.logRequirements.find((l) => l.source.entityType === signal.source.entityType && l.source.entityId === signal.source.entityId);
    lines.push("Prohibited data:");
    if (relatedLogRequirement && relatedLogRequirement.prohibitedData.length > 0) {
      for (const p of relatedLogRequirement.prohibitedData) lines.push(`- ${p}`);
    } else {
      lines.push("- none identified");
    }
    lines.push("");

    lines.push("Evidence:", `${signal.evidenceRefs.length} reference(s)`, "");
  }

  return lines.join("\n");
}

// ─── Operational Objectives document (task item 42) ────────────────────────

function renderOperationalObjectivesMarkdown(arch: ObservabilityArchitecture): string {
  const lines: string[] = ["# Operational Objectives", "", `> ${IMPLEMENTED_NOTE}`, ""];

  if (arch.operationalObjectives.length === 0) {
    lines.push("No operational objectives were explicitly stated for the currently known solution — none were invented.", "");
    return lines.join("\n");
  }

  for (const o of arch.operationalObjectives) {
    lines.push(`## ${o.id} — ${o.name}`, "");
    lines.push(`- Type: ${o.objectiveType}`);
    lines.push(`- Target: ${o.targetValue ?? "unresolved"}`);
    lines.push(`- Provenance: ${o.explicit ? "explicit" : "derived"}`);
    lines.push(`- Applies to: ${o.target.map(describeSource).join(", ") || "unresolved"}`);
    lines.push(`- Evidence: ${o.evidenceRefs.length} reference(s)`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Artifact assembly ──────────────────────────────────────────────────────

export function buildObservabilityArtifacts(architecture: ObservabilityArchitecture): ImplementationArtifact[] {
  return [
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/observability/observability-architecture.json",
      content: JSON.stringify(architecture, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/observability/observability-architecture.md",
      content: renderArchitectureMarkdown(architecture),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/observability/telemetry-catalog.json",
      content: JSON.stringify(architecture.signals, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/observability/telemetry-catalog.md",
      content: renderTelemetryCatalogMarkdown(architecture),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/observability/operational-objectives.json",
      content: JSON.stringify(architecture.operationalObjectives, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/observability/operational-objectives.md",
      content: renderOperationalObjectivesMarkdown(architecture),
    }),
  ];
}
