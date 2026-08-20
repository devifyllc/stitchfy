import { ModernizationExporterRegistry } from "./exporter-registry.js";
import { genericJavaReplatformExporter } from "./generic-java-replatform/generic-java-replatform.exporter.js";

export function createDefaultModernizationExporterRegistry(): ModernizationExporterRegistry {
  const registry = new ModernizationExporterRegistry();
  registry.register(genericJavaReplatformExporter);
  return registry;
}
