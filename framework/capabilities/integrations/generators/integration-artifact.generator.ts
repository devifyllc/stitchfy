/**
 * Renders ImplementationArtifacts (task item 29) strictly from an
 * already-built IntegrationDefinition — no new inference happens here,
 * including the Mermaid diagram (task item 30) and the OpenAPI document
 * (task item 27, generated only when restContract has an operation with
 * both method and path known — never a fabricated document for an
 * incomplete integration).
 */

import { createArtifact } from "../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../core/contracts/artifact.js";
import type { DiscoveryResult } from "../../../discovery/discovery-result.types.js";
import type { IntegrationDefinition } from "../schemas/integrations.types.js";
import { slugify } from "../../../core/slugify.js";

const CAPABILITY_ID = "integrations";

function buildSystemLookup(discovery: DiscoveryResult): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const s of discovery.systems) lookup.set(s.id, s.name);
  for (const p of discovery.processes) lookup.set(p.id, p.name);
  for (const r of discovery.requirements) lookup.set(r.id, r.description);
  return lookup;
}

function describeId(id: string, lookup: Map<string, string>): string {
  return `${lookup.get(id) ?? id} (${id})`;
}

function renderMermaid(integration: IntegrationDefinition, lookup: Map<string, string>): string {
  const lines: string[] = ["flowchart LR"];
  const sourceLabel = integration.sourceSystemId ? lookup.get(integration.sourceSystemId) ?? integration.sourceSystemId : "Unknown Source";
  const targetLabel = integration.targetSystemId ? lookup.get(integration.targetSystemId) ?? integration.targetSystemId : "Unknown Target";

  for (const workflowId of integration.relatedWorkflowIds) {
    lines.push(`    ${workflowId.replace(/-/g, "_")}["${workflowId}"]`);
  }
  lines.push(`    SRC["${sourceLabel.replace(/"/g, "'")}"]`);
  lines.push(`    TGT["${targetLabel.replace(/"/g, "'")}"]`);
  for (const workflowId of integration.relatedWorkflowIds) {
    lines.push(`    ${workflowId.replace(/-/g, "_")} --> SRC`);
  }
  lines.push(`    SRC -->|"${integration.purpose.replace(/"/g, "'").slice(0, 60)}"| TGT`);

  return lines.join("\n");
}

