/**
 * Deterministic text → filesystem-safe slug transformation. Extracted from
 * integrations/generators/integration-artifact.generator.ts (Phase 4) so
 * the exporter path-builder (Phase 5.5A) can produce identical slugs for
 * the same IntegrationDefinition name without duplicating the function.
 */

export function slugify(text: string, maxLength = 60): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
