/**
 * Generates client.ts/types.ts/config.ts source text for the
 * generic-rest-typescript target (task items 13-21). Consumes
 * IntegrationDefinition as-is — no business discovery, no raw Markdown, no
 * REST-suitability decisions (Phase 4 already made those). Every generated
 * TypeScript file must be syntactically valid; nothing here executes real
 * HTTP or contains a credential value.
 */

import { createArtifact } from "../../../../core/contracts/artifact.js";
import type { ImplementationArtifact } from "../../../../core/contracts/artifact.js";
import type { SystemInventoryItem } from "../../../../discovery/systems/system-inventory.types.js";
import type {
  IntegrationDefinition,
  DataContract,
  DataContractField,
  RestOperation,
} from "../../schemas/integrations.types.js";
import type {
  IntegrationExportBundle,
  IntegrationExportContext,
  GeneratedSourceFile,
} from "../exporter.types.js";
import { toSafeTypeScriptIdentifier } from "../naming/typescript-identifier.js";
import { assessGenericRestTypeScriptReadiness } from "./generic-rest-typescript.readiness.js";
import { buildManifestAndReadme } from "./generic-rest-typescript.manifest.js";
import { slugify } from "../../../../core/slugify.js";

const CAPABILITY_ID = "integrations";

interface GeneratedFile extends GeneratedSourceFile {
  content: string;
}

/**
 * "Fulfillment API" (the target system's own name), not the integration's
 * full-sentence purpose text — matches the task's own client-name example
 * (task item 13) and keeps generated identifiers readable regardless of how
 * verbosely the source described the integration's purpose.
 */
function resolveBaseName(integration: IntegrationDefinition, systems: SystemInventoryItem[]): string {
  const targetSystem = integration.targetSystemId ? systems.find((s) => s.id === integration.targetSystemId) : undefined;
  return targetSystem?.name ?? integration.name;
}

function resolveContracts(integration: IntegrationDefinition): { request?: DataContract; response?: DataContract } {
  return {
    request: integration.dataContracts.find((c) => c.direction === "request"),
    response: integration.dataContracts.find((c) => c.direction === "response"),
  };
}

function mapFieldType(type: string | undefined): "string" | "number" | "boolean" | "unknown" {
  if (type === "string" || type === "number" || type === "boolean") return type;
  return "unknown";
}

function operationBaseName(op: RestOperation, integration: IntegrationDefinition): string {
  const correlated = op.integrationOperationId
    ? integration.operations.find((o) => o.id === op.integrationOperationId)
    : undefined;
  if (correlated) return correlated.name;
  return `${op.method ?? "unknown"} ${op.path ?? "unknown"}`;
}

function renderFieldInterface(
  typeName: string,
  contract: DataContract | undefined,
  direction: "request" | "response"
): string {
  if (!contract || contract.fields.length === 0) {
    return `export type ${typeName} = unknown;\n`;
  }

  // Generation itself never throws on a collision — it stays deterministic
  // and always produces output; generic-rest-typescript.validator.ts
  // separately re-checks with the same detectIdentifierCollisions() utility
  // and surfaces a collision as a hard validation error (task item 26).
  const lines: string[] = [
    `/**`,
    ` * From IntegrationDefinition dataContract "${contract.name}" (${direction}). Field names below are`,
    ` * derived from the source's free-text field descriptions, not verified against the target`,
    ` * API's real wire format — confirm actual field names and casing before use.`,
    ` */`,
    `export interface ${typeName} {`,
  ];

  for (const field of contract.fields) {
    const identifier = toSafeTypeScriptIdentifier(field.name, "camel");
    const tsType = mapFieldType(field.type);
    // Only `required: true` renders a required property; both `false` and
    // unset render optional — requiredness is never invented (task item 17).
    const optional = field.required === true ? "" : "?";
    lines.push(`  /** From: "${field.name}" */`);
    lines.push(`  ${identifier}${optional}: ${tsType};`);
  }

  lines.push(`}`);
  return lines.join("\n") + "\n";
}

function buildTypesSource(integration: IntegrationDefinition, baseName: string): string {
  const { request, response } = resolveContracts(integration);
  const parts: string[] = [
    `/**`,
    ` * Generated from IntegrationDefinition "${integration.id}" (generic-rest-typescript exporter).`,
    ` * See README.md for what is resolved and what still requires implementation.`,
    ` */`,
    ``,
  ];

  for (const op of integration.restContract?.operations ?? []) {
    const opBaseName = toSafeTypeScriptIdentifier(operationBaseName(op, integration), "pascal");
    parts.push(renderFieldInterface(`${opBaseName}Request`, request, "request"));
    parts.push(renderFieldInterface(`${opBaseName}Response`, response, "response"));
  }

  return parts.join("\n");
}

function buildConfigSource(integration: IntegrationDefinition, baseName: string): string {
  const name = toSafeTypeScriptIdentifier(baseName, "pascal");
  const mechanism = integration.authentication?.mechanism ?? "unknown";
  const lines: string[] = [
    `/**`,
    ` * Generated from IntegrationDefinition "${integration.id}" — configuration contract only.`,
    ` * No credential values are generated here or anywhere in this bundle.`,
    ` */`,
    ``,
  ];

  if (mechanism === "api-key") {
    lines.push(`export interface ${name}Credentials {`, `  apiKey: string;`, `}`, ``);
  } else if (mechanism !== "none" && mechanism !== "unknown") {
    lines.push(
      `// Mechanism "${mechanism}" has no dedicated generated shape yet — no example solution has`,
      `// evidenced its actual credential fields. TODO: replace once a real shape is known.`,
      `export type ${name}Credentials = Record<string, unknown>;`,
      ``
    );
  }

  lines.push(`export interface ${name}ClientConfig {`);
  if (!integration.restContract?.baseUrl) {
    lines.push(`  /** Not supplied by the source IntegrationDefinition — must be provided by the caller. */`);
  }
  lines.push(`  baseUrl: string;`);
  if (mechanism !== "none") {
    lines.push(`  credentials?: ${name}Credentials;`);
  }
  lines.push(`}`, ``);

  return lines.join("\n");
}

