/**
 * Generic exporter registry (task item 8) — adding a new export target is a
 * `register()` call in default-exporters.ts, never a switch statement over
 * exporter ids anywhere else in this codebase.
 */

import type { IntegrationDefinition } from "../schemas/integrations.types.js";
import type { IntegrationExporter } from "./exporter.types.js";

export class IntegrationExporterRegistry {
  private exporters = new Map<string, IntegrationExporter>();

  register(exporter: IntegrationExporter): void {
    if (this.exporters.has(exporter.id)) {
      throw new Error(`IntegrationExporterRegistry: "${exporter.id}" is already registered`);
    }
    this.exporters.set(exporter.id, exporter);
  }

  get(id: string): IntegrationExporter | undefined {
    return this.exporters.get(id);
  }

  getAll(): IntegrationExporter[] {
    return [...this.exporters.values()];
  }

  findSupported(integration: IntegrationDefinition): IntegrationExporter[] {
    return this.getAll().filter((exporter) => exporter.supports(integration));
  }
}
