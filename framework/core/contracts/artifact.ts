/**
 * ImplementationArtifact — a typed, auditable output produced by a capability
 * (generated code, a config file, a document, a report, ...). Distinct from
 * SolutionBlueprint sections: the blueprint describes *what* the solution is,
 * artifacts are the concrete files/records produced while building it.
 */

export type ArtifactType =
  | "blueprint"
  | "business-context"
  | "code"
  | "config"
  | "document"
  | "report";

export interface ImplementationArtifact {
  id: string;
  capabilityId: string;
  type: ArtifactType;
  path?: string;
  content?: unknown;
  metadata?: Record<string, unknown>;
  generatedAt: string;
}

export function createArtifact(
  input: Omit<ImplementationArtifact, "id" | "generatedAt">
): ImplementationArtifact {
  return {
    ...input,
    id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
  };
}
