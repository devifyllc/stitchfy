export interface ObservabilitySection {
  implemented: boolean;
  logging: string[];
  metrics: string[];
  tracing: string[];
  alerting: string[];
  dashboards: string[];
  auditEvents: string[];
  notes: string[];
}
