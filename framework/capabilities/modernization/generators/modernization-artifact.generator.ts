/**
 * Renders ImplementationArtifacts strictly from an already-built
 * ModernizationArchitecture — no new inference here, including the Mermaid
 * dependency diagram (only real SystemDependency objects, no invented
 * nodes).
 */

import { createArtifact } from "../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { ModernizationArchitecture } from "../schemas/modernization.types.js";

const CAPABILITY_ID = "modernization";
const IMPLEMENTED_NOTE =
  "`implemented: true` on this capability means Stitchfy generated and validated a legacy-modernization assessment and " +
  "migration-strategy architecture from currently known evidence. It does not mean application code was analyzed, code " +
  "was migrated, dependencies were upgraded, databases were converted, tests passed, production behavior was preserved, " +
  "a target system was deployed, or migration risk was eliminated.";

// ─── Modernization Architecture Markdown ───────────────────────────────────

function renderArchitectureMarkdown(arch: ModernizationArchitecture): string {
  const lines: string[] = [];

  lines.push("# Legacy Modernization Architecture", "");
  lines.push(`_Status: **${arch.status}**${arch.statusReasons.length > 0 ? ` (${arch.statusReasons.join("; ")})` : ""}_`, "");
  lines.push(`> ${IMPLEMENTED_NOTE}`, "");

  lines.push("## Scope", "");
  lines.push(`${arch.profiles.length} system(s) in scope, ${arch.migrationCandidates.length} migration candidate(s) assessed.`, "");

  lines.push("## Systems in Scope", "");
  if (arch.profiles.length === 0) lines.push("None identified.");
  else for (const p of arch.profiles) lines.push(`- **${p.systemId}** _(${p.status}, lifecycle: ${p.lifecycleStatus})_ — ${p.role || "no role stated"}`);
  lines.push("");

  lines.push("## Modernization Drivers", "");
  const drivers = new Set(arch.profiles.flatMap((p) => p.modernizationDrivers));
  if (drivers.size === 0) lines.push("None stated.");
  else for (const d of drivers) lines.push(`- ${d}`);
  lines.push("");

  lines.push("## System Profiles", "");
  if (arch.profiles.length === 0) lines.push("None identified.");
  else
    for (const p of arch.profiles) {
      lines.push(`- **${p.id}** (system \`${p.systemId}\`) — technical debt: ${p.technicalDebtIds.length}, dependencies: ${p.dependencyIds.length}, preservation: ${p.preservationRequirementIds.length}`);
    }
  lines.push("");

  lines.push("## Current-State Dependencies", "");
  if (arch.dependencies.length === 0) lines.push("None identified.");
  else for (const d of arch.dependencies) lines.push(`- \`${d.sourceSystemId}\` → \`${d.targetSystemId}\` _(${d.type}, ${d.direction})_ — ${d.description}`);
  lines.push("");

  lines.push("## Technical Debt", "");
  if (arch.technicalDebt.length === 0) lines.push("None identified.");
  else for (const t of arch.technicalDebt) lines.push(`- **${t.id}** _(${t.category}, impact: ${t.impact})_ — ${t.description}`);
  lines.push("");

  lines.push("## Preservation Requirements", "");
  if (arch.preservationRequirements.length === 0) lines.push("None identified.");
  else for (const p of arch.preservationRequirements) lines.push(`- **${p.id}** _(${p.type})_ — ${p.description}`);
  lines.push("");

  lines.push("## Modernization Seams", "");
  if (arch.seams.length === 0) lines.push("None identified.");
  else for (const s of arch.seams) lines.push(`- **${s.id}** _(${s.type})_ — ${s.description}`);
  lines.push("");

  lines.push("## Migration Candidates", "");
  if (arch.migrationCandidates.length === 0) lines.push("None identified.");
  else
    for (const c of arch.migrationCandidates) {
      lines.push(`- **${c.id}** (system \`${c.systemId}\`) — status: ${c.status}, approach: ${c.approach}`);
      for (const o of c.strategyOptions) lines.push(`  - strategy: ${o.strategy} (${o.status}) — ${o.rationale}`);
    }
  lines.push("");

  lines.push("## Strategy Options", "");
  const allOptions = arch.migrationCandidates.flatMap((c) => c.strategyOptions.map((o) => ({ candidateId: c.id, ...o })));
  if (allOptions.length === 0) lines.push("None identified.");
  else for (const o of allOptions) lines.push(`- \`${o.candidateId}\`: **${o.strategy}** _(${o.status})_`);
  lines.push("");

  lines.push("## Target-State Requirements", "");
  if (arch.targetStateRequirements.length === 0) lines.push("None identified.");
  else for (const t of arch.targetStateRequirements) lines.push(`- **${t.id}** _(${t.category}, ${t.explicit ? "explicit" : "derived"})_ — ${t.description}`);
  lines.push("");

  lines.push("## Migration Risks", "");
  if (arch.risks.length === 0) lines.push("None identified.");
  else for (const r of arch.risks) lines.push(`- **${r.id}** _(${r.category}, likelihood: ${r.likelihood}, impact: ${r.impact})_ — ${r.description}`);
  lines.push("");

  lines.push("## Validation Requirements", "");
  if (arch.validationRequirements.length === 0) lines.push("None identified.");
  else for (const v of arch.validationRequirements) lines.push(`- **${v.id}** _(${v.type})_ — ${v.description}`);
  lines.push("");

  lines.push("## Information Gaps", "");
  if (arch.informationGaps.length === 0) lines.push("None.");
  else for (const g of arch.informationGaps) lines.push(`- **${g.topic}**: ${g.question}`);
  lines.push("");

  lines.push("## Traceability", "");
  lines.push(`Profiles: ${arch.profiles.length}, Dependencies: ${arch.dependencies.length}, Candidates: ${arch.migrationCandidates.length}, Evidence references: ${arch.evidenceRefs.length}`, "");

  return lines.join("\n");
}

