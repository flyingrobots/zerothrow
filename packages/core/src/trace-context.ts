/**
 * Advanced tracing context for ZeroThrow
 * Provides structured trace collection and analysis
 */

import { isDebugEnabled } from './debug.js';
import type { Result } from './result.js';

export interface TraceEntry {
  timestamp: number;
  label?: string;
  ok: boolean;
  value?: unknown;
  error?: Error;
  duration?: number;
}

export interface TraceContext {
  id: string;
  startTime: number;
  entries: TraceEntry[];
  metadata?: Record<string, unknown> | undefined;
}

// Global trace contexts
const activeContexts = new Map<string, TraceContext>();

/**
 * Create a new trace context
 */
export function createTraceContext(id?: string, metadata?: Record<string, unknown>): TraceContext {
  const contextId = id || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const context: TraceContext = {
    id: contextId,
    startTime: Date.now(),
    entries: [],
    ...(metadata !== undefined && { metadata })
  };
  
  if (isDebugEnabled()) {
    activeContexts.set(contextId, context);
  }
  
  return context;
}

/**
 * Add a trace entry to a context
 */
export function addTraceEntry<T, E extends Error>(
  context: TraceContext,
  result: Result<T, E>,
  label?: string
): void {
  if (!isDebugEnabled()) return;
  
  const entry: TraceEntry = {
    timestamp: Date.now(),
    ...(label !== undefined && { label }),
    ok: result.ok,
    ...(result.ok && { value: result.value }),
    ...(!result.ok && { error: result.error }),
    duration: Date.now() - context.startTime
  };
  
  context.entries.push(entry);
}

/**
 * Get all active trace contexts
 */
export function getActiveContexts(): TraceContext[] {
  return Array.from(activeContexts.values());
}

/**
 * Clear a specific trace context
 */
export function clearTraceContext(id: string): void {
  activeContexts.delete(id);
}

/**
 * Clear all trace contexts
 */
export function clearAllTraceContexts(): void {
  activeContexts.clear();
}

/**
 * Export trace context to JSON
 */
export function exportTraceContext(context: TraceContext): string {
  return JSON.stringify(context, (_key, value) => {
    // Handle Error serialization
    if (value instanceof Error) {
      const { name, message, stack, ...rest } = value as Error & Record<string, unknown>;
      return {
        ...rest,
        name,
        message,
        stack
      };
    }
    return value;
  }, 2);
}

/**
 * Analyze trace context for patterns
 */
export function analyzeTraceContext(context: TraceContext): {
  totalDuration: number;
  errorCount: number;
  successCount: number;
  errorRate: number;
  averageDuration: number;
  slowestEntry?: TraceEntry;
} {
  const totalDuration = Date.now() - context.startTime;
  const errorCount = context.entries.filter(e => !e.ok).length;
  const successCount = context.entries.filter(e => e.ok).length;
  const errorRate = context.entries.length > 0 ? errorCount / context.entries.length : 0;
  
  const durations = context.entries.map(e => e.duration || 0);
  const averageDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;
  
  const slowestEntry = context.entries.reduce((slowest, entry) => {
    if (!slowest || (entry.duration || 0) > (slowest.duration || 0)) {
      return entry;
    }
    return slowest;
  }, null as TraceEntry | null) || undefined;
  
  return {
    totalDuration,
    errorCount,
    successCount,
    errorRate,
    averageDuration,
    ...(slowestEntry !== undefined && { slowestEntry })
  };
}

/**
 * Higher-order function to trace a Result-returning function
 */
export function traced<TArgs extends unknown[], TResult, TError extends Error>(
  fn: (...args: TArgs) => Result<TResult, TError>,
  label?: string
): (...args: TArgs) => Result<TResult, TError> {
  return (...args: TArgs) => {
    const result = fn(...args);
    if (isDebugEnabled() && result && typeof result === 'object' && 'trace' in result) {
      return (result as Result<TResult, TError> & { trace: (label?: string) => Result<TResult, TError> }).trace(label);
    }
    return result;
  };
}