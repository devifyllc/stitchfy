/**
 * Minimal in-memory + console audit logger. Durable storage / SIEM export is
 * a provider concern (see framework/providers/) — this establishes an
 * auditable trail wired into the capability runner from Phase 0 onward
 * rather than deferring auditability to a later phase.
 */

import type { AuditEvent } from "./audit-log.types.js";

const events: AuditEvent[] = [];

export function logAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
  const full: AuditEvent = {
    ...event,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  events.push(full);
  console.log(`  ⎘  [audit] ${full.actor} ${full.action}${full.capabilityId ? ` (${full.capabilityId})` : ""}`);
  return full;
}

export function getAuditLog(): readonly AuditEvent[] {
  return events;
}
