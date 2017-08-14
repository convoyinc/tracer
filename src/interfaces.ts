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

export interface SpanMeta {
  [key: string]: string;
}

export interface SpanMetrics {
  [key: string]: number;
}

export type FlushFunction = (timings: Timing[], traces: Span[]) => any;

export type AnnotatorFunction = (span: Span, ...args: any[]) => void;

export interface TraceFuncArgs {
  tracer: Tracer;
  context: any;
  name: string;
  resource: string;
  service?: string;
  annotator?: AnnotatorFunction;
}

export interface TracerConfiguration {
  minimumDurationMs?: number;
  fullTraceSampleRate?: number;
  flushIntervalSeconds?: number;
  evaluateFlushIntervalSeconds?: number;
  maxTimingsBatchSize?: number;
  maxTracesBatchSize?: number;
  globalProperties?: { [key: string]: string } | Function;
  flushHandler: FlushFunction;
}
