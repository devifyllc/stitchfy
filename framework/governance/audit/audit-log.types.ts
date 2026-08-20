export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  capabilityId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
