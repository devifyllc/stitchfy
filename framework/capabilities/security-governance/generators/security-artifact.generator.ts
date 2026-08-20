/**
 * Renders the 6 ImplementationArtifacts (task item 28) strictly from the
 * already-built SecurityArchitecture/GovernancePlan — no new inference
 * happens here. Language stays restrained throughout: "security
 * requirement"/"consideration"/"requires review", never "secure"/
 * "compliant"/"certified" (task item 41).
 */

import { createArtifact } from "../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { WorkflowDefinition } from "../../workflow-automation/schemas/workflow-automation.types.js";
import type { SecurityArchitecture, GovernancePlan } from "../schemas/security-governance.types.js";

const CAPABILITY_ID = "security-governance";
const IMPLEMENTED_NOTE =
  "`implemented: true` on this capability means Stitchfy generated and validated a security/governance architecture " +
  "for the currently known solution. It does not mean the resulting system is secure, compliant, certified, " +
  "penetration-tested, or production-ready.";

function buildSystemLookup(discovery: DiscoveryResult, workflows: WorkflowDefinition[] = []): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const s of discovery.systems) lookup.set(s.id, s.name);
  for (const p of discovery.processes) lookup.set(p.id, p.name);
  for (const r of discovery.requirements) lookup.set(r.id, r.description);
  for (const d of discovery.dataEntities) lookup.set(d.id, d.name);
  for (const w of workflows) lookup.set(w.id, w.name);
  return lookup;
}

function describeId(id: string, lookup: Map<string, string>): string {
  return `${lookup.get(id) ?? id} (${id})`;
}

// ─── Security Architecture Markdown (task item 29) ─────────────────────────

function renderSecurityArchitectureMarkdown(security: SecurityArchitecture, discovery: DiscoveryResult, workflows: WorkflowDefinition[]): string {
  const lookup = buildSystemLookup(discovery, workflows);
  const lines: string[] = [];

  lines.push("# Security Architecture");
  lines.push("");
  lines.push(`_Status: **${security.status}**${security.statusReasons.length > 0 ? ` (${security.statusReasons.join("; ")})` : ""}_`);
  lines.push("");
  lines.push(`> ${IMPLEMENTED_NOTE}`);
  lines.push("");

  lines.push("## Scope");
  lines.push("");
  lines.push(
    `${security.trustBoundaries.length} trust boundary(ies), ${security.requirements.length} security requirement(s), ` +
      `${security.dataProtection.length} data protection requirement(s), ${security.risks.length} risk(s) identified from the generated solution.`
  );
  lines.push("");

  lines.push("## Systems and Trust Boundaries");
  lines.push("");
  if (security.trustBoundaries.length === 0) lines.push("None identified.");
  else {
    for (const b of security.trustBoundaries) {
      const source = b.sourceSystemId ? describeId(b.sourceSystemId, lookup) : "unknown source";
      const target = b.targetSystemId ? describeId(b.targetSystemId, lookup) : "unknown target";
      lines.push(`- **${source} → ${target}** — classification: ${b.classification}`);
    }
  }
  lines.push("");

  lines.push("## Identity and Authentication");
  lines.push("");
  const identity = security.identityAccess.filter((r) => r.kind === "identity");
  if (identity.length === 0) lines.push("No explicit identity requirements identified.");
  else for (const r of identity) lines.push(`- ${r.description}`);
  lines.push("");

  lines.push("## Authorization");
  lines.push("");
  const authorization = security.identityAccess.filter((r) => r.kind === "authorization");
  if (authorization.length === 0) lines.push("No explicit authorization requirements identified.");
  else for (const r of authorization) lines.push(`- ${r.description}`);
  lines.push("");

  lines.push("## Data Protection");
  lines.push("");
  if (security.dataProtection.length === 0) lines.push("None identified.");
  else {
    for (const d of security.dataProtection) {
      lines.push(
        `- Classification: **${d.classification}** — encryption in transit: ${d.encryptionInTransit}, encryption at rest: ${d.encryptionAtRest}` +
          (d.retentionRequirement ? `, retention: ${d.retentionRequirement}` : "")
      );
    }
  }
  lines.push("");

  lines.push("## Integration Security");
  lines.push("");
  if (security.integrationSecurity.length === 0) lines.push("None identified.");
  else {
    for (const rollup of security.integrationSecurity) {
      const related = security.requirements.filter((r) => rollup.relatedSecurityRequirementIds.includes(r.id));
      lines.push(`- **${describeId(rollup.integrationId, lookup)}**`);
      for (const req of related) lines.push(`  - ${req.description}`);
    }
  }
  lines.push("");

  lines.push("## Secrets");
  lines.push("");
  const secretsRequirements = security.requirements.filter((r) => r.domain === "secrets");
  if (secretsRequirements.length === 0) lines.push("None identified.");
  else for (const r of secretsRequirements) lines.push(`- ${r.description}`);
  lines.push("");

  lines.push("## Privacy Considerations");
  lines.push("");
  const privacyRisks = security.risks.filter((r) => r.category === "privacy");
  if (privacyRisks.length === 0) lines.push("None identified.");
  else for (const r of privacyRisks) lines.push(`- ${r.description}`);
  lines.push("");

  lines.push("## Auditability");
  lines.push("");
  if (security.auditRequirements.length === 0) lines.push("None identified.");
  else for (const a of security.auditRequirements) lines.push(`- ${a.description}`);
  lines.push("");

  lines.push("## Human Oversight");
  lines.push("");
  const oversight = security.requirements.filter((r) => r.domain === "human-oversight");
  if (oversight.length === 0) lines.push("None identified.");
  else for (const r of oversight) lines.push(`- ${r.description}`);
  lines.push("");

  lines.push("## Open Security Questions");
  lines.push("");
  if (security.informationGaps.length === 0) lines.push("None.");
  else for (const g of security.informationGaps) lines.push(`- **${g.topic}**: ${g.question}${g.isNew ? "" : " _(already tracked upstream)_"}`);
  lines.push("");

  lines.push("## Traceability");
  lines.push("");
  lines.push(`Security requirements: ${security.requirements.length}, Trust boundaries: ${security.trustBoundaries.length}, Risks: ${security.risks.length}, Evidence references: ${security.evidenceRefs.length}`);
  lines.push("");

  return lines.join("\n");
}

