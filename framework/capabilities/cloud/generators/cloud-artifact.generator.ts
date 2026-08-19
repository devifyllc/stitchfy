/**
 * Renders ImplementationArtifacts strictly from an already-built
 * CloudArchitecture — no new inference happens here, including the Mermaid
 * diagram (no cloud-provider icons, no invented VPC/subnet/load-balancer/
 * database/queue nodes — logical topology only).
 */

import { createArtifact } from "../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { CloudArchitecture, CloudEndpointReference, DeploymentUnit } from "../schemas/cloud.types.js";

const CAPABILITY_ID = "cloud";
const IMPLEMENTED_NOTE =
  "`implemented: true` on this capability means Stitchfy generated and validated a vendor-neutral cloud/deployment " +
  "architecture for the currently known solution. It does not mean infrastructure was provisioned, an application was " +
  "deployed, a cloud account or credentials exist, a region was selected (unless explicitly required), networking was " +
  "configured, a database was created, scalability was tested, resilience was verified, or the architecture is " +
  "production-ready.";

function describeEndpoint(e: CloudEndpointReference): string {
  return e.entityId ? `${e.kind}/${e.entityId} (${e.label})` : `${e.kind} (${e.label})`;
}

// ─── Cloud Architecture Markdown ───────────────────────────────────────────

function renderArchitectureMarkdown(arch: CloudArchitecture): string {
  const lines: string[] = [];

  lines.push("# Cloud Architecture", "");
  lines.push(`_Status: **${arch.status}**${arch.statusReasons.length > 0 ? ` (${arch.statusReasons.join("; ")})` : ""}_`, "");
  lines.push(`> ${IMPLEMENTED_NOTE}`, "");

  lines.push("## Hosting Model", "");
  lines.push(`- Model: **${arch.hostingModel}**`);
  lines.push(`- Provider: **${arch.providerRequirement.provider}** (${arch.providerRequirement.explicit ? "explicit" : "not specified"})`);
  if (arch.locationRequirement) {
    lines.push(`- Location: **${arch.locationRequirement.location ?? "unresolved"}** (${arch.locationRequirement.type}, ${arch.locationRequirement.explicit ? "explicit" : "not specified"})`);
  }
  lines.push("");

  lines.push("## Deployment Units", "");
  if (arch.deploymentUnits.length === 0) lines.push("None identified.");
  else
    for (const u of arch.deploymentUnits) {
      lines.push(`- **${u.name}** _(${u.kind}, ${u.responsibility}, workload: ${u.workloadProfile})_`);
    }
  lines.push("");

  lines.push("## Runtime Requirements", "");
  if (arch.runtimeRequirements.length === 0) lines.push("None identified.");
  else for (const r of arch.runtimeRequirements) lines.push(`- **${r.id}** _(${r.executionModel})_ — ${r.description}`);
  lines.push("");

  lines.push("## State Requirements", "");
  if (arch.stateRequirements.length === 0) lines.push("None identified.");
  else for (const s of arch.stateRequirements) lines.push(`- **${s.id}** _(${s.mode})_ — ${s.purpose}`);
  lines.push("");

  lines.push("## Persistence Requirements", "");
  if (arch.persistenceRequirements.length === 0) lines.push("None identified.");
  else for (const p of arch.persistenceRequirements) lines.push(`- **${p.id}** _(${p.durability}, technology: ${p.technology})_ — ${p.purpose}`);
  lines.push("");

  lines.push("## Connectivity", "");
  if (arch.connectivityRequirements.length === 0) lines.push("None identified.");
  else
    for (const c of arch.connectivityRequirements) {
      lines.push(`- ${describeEndpoint(c.source)} → ${describeEndpoint(c.target)} _(${c.direction}, exposure: ${c.exposure}, protocol: ${c.protocol})_`);
    }
  lines.push("");

  lines.push("## Environments", "");
  if (arch.environmentRequirements.length === 0) lines.push("None explicitly required.");
  else for (const e of arch.environmentRequirements) lines.push(`- **${e.name}** _(${e.purpose}, isolated: ${e.isolated})_`);
  lines.push("");

  lines.push("## Scalability", "");
  if (arch.scalabilityRequirements.length === 0) lines.push("None explicitly required.");
  else for (const s of arch.scalabilityRequirements) lines.push(`- **${s.dimension}**: ${s.requirement ?? "unresolved"}`);
  lines.push("");

  lines.push("## Resilience", "");
  if (arch.resilienceRequirements.length === 0) lines.push("None explicitly required.");
  else for (const r of arch.resilienceRequirements) lines.push(`- **${r.concern}** _(strategy: ${r.strategy})_ — ${r.description}`);
  lines.push("");

  lines.push("## Deployment Strategy", "");
  lines.push(arch.deploymentStrategy ? `**${arch.deploymentStrategy.strategy}** (${arch.deploymentStrategy.explicit ? "explicit" : "not specified"})` : "Not explicitly required.");
  lines.push("");

  lines.push("## Security Mapping", "");
  if (arch.securityMappings.length === 0) lines.push("None identified.");
  else for (const m of arch.securityMappings) lines.push(`- Security requirement \`${m.securityRequirementId}\` maps to deployment unit(s): ${m.deploymentUnitIds.join(", ") || "none"}, connectivity: ${m.connectivityRequirementIds.join(", ") || "none"}`);
  lines.push("");

  lines.push("## Observability Mapping", "");
  if (arch.observabilityMappings.length === 0) lines.push("None identified.");
  else for (const m of arch.observabilityMappings) lines.push(`- Deployment unit \`${m.deploymentUnitId}\` — telemetry: ${m.telemetryRequirementIds.join(", ") || "none"}, health: ${m.healthRequirementIds.join(", ") || "none"}, objectives: ${m.operationalObjectiveIds.join(", ") || "none"}`);
  lines.push("");

  lines.push("## Information Gaps", "");
  if (arch.informationGaps.length === 0) lines.push("None.");
  else for (const g of arch.informationGaps) lines.push(`- **${g.topic}**: ${g.question}`);
  lines.push("");

  const mermaid = buildMermaid(arch);
  if (mermaid) lines.push("```mermaid", mermaid, "```", "");

  return lines.join("\n");
}

