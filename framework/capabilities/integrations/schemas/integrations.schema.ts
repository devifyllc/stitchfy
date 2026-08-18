import { z } from "zod";

const RestApiIntegrationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string(),
  authMechanism: z.string(),
});

const WebhookIntegrationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  event: z.string(),
  targetUrl: z.string(),
});

const SaasIntegrationSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  purpose: z.string(),
});

const DataMappingSchema = z.object({
  sourceField: z.string().min(1),
  targetField: z.string().min(1),
  transform: z.string().optional(),
});

const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(0),
  backoffStrategy: z.string(),
});

export const IntegrationsSectionSchema = z.object({
  implemented: z.boolean(),
  restApis: z.array(RestApiIntegrationSchema),
  webhooks: z.array(WebhookIntegrationSchema),
  saasIntegrations: z.array(SaasIntegrationSchema),
  dataMappings: z.array(DataMappingSchema),
  retryPolicy: RetryPolicySchema.optional(),
  errorHandling: z.array(z.string()),
  notes: z.array(z.string()),
});
