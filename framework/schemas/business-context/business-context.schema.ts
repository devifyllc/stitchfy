/**
 * Zod mirror of discovery/business/business-context.types.ts, used to
 * validate business-context.json before it's written to disk.
 */

import { z } from "zod";

export const BusinessContextSchema = z.object({
  businessName: z.string().min(1, "businessName is required"),
  industry: z.string(),
  goals: z.array(z.string()),
  users: z.array(z.string()),
  processes: z.array(z.string()),
  painPoints: z.array(z.string()),
  existingSystems: z.array(z.string()),
  businessRules: z.array(z.string()),
  integrations: z.array(z.string()),
  data: z.array(z.string()),
  constraints: z.array(z.string()),
  desiredOutcomes: z.array(z.string()),
  missingInformation: z.array(z.string()),
});