function buildMermaid(arch: CloudArchitecture): string | undefined {
  if (arch.deploymentUnits.length === 0 && arch.connectivityRequirements.length === 0) return undefined;

  const nodeId = (label: string) => label.replace(/[^a-zA-Z0-9]/g, "_");
  const nodes = new Map<string, string>();
  const edges = new Set<string>();

  for (const u of arch.deploymentUnits) {
    nodes.set(nodeId(u.name), `${nodeId(u.name)}["${u.name}"]`);
  }
  for (const c of arch.connectivityRequirements) {
    const from = nodeId(c.source.label);
    const to = nodeId(c.target.label);
    nodes.set(from, `${from}["${c.source.label}"]`);
    nodes.set(to, `${to}["${c.target.label}"]`);
    edges.add(`${from} --> ${to}`);
  }

  return ["flowchart LR", ...[...nodes.values()].map((n) => `    ${n}`), ...[...edges].map((e) => `    ${e}`)].join("\n");
}

// ─── Deployment Topology ────────────────────────────────────────────────────

function renderTopologyMarkdown(arch: CloudArchitecture): string {
  const lines: string[] = ["# Deployment Topology", "", `> ${IMPLEMENTED_NOTE}`, ""];

  if (arch.deploymentUnits.length === 0) {
    lines.push("No solution-managed deployment units were explicitly identified for the currently known solution.", "");
    return lines.join("\n");
  }

  for (const u of arch.deploymentUnits) {
    lines.push(`## ${u.id} — ${u.name}`, "");
    lines.push(`- Kind: ${u.kind}`);
    lines.push(`- Responsibility: ${u.responsibility}`);
    lines.push(`- Workload profile: ${u.workloadProfile}`);
    lines.push(`- Runtime requirement(s): ${u.runtimeRequirementIds.join(", ") || "none"}`);
    lines.push(`- State requirement(s): ${u.stateRequirementIds.join(", ") || "none"}`);
    lines.push(`- Connectivity requirement(s): ${u.connectivityRequirementIds.join(", ") || "none"}`);
    lines.push(`- Evidence: ${u.evidenceRefs.length} reference(s)`);
    lines.push("");
  }

  const external = arch.connectivityRequirements.filter((c) => c.target.kind === "external-system" || c.source.kind === "external-system");
  lines.push("## External Systems Referenced", "");
  if (external.length === 0) lines.push("None.");
  else {
    const names = new Set(external.map((c) => (c.target.kind === "external-system" ? c.target.label : c.source.label)));
    for (const n of names) lines.push(`- ${n} _(external, not a deployment unit)_`);
  }
  lines.push("");

  return lines.join("\n");
}

function describeDeploymentUnitsForTopologyJson(units: DeploymentUnit[]) {
  return units.map((u) => ({ id: u.id, name: u.name, kind: u.kind, responsibility: u.responsibility, workloadProfile: u.workloadProfile }));
}

// ─── Runtime Requirements ───────────────────────────────────────────────────

function renderRuntimeMarkdown(arch: CloudArchitecture): string {
  const lines: string[] = ["# Runtime Requirements", "", `> ${IMPLEMENTED_NOTE}`, ""];

  if (arch.runtimeRequirements.length === 0) {
    lines.push("No runtime requirements were identified for the currently known solution.", "");
    return lines.join("\n");
  }

  for (const r of arch.runtimeRequirements) {
    lines.push(`## ${r.id}`, "");
    lines.push(`- Execution model: ${r.executionModel}`);
    lines.push(`- Description: ${r.description}`);
    lines.push(`- Applies to: ${r.appliesTo.map((a) => `${a.entityType}/${a.entityId}`).join(", ") || "unresolved"}`);
    lines.push(`- Evidence: ${r.evidenceRefs.length} reference(s)`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Artifact assembly ──────────────────────────────────────────────────────

export function buildCloudArtifacts(architecture: CloudArchitecture): ImplementationArtifact[] {
  return [
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/cloud/cloud-architecture.json",
      content: JSON.stringify(architecture, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/cloud/cloud-architecture.md",
      content: renderArchitectureMarkdown(architecture),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/cloud/deployment-topology.json",
      content: JSON.stringify(describeDeploymentUnitsForTopologyJson(architecture.deploymentUnits), null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/cloud/deployment-topology.md",
      content: renderTopologyMarkdown(architecture),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/cloud/runtime-requirements.json",
      content: JSON.stringify(architecture.runtimeRequirements, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/cloud/runtime-requirements.md",
      content: renderRuntimeMarkdown(architecture),
    }),
  ];
}
