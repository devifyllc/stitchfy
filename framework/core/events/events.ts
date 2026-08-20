/**
 * Minimal synchronous event emitter for pipeline observability hooks.
 * Deliberately dependency-free (no Node EventEmitter typings friction, no
 * external package) — the observability capability can later subscribe here
 * to feed logs/metrics/traces without the orchestrator knowing about it.
 */

export type PipelineEventType =
  | "capability.started"
  | "capability.completed"
  | "capability.skipped"
  | "capability.failed";

export interface PipelineEvent {
  type: PipelineEventType;
  capabilityId: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

type Listener = (event: PipelineEvent) => void;

export class PipelineEventEmitter {
  private listeners: Listener[] = [];

  on(listener: Listener): void {
    this.listeners.push(listener);
  }

  emit(event: Omit<PipelineEvent, "timestamp">): void {
    const full: PipelineEvent = { ...event, timestamp: new Date().toISOString() };
    for (const listener of this.listeners) listener(full);
  }
}