function buildClientSource(integration: IntegrationDefinition, baseName: string): string {
  const name = toSafeTypeScriptIdentifier(baseName, "pascal");
  const mechanism = integration.authentication?.mechanism ?? "unknown";
  const operations = integration.restContract?.operations ?? [];

  const lines: string[] = [
    `/**`,
    ` * Generated from IntegrationDefinition "${integration.id}" (generic-rest-typescript exporter).`,
    ` * This is implementation scaffolding — Stitchfy does not execute this client.`,
    ` * See README.md for what is resolved and what still requires implementation.`,
    ` */`,
    ``,
    `import type { ${name}ClientConfig } from "./config.js";`,
  ];

  const importedTypes = operations.flatMap((op) => {
    const opBaseName = toSafeTypeScriptIdentifier(operationBaseName(op, integration), "pascal");
    return [`${opBaseName}Request`, `${opBaseName}Response`];
  });
  if (importedTypes.length > 0) {
    lines.push(`import type { ${importedTypes.join(", ")} } from "./types.js";`);
  }

  lines.push(
    ``,
    `export interface HttpRequest<TBody = unknown> {`,
    `  method: string;`,
    `  path: string;`,
    `  body?: TBody;`,
    `  headers?: Record<string, string>;`,
    `}`,
    ``,
    `export interface HttpResponse<TBody = unknown> {`,
    `  status: number;`,
    `  body: TBody;`,
    `}`,
    ``,
    `export interface HttpTransport {`,
    `  request<TRequestBody, TResponseBody>(request: HttpRequest<TRequestBody>): Promise<HttpResponse<TResponseBody>>;`,
    `}`,
    ``
  );

  if (mechanism !== "none") {
    const placementNote = integration.authentication?.placement
      ? `Placement: ${integration.authentication.placement.location}${integration.authentication.placement.name ? ` ("${integration.authentication.placement.name}")` : ""}.`
      : "Placement (header/query/cookie) is unresolved.";
    lines.push(
      `// Authentication mechanism: ${mechanism}. ${placementNote}`,
      `export interface AuthenticationStrategy {`,
      `  apply(request: HttpRequest): HttpRequest;`,
      `}`,
      ``
    );
  }

  lines.push(`export class ${name}Client {`, `  constructor(private readonly config: ${name}ClientConfig) {}`, ``);

  for (const op of operations) {
    const opBaseName = toSafeTypeScriptIdentifier(operationBaseName(op, integration), "pascal");
    const methodName = toSafeTypeScriptIdentifier(operationBaseName(op, integration), "camel");
    lines.push(
      `  /**`,
      `   * Generated from REST ${op.method ?? "?"} ${op.path ?? "?"}.`,
      `   */`,
      `  async ${methodName}(request: ${opBaseName}Request): Promise<${opBaseName}Response> {`,
      `    // Generated from IntegrationDefinition. Authentication application may remain unresolved.`,
      `    throw new Error("Transport implementation not configured.");`,
      `  }`,
      ``
    );
  }

  lines.push(`}`, ``);
  return lines.join("\n");
}

function artifactType(role: GeneratedSourceFile["role"]): ImplementationArtifact["type"] {
  if (role === "manifest") return "config";
  if (role === "documentation") return "document";
  return "code";
}

export function generateGenericRestTypeScriptBundle(
  integration: IntegrationDefinition,
  context: IntegrationExportContext,
  exporter: { id: string; version: string }
): IntegrationExportBundle {
  const readiness = assessGenericRestTypeScriptReadiness(integration, context, exporter.id);
  const baseName = resolveBaseName(integration, context.systems);

  const generated: GeneratedFile[] = [];

  if (readiness.status === "ready" || readiness.status === "needs-review") {
    generated.push(
      { path: "client.ts", language: "typescript", role: "client", content: buildClientSource(integration, baseName) },
      { path: "types.ts", language: "typescript", role: "types", content: buildTypesSource(integration, baseName) },
      { path: "config.ts", language: "typescript", role: "configuration", content: buildConfigSource(integration, baseName) }
    );
  }

  const { manifestContent, readmeContent } = buildManifestAndReadme(integration, context, readiness, exporter, generated);
  generated.push(
    { path: "integration.manifest.json", language: "json", role: "manifest", content: manifestContent },
    { path: "README.md", language: "markdown", role: "documentation", content: readmeContent }
  );

  const integrationSlug = slugify(baseName) || integration.id.toLowerCase();
  const basePath = `artifacts/integrations/exporters/${integrationSlug}/${exporter.id}`;
  const artifacts: ImplementationArtifact[] = generated.map((file) =>
    createArtifact({
      capabilityId: CAPABILITY_ID,
      type: artifactType(file.role),
      path: `${basePath}/${file.path}`,
      content: file.content,
      metadata: { integrationId: integration.id, exporterId: exporter.id, readiness: readiness.status },
    })
  );

  const files: GeneratedSourceFile[] = generated.map(({ content, ...rest }) => rest);

  return {
    id: `${integration.id}-${exporter.id}`,
    integrationId: integration.id,
    exporterId: exporter.id,
    readiness,
    files,
    artifacts,
    notes: [
      `Export readiness: ${readiness.status}.`,
      ...readiness.reasons.map((r) => r.description),
    ],
  };
}