// ─── Risk Register Markdown (task item 30) ─────────────────────────────────

function renderRiskRegisterMarkdown(security: SecurityArchitecture): string {
  const lines: string[] = ["# Risk Register", ""];

  if (security.risks.length === 0) {
    lines.push("No risks identified from the currently known solution.");
    lines.push("");
    return lines.join("\n");
  }

  for (const risk of security.risks) {
    lines.push(`## ${risk.id} — ${risk.description}`);
    lines.push("");
    lines.push(`Category:\n${risk.category}`);
    lines.push("");
    lines.push(`Likelihood:\n${risk.likelihood}`);
    lines.push("");
    lines.push(`Impact:\n${risk.impact}`);
    lines.push("");
    lines.push(`Treatment:\n${risk.treatment}`);
    lines.push("");
    lines.push(`Status:\n${risk.status}`);
    lines.push("");
    lines.push("Evidence:");
    for (const ref of risk.evidenceRefs) lines.push(`${ref.entityId}`);
    lines.push("");
    lines.push("Related architecture:");
    for (const ref of risk.relatedArchitectureRefs) lines.push(`${ref.entityType}/${ref.entityId}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Governance Plan Markdown (task item 31) ───────────────────────────────

function renderGovernancePlanMarkdown(governance: GovernancePlan, discovery: DiscoveryResult, workflows: WorkflowDefinition[]): string {
  const lookup = buildSystemLookup(discovery, workflows);
  const lines: string[] = [];

  lines.push("# Governance Plan");
  lines.push("");
  lines.push(`_Status: **${governance.status}**_`);
  lines.push("");
  lines.push(`> ${IMPLEMENTED_NOTE}`);
  lines.push("");

  lines.push("## Human Approval Controls");
  lines.push("");
  if (governance.humanOversight.length === 0) lines.push("None identified.");
  else for (const c of governance.humanOversight) lines.push(`- ${c.description}${c.workflowId ? ` — ${describeId(c.workflowId, lookup)}` : ""}`);
  lines.push("");

  lines.push("## Decision Controls");
  lines.push("");
  if (governance.decisionControls.length === 0) lines.push("None identified.");
  else for (const c of governance.decisionControls) lines.push(`- ${c.description}`);
  lines.push("");

  lines.push("## Audit Requirements");
  lines.push("");
  if (governance.auditRequirements.length === 0) lines.push("None identified.");
  else for (const a of governance.auditRequirements) lines.push(`- ${a.description}`);
  lines.push("");

  lines.push("## Privacy Considerations");
  lines.push("");
  const privacy = governance.complianceConsiderations.filter((c) => !c.framework);
  if (privacy.length === 0) lines.push("None identified.");
  else for (const c of privacy) lines.push(`- ${c.rationale}`);
  lines.push("");

  lines.push("## Compliance Considerations");
  lines.push("");
  const explicit = governance.complianceConsiderations.filter((c) => c.status === "explicit");
  if (explicit.length === 0) lines.push("None explicitly stated.");
  else for (const c of explicit) lines.push(`- **${c.framework}** (explicit) — ${c.rationale}`);
  lines.push("");

  lines.push("## Unresolved Governance Questions");
  lines.push("");
  if (governance.informationGaps.length === 0) lines.push("None.");
  else for (const gapId of governance.informationGaps) lines.push(`- ${gapId}`);
  lines.push("");

  lines.push("## Policies");
  lines.push("");
  if (governance.policies.length === 0) lines.push("None derived from an explicit business rule.");
  else for (const p of governance.policies) lines.push(`- ${p.description}`);
  lines.push("");

  return lines.join("\n");
}

// ─── Artifact assembly ──────────────────────────────────────────────────────

export function buildSecurityGovernanceArtifacts(
  security: SecurityArchitecture,
  governance: GovernancePlan,
  discovery: DiscoveryResult,
  workflows: WorkflowDefinition[] = []
): ImplementationArtifact[] {
  return [
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/security-governance/security-architecture.json",
      content: JSON.stringify(security, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/security-governance/security-architecture.md",
      content: renderSecurityArchitectureMarkdown(security, discovery, workflows),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/security-governance/risk-register.json",
      content: JSON.stringify(security.risks, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/security-governance/risk-register.md",
      content: renderRiskRegisterMarkdown(security),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: "artifacts/security-governance/governance-plan.json",
      content: JSON.stringify(governance, null, 2),
    }),
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: "artifacts/security-governance/governance-plan.md",
      content: renderGovernancePlanMarkdown(governance, discovery, workflows),
    }),
  ];
}
