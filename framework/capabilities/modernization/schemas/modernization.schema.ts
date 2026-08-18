import { z } from "zod";

const MigrationCandidateSchema = z.object({
  systemId: z.string().min(1),
  name: z.string().min(1),
  recommendedStrategy: z.string(),
  rationale: z.string(),
});

export const ModernizationSectionSchema = z.object({
  implemented: z.boolean(),
  systemInventory: z.array(z.string()),
  dependencies: z.array(z.string()),
  applications: z.array(z.string()),
  integrations: z.array(z.string()),
  technicalDebt: z.array(z.string()),
  migrationCandidates: z.array(MigrationCandidateSchema),
  migrationStrategies: z.array(z.string()),
  recommendations: z.array(z.string()),
  notes: z.array(z.string()),
});
