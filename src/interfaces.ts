import Span from './Span';
import Tracer from './Tracer';

export interface QueueState {
  timings: Timing[];
  traces: Span[];
  isFlushing: boolean;
  lastFlush: string | null;
}

export interface Timing {
  id?: string;
  name: string;
  duration: number;
  tags?: { [key: string]: string };
}

export type Span = typeof Span;

export interface SpanMeta {
  [key: string]: string;
}

export interface SpanMetrics {
  [key: string]: number;
}

export type FlushFunction = (timings: Timing[], traces: Span[]) => any;

export interface Logger {
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export interface AbstractReporter {
  reportTiming(timing: Timing): any;
  reportTrace(trace: Span): any;
}

export interface TracerConfiguration {
  minimumDurationMs?: number;
  fullTraceSampleRate?: number;
  flushIntervalSeconds?: number;
  evaluateFlushIntervalSeconds?: number;
  maxTimingsBatchSize?: number;
  maxTracesBatchSize?: number;
  globalProperties?: { [key: string]: string } | Function;
  logger?: Logger;
  flushHandler: FlushFunction;
  reporter: null | AbstractReporter;
}
