import { z } from "zod";

const ComputeResourceSchema = z.object({ id: z.string().min(1), type: z.string().min(1), description: z.string() });
const StorageResourceSchema = z.object({ id: z.string().min(1), type: z.string().min(1), description: z.string() });
const DatabaseResourceSchema = z.object({ id: z.string().min(1), engine: z.string().min(1), description: z.string() });

const NetworkingConfigSchema = z.object({
  vpcNeeded: z.boolean(),
  publicEndpoints: z.array(z.string()),
  notes: z.array(z.string()),
});

export const CloudArchitectureSectionSchema = z.object({
  implemented: z.boolean(),
  provider: z.enum(["unspecified", "aws", "azure", "gcp", "other"]),
  compute: z.array(ComputeResourceSchema),
  storage: z.array(StorageResourceSchema),
  databases: z.array(DatabaseResourceSchema),
  networking: NetworkingConfigSchema,
  deploymentStrategy: z.string(),
  scalability: z.array(z.string()),
  resilience: z.array(z.string()),
  environments: z.array(z.string()),
  notes: z.array(z.string()),
});
