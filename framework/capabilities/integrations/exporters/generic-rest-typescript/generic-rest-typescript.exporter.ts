/**
 * generic-rest-typescript — the first concrete IntegrationExporter (task
 * item 9). Supports an IntegrationDefinition only when Phase 4 already
 * produced an explicit restContract with a known method+path — never
 * inferred from system name or SaaS classification (the source of truth is
 * the validated IntegrationDefinition itself, not Discovery).
 */

import type { IntegrationDefinition } from "../../schemas/integrations.types.js";
import type { IntegrationExporter, IntegrationExportContext } from "../exporter.types.js";
import type { IntegrationExportBundle } from "../exporter.types.js";
import { assessGenericRestTypeScriptReadiness } from "./generic-rest-typescript.readiness.js";
import { generateGenericRestTypeScriptBundle } from "./generic-rest-typescript.generator.js";

export const GENERIC_REST_TYPESCRIPT_EXPORTER_ID = "generic-rest-typescript";

export function supportsGenericRestTypeScript(integration: IntegrationDefinition): boolean {
  return Boolean(
    integration.restContract &&
      integration.restContract.operations.some((op) => op.method && op.path)
  );
}

export const genericRestTypeScriptExporter: IntegrationExporter = {
  id: GENERIC_REST_TYPESCRIPT_EXPORTER_ID,
  name: "Generic REST (TypeScript)",
  version: "1.0.0",
  target: "generic-rest-typescript",

  supports: supportsGenericRestTypeScript,

  assessReadiness(integration: IntegrationDefinition, context: IntegrationExportContext) {
    return assessGenericRestTypeScriptReadiness(integration, context, genericRestTypeScriptExporter.id);
  },

  async export(
    integration: IntegrationDefinition,
    context: IntegrationExportContext
  ): Promise<IntegrationExportBundle> {
    return generateGenericRestTypeScriptBundle(integration, context, genericRestTypeScriptExporter);
  },
};
