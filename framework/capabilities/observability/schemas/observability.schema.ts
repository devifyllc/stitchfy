import { z } from "zod";

export const ObservabilitySectionSchema = z.object({
  implemented: z.boolean(),
  logging: z.array(z.string()),
  metrics: z.array(z.string()),
  tracing: z.array(z.string()),
  alerting: z.array(z.string()),
  dashboards: z.array(z.string()),
  auditEvents: z.array(z.string()),
  notes: z.array(z.string()),
});