// ─── System Dependency Map ─────────────────────────────────────────────────

function renderDependencyMapMarkdown(arch: ModernizationArchitecture): string {
  const lines: string[] = ["# System Dependency Map", "", `> ${IMPLEMENTED_NOTE}`, ""];

  lines.push("## Systems", "");
  if (arch.profiles.length === 0) lines.push("None identified.");
  else for (const p of arch.profiles) lines.push(`- \`${p.systemId}\``);
  lines.push("");

  lines.push("## Dependencies", "");
  if (arch.dependencies.length === 0) lines.push("None identified.");
  else for (const d of arch.dependencies) lines.push(`- \`${d.sourceSystemId}\` → \`${d.targetSystemId}\` _(${d.type}, ${d.direction})_`);
  lines.push("");

  lines.push("## External Boundaries", "");
  const external = arch.dependencies.filter((d) => !arch.profiles.some((p) => p.systemId === d.targetSystemId));
  if (external.length === 0) lines.push("None.");
  else for (const d of external) lines.push(`- \`${d.targetSystemId}\` _(external to modernization scope)_`);
  lines.push("");

  lines.push("## Integration Contracts", "");
  const withIntegration = arch.dependencies.filter((d) => d.integrationId);
  if (withIntegration.length === 0) lines.push("None identified.");
  else for (const d of withIntegration) lines.push(`- \`${d.integrationId}\` — ${d.description}`);
  lines.push("");

  lines.push("## Data Dependencies", "");
  const dataDeps = arch.dependencies.filter((d) => d.type === "database" || d.type === "shared-data");
  if (dataDeps.length === 0) lines.push("None identified.");
  else for (const d of dataDeps) lines.push(`- \`${d.sourceSystemId}\` → \`${d.targetSystemId}\``);
  lines.push("");

  lines.push("## Unknown Dependencies", "");
  const unknownDeps = arch.dependencies.filter((d) => d.direction === "unknown" || d.type === "unknown");
  if (unknownDeps.length === 0) lines.push("None.");
  else for (const d of unknownDeps) lines.push(`- \`${d.sourceSystemId}\` → \`${d.targetSystemId}\``);
  lines.push("");

  const mermaid = buildMermaid(arch);
  if (mermaid) lines.push("## Mermaid Diagram", "", "```mermaid", mermaid, "```", "");

  return lines.join("\n");
}

