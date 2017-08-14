import * as _ from 'lodash';
import * as autobind from 'protobind';

import Queue from './Queue';
import Span from './Span';
import { TracerConfiguration } from './interfaces';

export const defaultConfig: TracerConfiguration = {
  maxTimingsBatchSize: 50,
  maxTracesBatchSize: 20,
  evaluateFlushIntervalSeconds: 5,
  flushIntervalSeconds: 30,
  minimumDurationMs: 10,
  fullTraceSampleRate: 1 / 25,
  flushHandler: _.noop,
};

export default class Tracer {
  private spanStack: Span[] = [];
  private queue: Queue;

  constructor(private config: TracerConfiguration) {
    this.config = _.defaults(config, defaultConfig);
    this.queue = new Queue(this.config);

    autobind(this);
  }

  public start(resource: string, name: string, service: string = 'trace') {
    const currentTrace = this.get();
    if (currentTrace) {
      const message = `Tracing.start was called when another trace was active; overriding`;
      currentTrace.setError(new Error(message));
      this.end();
    }

    const span = new Span(resource, name, service);

    const globalProperties = _.isFunction(this.config.globalProperties)
      ? this.config.globalProperties()
      : this.config.globalProperties;
    span.setMeta(globalProperties);

    this.spanStack = [span];
    return _.head(this.spanStack);
  }

  public startTopLevelSpan(resource: string, name: string, service?: string) {
    return this.startSpan(this.get(), resource, name, service);
  }

  public startNestedSpan(resource: string, name: string, service?: string) {
    const span = this.startSpan(this.getNestedSpan(), resource, name, service);

    // Only keep track of spans that we're actually tracking.
    if (span !== (Span.NoOp as any)) {
      this.spanStack.push(span as Span);
    }

    return span;
  }

  public getNestedSpan() {
    const span = _.last(this.spanStack);
    if (span && !span.hasEnded) return span;

    // Since spans can end without telling us about it, we scrub them ourselves.
    this.spanStack = _.dropRightWhile(this.spanStack, s => s.hasEnded);
    return _.last(this.spanStack);
  }

  public startSpan(parent: Span, resource: string, name: string, service?: string) {
    if (!parent) return Span.NoOp;
    const dupe = _.find(parent.children, { name, resource, hasEnded: false });
    return dupe || parent.newChild(resource, name, service);
  }

  public isInTrace(resource: string, name: string) {
    const trace = this.get();
    if (!trace) return false;
    return trace.resource === resource && trace.name === name;
  }

  public get() {
    return _.head(this.spanStack);
  }

  public end() {
    const currentTrace = this.get();
    if (!currentTrace) return;

    this.spanStack = [];
    currentTrace.end();
    currentTrace.removeShortSpans(this.config.minimumDurationMs);
    this.recordTrace(currentTrace);

    return currentTrace;
  }

  public endIf(resource: string, name: string) {
    if (!this.isInTrace(resource, name)) return;
    return this.end();
  }

  public recordTrace(trace: Span) {
    if (Math.random() <= this.config.fullTraceSampleRate) {
      this.queue.queueTrace(trace);
    }

    /**
     * We always record two levels of the trace as metrics. So far, this maps
     * well to the traces we have (and are thinking about). It may need to be
     * more configurable in the future.
     */
    this.recordSpanTiming(trace);
    for (const child of trace.children) {
      this.recordSpanTiming(
        child,
        { resource: trace.resource },
        `${trace.service}.${trace.name}.`,
      );
    }
  }

  public recordSpanTiming(
    { name, service, resource, duration, meta }: Span,
    extraMeta = {},
    prefix = '',
  ) {
    this.queue.queueTiming({
      name: `${prefix}${service}.${name}`,
      duration,
      tags: {
        resource,
        ...meta,
        ...extraMeta,
      },
    });
  }
}
