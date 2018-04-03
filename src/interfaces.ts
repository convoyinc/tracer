import Span from './Span';
import Tracer from './Tracer';

export interface QueueState {
  traces: Span[];
  isFlushing: boolean;
  lastFlush: string | null;
}

export type Span = typeof Span;

export interface SpanMeta {
  [key: string]: string;
}

export interface SpanTags {
  [key: string]: string;
}

export type FlushFunction = (traces: Span[]) => any;

export interface Logger {
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export interface AbstractReporter {
  reportTrace(trace: Span): any;
}

export interface TracerConfiguration  {
  minimumDurationMs?: number;
  sampleRate?: number;
  globalMetadata?: { [key: string]: string } | Function;
  globalTags?: { [key: string]: string } | Function;
  reporter: AbstractReporter;
  traceId?: number;
}

export interface ReporterConfiguration {
  maxTracesBatchSize?: number;
  flushIntervalSeconds?: number;
  logger?: Logger;
  flushHandler?: FlushFunction;
}