function buildMermaid(arch: ModernizationArchitecture): string | undefined {
  if (arch.dependencies.length === 0) return undefined;
  const nodeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, "_");
  const nodes = new Map<string, string>();
  const edges = new Set<string>();

  for (const d of arch.dependencies) {
    nodes.set(nodeId(d.sourceSystemId), `${nodeId(d.sourceSystemId)}["${d.sourceSystemId}"]`);
    nodes.set(nodeId(d.targetSystemId), `${nodeId(d.targetSystemId)}["${d.targetSystemId}"]`);
    edges.add(`${nodeId(d.sourceSystemId)} --> ${nodeId(d.targetSystemId)}`);
  }

  return ["flowchart LR", ...[...nodes.values()].map((n) => `    ${n}`), ...[...edges].map((e) => `    ${e}`)].join("\n");
}

// ─── Migration Strategy ─────────────────────────────────────────────────────

function renderStrategyMarkdown(arch: ModernizationArchitecture): string {
  const lines: string[] = ["# Migration Strategy", "", `> ${IMPLEMENTED_NOTE}`, ""];

  lines.push("## Candidate Systems", "");
  if (arch.migrationCandidates.length === 0) lines.push("None identified.");
  else for (const c of arch.migrationCandidates) lines.push(`- \`${c.systemId}\` — ${c.status}`);
  lines.push("");

  lines.push("## Explicit Strategies", "");
  const explicit = arch.migrationCandidates.flatMap((c) => c.strategyOptions.filter((o) => o.status === "explicit").map((o) => ({ systemId: c.systemId, ...o })));
  if (explicit.length === 0) lines.push("None identified.");
  else for (const o of explicit) lines.push(`- \`${o.systemId}\`: **${o.strategy}** — ${o.rationale}`);
  lines.push("");

  lines.push("## Candidate Strategies", "");
  const candidateOptions = arch.migrationCandidates.flatMap((c) => c.strategyOptions.filter((o) => o.status === "needs-review" || o.status === "candidate").map((o) => ({ systemId: c.systemId, ...o })));
  if (candidateOptions.length === 0) lines.push("None identified.");
  else for (const o of candidateOptions) lines.push(`- \`${o.systemId}\`: **${o.strategy}** _(${o.status})_ — ${o.rationale}`);
  lines.push("");

  lines.push("## Retain Decisions", "");
  const retained = arch.migrationCandidates.filter((c) => c.status === "retain");
  if (retained.length === 0) lines.push("None.");
  else for (const c of retained) lines.push(`- \`${c.systemId}\` will be retained.`);
  lines.push("");

  lines.push("## Preservation Obligations", "");
  if (arch.preservationRequirements.length === 0) lines.push("None identified.");
  else for (const p of arch.preservationRequirements) lines.push(`- \`${p.systemId}\` (${p.type}): ${p.description}`);
  lines.push("");

  lines.push("## Coexistence Requirements", "");
  const coexisting = arch.migrationCandidates.filter((c) => c.approach === "coexistence");
  if (coexisting.length === 0) lines.push("None.");
  else for (const c of coexisting) lines.push(`- \`${c.systemId}\` requires current/modernized versions to coexist during validation.`);
  lines.push("");

  lines.push("## Constraints", "");
  if (arch.migrationConstraints.length === 0) lines.push("None identified.");
  else for (const c of arch.migrationConstraints) lines.push(`- **${c.id}** _(${c.category})_ — ${c.description}`);
  lines.push("");

  lines.push("## Risks", "");
  if (arch.risks.length === 0) lines.push("None identified.");
  else for (const r of arch.risks) lines.push(`- ${r.description}`);
  lines.push("");

  lines.push("## Open Strategy Decisions", "");
  const open = arch.migrationCandidates.filter((c) => c.strategyOptions.some((o) => o.status === "needs-review"));
  if (open.length === 0) lines.push("None.");
  else for (const c of open) lines.push(`- \`${c.systemId}\` has no evidenced strategy yet.`);
  lines.push("");

  return lines.join("\n");
}

