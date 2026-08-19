/**
 * Wires the built-in exporters into a fresh registry — mirrors
 * framework/core/registry/default-capabilities.ts's pattern (fresh instance
 * per call, no module-level singleton). Adding a new exporter target is a
 * `register()` call here, never a switch statement elsewhere.
 */

import { IntegrationExporterRegistry } from "./exporter-registry.js";
import { genericRestTypeScriptExporter } from "./generic-rest-typescript/generic-rest-typescript.exporter.js";

export function createDefaultExporterRegistry(): IntegrationExporterRegistry {
  const registry = new IntegrationExporterRegistry();
  registry.register(genericRestTypeScriptExporter);
  return registry;
}
