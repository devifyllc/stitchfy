import { z } from "zod";
import { EvidenceReferenceSchema, ArchitectureReferenceSchema } from "../../schemas/planning/planning.schema.js";

export const RiskAssessmentSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["security", "privacy", "operational", "integration", "data", "governance", "modernization"]),
  description: z.string().min(1),
  likelihood: z.enum(["low", "medium", "high", "unknown"]),
  impact: z.enum(["low", "medium", "high", "unknown"]),
  treatment: z.enum(["mitigate", "accept", "avoid", "transfer", "review"]),
  relatedArchitectureRefs: z.array(ArchitectureReferenceSchema),
  evidenceRefs: z.array(EvidenceReferenceSchema).min(1, "RiskAssessment must have at least one evidence reference"),
  status: z.enum(["open", "accepted", "mitigated", "needs-review"]),
});