// ─── Migration Roadmap ──────────────────────────────────────────────────────

function renderRoadmapMarkdown(arch: ModernizationArchitecture): string {
  const lines: string[] = ["# Modernization Roadmap", "", `> ${IMPLEMENTED_NOTE}`, ""];

  lines.push("## Scope", "");
  lines.push(`_Status: **${arch.roadmap.status}**_`, "");
  lines.push(`${arch.roadmap.workstreams.length} workstream(s), ${arch.roadmap.candidateIds.length} candidate(s) in scope.`, "");

  lines.push("## Workstreams", "");
  if (arch.roadmap.workstreams.length === 0) lines.push("None identified.");
  else for (const w of arch.roadmap.workstreams) lines.push(`- **${w.id}** — ${w.name}: ${w.objective}`);
  lines.push("");

  lines.push("## Known Prerequisites", "");
  const withPrereqs = arch.roadmap.workstreams.filter((w) => w.prerequisiteIds.length > 0);
  if (withPrereqs.length === 0) lines.push("None — no explicit sequencing evidence exists; sequencing stays unresolved rather than assumed from dependency direction.");
  else for (const w of withPrereqs) lines.push(`- **${w.id}** depends on: ${w.prerequisiteIds.join(", ")}`);
  lines.push("");

  lines.push("## Dependency Constraints", "");
  if (arch.roadmap.dependencies.length === 0) lines.push("None identified.");
  else for (const d of arch.roadmap.dependencies) lines.push(`- ${d.fromWorkstreamId} → ${d.toWorkstreamId}: ${d.description}`);
  lines.push("");

  lines.push("## Validation Gates", "");
  if (arch.roadmap.validationRequirementIds.length === 0) lines.push("None identified.");
  else for (const id of arch.roadmap.validationRequirementIds) lines.push(`- \`${id}\``);
  lines.push("");

  lines.push("## Coexistence / Transition Requirements", "");
  const coexisting = arch.migrationCandidates.filter((c) => c.approach === "coexistence");
  if (coexisting.length === 0) lines.push("None.");
  else for (const c of coexisting) lines.push(`- \`${c.systemId}\` requires a coexistence window.`);
  lines.push("");

  lines.push("## Unresolved Sequencing Decisions", "");
  lines.push(arch.roadmap.workstreams.length > 1 ? "Migration order across workstreams is not determined by dependency direction alone and remains unresolved." : "Not applicable.", "");

  lines.push("## Open Questions", "");
  if (arch.informationGaps.length === 0) lines.push("None.");
  else for (const g of arch.informationGaps) lines.push(`- ${g.question}`);
  lines.push("");

  return lines.join("\n");
}

// ─── Artifact assembly ──────────────────────────────────────────────────────

export function buildModernizationArtifacts(architecture: ModernizationArchitecture): ImplementationArtifact[] {
  return [
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: "artifacts/modernization/modernization-architecture.json", content: JSON.stringify(architecture, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: "artifacts/modernization/modernization-architecture.md", content: renderArchitectureMarkdown(architecture) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: "artifacts/modernization/system-dependency-map.json", content: JSON.stringify(architecture.dependencies, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: "artifacts/modernization/system-dependency-map.md", content: renderDependencyMapMarkdown(architecture) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: "artifacts/modernization/migration-strategy.json", content: JSON.stringify(architecture.migrationCandidates, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: "artifacts/modernization/migration-strategy.md", content: renderStrategyMarkdown(architecture) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "config", path: "artifacts/modernization/migration-roadmap.json", content: JSON.stringify(architecture.roadmap, null, 2) }),
    createArtifact({ capabilityId: CAPABILITY_ID, type: "document", path: "artifacts/modernization/migration-roadmap.md", content: renderRoadmapMarkdown(architecture) }),
  ];
}
