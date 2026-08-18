import { z } from "zod";

export const SecuritySectionSchema = z.object({
  implemented: z.boolean(),
  authentication: z.array(z.string()),
  authorization: z.array(z.string()),
  secretsManagement: z.array(z.string()),
  encryption: z.array(z.string()),
  piiHandling: z.array(z.string()),
  dataClassification: z.array(z.string()),
  notes: z.array(z.string()),
});

export const GovernanceSectionSchema = z.object({
  implemented: z.boolean(),
  auditability: z.array(z.string()),
  responsibleAI: z.array(z.string()),
  humanOversight: z.array(z.string()),
  policies: z.array(z.string()),
  notes: z.array(z.string()),
});

export const SecurityGovernanceOutputSchema = z.object({
  security: SecuritySectionSchema,
  governance: GovernanceSectionSchema,
});
