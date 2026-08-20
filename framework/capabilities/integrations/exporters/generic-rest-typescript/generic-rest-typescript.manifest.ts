/**
 * Builds integration.manifest.json and README.md (task items 23/24) purely
 * from the already-computed IntegrationDefinition/ExportReadiness/generated
 * file list — no new inference happens here.
 */

import type { IntegrationDefinition } from "../../schemas/integrations.types.js";
import type { ExportReadiness, IntegrationExportContext, IntegrationExportManifest } from "../exporter.types.js";
import { buildOpenApiDocument } from "../../generators/integration-artifact.generator.js";
import { slugify } from "../../../../core/slugify.js";

const DISCLAIMER =
  "This output is implementation scaffolding generated from the currently known IntegrationDefinition. " +
  "It does not establish that the integration is production-ready, secure, authenticated, deployed, or operational.";

interface GeneratedFileLike {
  path: string;
}

export function buildManifestAndReadme(
  integration: IntegrationDefinition,
  context: IntegrationExportContext,
  readiness: ExportReadiness,
  exporter: { id: string; version: string },
  generated: GeneratedFileLike[]
): { manifestContent: string; readmeContent: string } {
  const manifest: IntegrationExportManifest = {
    schemaVersion: "1.0",
    integrationId: integration.id,
    integrationVersion: integration.version,
    exporterId: exporter.id,
    exporterVersion: exporter.version,
    readiness: readiness.status,
    generatedFiles: generated.map((f) => f.path),
    operationIds: integration.operations.map((o) => o.id),
    dataContractIds: integration.dataContracts.map((c) => c.id),
    securityRequirementIds: readiness.securityRequirementIds,
    riskIds: readiness.riskIds,
    informationGapIds: readiness.informationGapIds,
    generatedAt: new Date().toISOString(),
  };

  const openApiDocument = buildOpenApiDocument(integration);
  const openApiPath = openApiDocument
    ? `artifacts/integrations/${slugify(integration.name) || integration.id.toLowerCase()}.openapi.json`
    : undefined;

  const securityRequirements = (context.securityArchitecture?.requirements ?? []).filter((r) =>
    readiness.securityRequirementIds.includes(r.id)
  );
  const risks = (context.securityArchitecture?.risks ?? []).filter((r) => readiness.riskIds.includes(r.id));

  const readme: string[] = [];
  readme.push("# Generated Integration Client", "", `> ${DISCLAIMER}`, "");

  readme.push("## Source Integration", "");
  readme.push(`- **${integration.name}** (\`${integration.id}\`, version ${integration.version})`);
  readme.push(`- Purpose: ${integration.purpose}`);
  readme.push("");

  readme.push("## Export Target", "");
  readme.push(`\`${exporter.id}\` (exporter version ${exporter.version})`);
  readme.push("");

  readme.push("## Readiness", "");
  readme.push(`Status: **${readiness.status}**`);
  if (readiness.reasons.length > 0) {
    readme.push("");
    for (const reason of readiness.reasons) readme.push(`- _(${reason.severity})_ ${reason.description}`);
  }
  readme.push("");

  readme.push("## Explicitly Known", "");
  if (integration.restContract) {
    for (const op of integration.restContract.operations) {
      readme.push(`- ${op.method ?? "?"} ${op.path ?? "?"}${op.description ? ` — ${op.description}` : ""}`);
    }
  }
  readme.push(`- Protocol: ${integration.protocol}`);
  if (integration.authentication) readme.push(`- Authentication mechanism: ${integration.authentication.mechanism}`);
  readme.push("");

  readme.push("## Unresolved Information", "");
  const infoReasons = readiness.reasons.filter((r) => r.severity !== "blocking");
  if (infoReasons.length === 0) readme.push("None.");
  else for (const reason of infoReasons) readme.push(`- ${reason.description}`);
  readme.push("");

  readme.push("## Authentication", "");
  if (!integration.authentication || integration.authentication.mechanism === "none") {
    readme.push("No authentication required by this integration.");
  } else {
    readme.push(`- Mechanism: ${integration.authentication.mechanism}`);
    if (integration.authentication.placement) {
      readme.push(
        `- Placement: ${integration.authentication.placement.location}${integration.authentication.placement.name ? ` ("${integration.authentication.placement.name}")` : ""}`
      );
    } else {
      readme.push("- Placement: unresolved — see AuthenticationStrategy in client.ts.");
    }
    readme.push("- No credential values are included anywhere in this bundle.");
  }
  readme.push("");

  readme.push("## Security Requirements", "");
  if (securityRequirements.length === 0) readme.push("None referenced.");
  else for (const req of securityRequirements) readme.push(`- **${req.id}**: ${req.description}`);
  if (risks.length > 0) {
    readme.push("");
    readme.push("Risks:");
    for (const risk of risks) readme.push(`- **${risk.id}**: ${risk.description}`);
  }
  readme.push("");

  readme.push("## Data Contracts", "");
  if (integration.dataContracts.length === 0) readme.push("None identified.");
  else {
    for (const contract of integration.dataContracts) {
      readme.push(`- **${contract.name}** (${contract.direction}): ${contract.fields.map((f) => f.name).join(", ") || "no fields captured"}`);
    }
  }
  if (openApiPath) {
    readme.push("");
    readme.push(`An OpenAPI document for this integration already exists: \`${openApiPath}\`.`);
  }
  readme.push("");

  readme.push("## Generated Files", "");
  for (const file of generated) readme.push(`- \`${file.path}\``);
  readme.push("");

  readme.push("## Implementation Required", "");
  readme.push("- A real `HttpTransport` implementation (client.ts declares the interface only).");
  readme.push("- Applying the authentication strategy to outgoing requests.");
  if (!integration.restContract?.baseUrl) readme.push("- Supplying `baseUrl` via configuration.");
  readme.push("");

  readme.push("## Traceability", "");
  readme.push(`Related workflows: ${integration.relatedWorkflowIds.join(", ") || "none"}`);
  readme.push(`Evidence references: ${integration.evidenceRefs.length}`);
  readme.push("");

  return { manifestContent: JSON.stringify(manifest, null, 2), readmeContent: readme.join("\n") };
}
