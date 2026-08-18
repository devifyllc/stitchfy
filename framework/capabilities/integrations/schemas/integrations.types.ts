export interface RestApiIntegration {
  id: string;
  name: string;
  baseUrl: string;
  authMechanism: string;
}

export interface WebhookIntegration {
  id: string;
  name: string;
  event: string;
  targetUrl: string;
}

export interface SaasIntegration {
  id: string;
  provider: string;
  purpose: string;
}

export interface DataMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: string;
}

export interface IntegrationsSection {
  implemented: boolean;
  restApis: RestApiIntegration[];
  webhooks: WebhookIntegration[];
  saasIntegrations: SaasIntegration[];
  dataMappings: DataMapping[];
  retryPolicy?: RetryPolicy;
  errorHandling: string[];
  notes: string[];
}