function renderMarkdown(integration: IntegrationDefinition, discovery: DiscoveryResult): string {
  const lookup = buildSystemLookup(discovery);
  const lines: string[] = [];

  lines.push(`# Integration: ${integration.name}`);
  lines.push("");
  lines.push(`_Status: **${integration.status}**${integration.statusReasons.length > 0 ? ` (${integration.statusReasons.join("; ")})` : ""}_`);
  lines.push("");
  lines.push(
    "> `implemented: true` on this capability means Stitchfy generated and validated this vendor-neutral " +
      "integration specification — it does not mean Stitchfy connected to or exchanged data with the external system."
  );
  lines.push("");

  lines.push("## Purpose");
  lines.push("");
  lines.push(integration.purpose);
  lines.push("");

  lines.push("## Source System");
  lines.push("");
  lines.push(integration.sourceSystemId ? describeId(integration.sourceSystemId, lookup) : "_Unknown — not stated by Discovery._");
  lines.push("");

  lines.push("## Target System");
  lines.push("");
  lines.push(integration.targetSystemId ? describeId(integration.targetSystemId, lookup) : "_Unknown — not stated by Discovery._");
  lines.push("");

  lines.push("## Related Workflow");
  lines.push("");
  if (integration.relatedWorkflowIds.length === 0) lines.push("None.");
  else for (const id of integration.relatedWorkflowIds) lines.push(`- ${id}`);
  lines.push("");

  lines.push("```mermaid");
  lines.push(renderMermaid(integration, lookup));
  lines.push("```");
  lines.push("");

  lines.push("## Operations");
  lines.push("");
  if (integration.operations.length === 0) lines.push("None identified.");
  else for (const op of integration.operations) lines.push(`- **${op.name}** _(${op.type})_ — ${op.description}`);
  lines.push("");

  lines.push("## Interaction Pattern");
  lines.push("");
  lines.push(`- Direction: ${integration.direction}`);
  lines.push(`- Pattern: ${integration.interactionPattern}`);
  lines.push(`- Protocol: ${integration.protocol}`);
  if (integration.restContract) {
    lines.push(`- REST: ${integration.restContract.operations.map((o) => `${o.method ?? "?"} ${o.path ?? "?"}`).join(", ")}`);
  }
  if (integration.webhookContract) {
    lines.push(`- Webhook: direction ${integration.webhookContract.direction}${integration.webhookContract.eventName ? `, event "${integration.webhookContract.eventName}"` : ""}`);
  }
  lines.push("");

  lines.push("## Data Exchanged");
  lines.push("");
  if (integration.dataContracts.length === 0) lines.push("None identified.");
  else {
    for (const contract of integration.dataContracts) {
      lines.push(`- **${contract.name}** (${contract.direction}, sensitivity: ${contract.sensitivity}): ${contract.fields.map((f) => f.name).join(", ") || "no fields captured"}`);
    }
  }
  lines.push("");

  lines.push("## Authentication");
  lines.push("");
  lines.push(integration.authentication ? `Mechanism: ${integration.authentication.mechanism}` : "Unknown.");
  lines.push("");

  lines.push("## Reliability");
  lines.push("");
  lines.push(`- Retry required: ${integration.reliability.retryRequired}`);
  lines.push(`- Idempotency required: ${integration.reliability.idempotencyRequired}`);
  lines.push(`- Timeout required: ${integration.reliability.timeoutRequired}`);
  if (integration.reliability.orderingRequired !== undefined) lines.push(`- Ordering required: ${integration.reliability.orderingRequired}`);
  lines.push("");

  lines.push("## Error Handling");
  lines.push("");
  if (integration.failureScenarios.length === 0) lines.push("No explicit failure-handling policy discovered.");
  else for (const f of integration.failureScenarios) lines.push(`- ${f.condition} → ${f.handling}`);
  lines.push("");

  lines.push("## Security Considerations");
  lines.push("");
  lines.push(`- Encryption in transit: ${integration.security.encryptionInTransit}`);
  lines.push(`- Contains sensitive data: ${integration.security.containsSensitiveData}`);
  lines.push(`- Secrets required: ${integration.security.secretsRequired}`);
  lines.push(`- Audit required: ${integration.security.auditRequired}`);
  lines.push("");

  lines.push("## Information Gaps");
  lines.push("");
  if (integration.informationGaps.length === 0) lines.push("None.");
  else for (const g of integration.informationGaps) lines.push(`- **${g.topic}**: ${g.question}`);
  lines.push("");

  lines.push("## Traceability");
  lines.push("");
  lines.push(`Related processes: ${integration.relatedProcessIds.map((id) => describeId(id, lookup)).join(", ") || "none"}`);
  lines.push(`Related requirements: ${integration.relatedRequirementIds.map((id) => describeId(id, lookup)).join(", ") || "none"}`);
  lines.push(`Evidence: ${integration.evidenceRefs.length} reference(s)`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Exported (Phase 5.5A) so the generic-rest-typescript exporter's manifest/
 * README generation can check whether an OpenAPI artifact already exists
 * for this integration and reference its known deterministic path — never
 * a second competing OpenAPI generator (task item 29: "one source of truth").
 */
export function buildOpenApiDocument(integration: IntegrationDefinition): Record<string, unknown> | undefined {
  if (!integration.restContract) return undefined;
  const validOps = integration.restContract.operations.filter((o) => o.method && o.path);
  if (validOps.length === 0) return undefined;

  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of validOps) {
    const pathEntry = paths[op.path!] ?? (paths[op.path!] = {});
    pathEntry[op.method!.toLowerCase()] = {
      summary: op.description ?? `${op.method} ${op.path}`,
      responses: { "200": { description: "Successful response" } },
    };
  }

  return {
    openapi: "3.0.3",
    info: { title: integration.name, version: integration.version },
    ...(integration.restContract.baseUrl ? { servers: [{ url: integration.restContract.baseUrl }] } : {}),
    paths,
  };
}

export function buildIntegrationArtifacts(
  integration: IntegrationDefinition,
  discovery: DiscoveryResult
): ImplementationArtifact[] {
  const slug = slugify(integration.name) || integration.id.toLowerCase();
  const artifacts: ImplementationArtifact[] = [];

  artifacts.push(
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "config",
      path: `artifacts/integrations/${slug}.integration.json`,
      content: JSON.stringify(integration, null, 2),
      metadata: { integrationId: integration.id },
    })
  );

  artifacts.push(
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: "document",
      path: `artifacts/integrations/${slug}.integration.md`,
      content: renderMarkdown(integration, discovery),
      metadata: { integrationId: integration.id },
    })
  );

  const openApiDocument = buildOpenApiDocument(integration);
  if (openApiDocument) {
    artifacts.push(
      createArtifact({
        capabilityId: CAPABILITY_ID,
        type: "config",
        path: `artifacts/integrations/${slug}.openapi.json`,
        content: JSON.stringify(openApiDocument, null, 2),
        metadata: { integrationId: integration.id },
      })
    );
  }

  return artifacts;
}
