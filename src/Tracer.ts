import * as _ from 'lodash';
import * as autobind from 'protobind';

import Reporter from './Reporter';
import Span from './Span';
import { ReporterConfiguration, TracerConfiguration, AbstractReporter } from './interfaces';
import { pseudoUuid } from './utils';

export const defaultConfig = {
  minimumDurationMs: 10,
  sampleRate: 1,
  globalMetadata: {},
  globalTags: {},
};

export default class Tracer {
  private spanStack: Span[] = [];
  private reporter: AbstractReporter;

  constructor(private config: TracerConfiguration) {
    this.config = _.defaults(config, defaultConfig);
    this.reporter = this.config.reporter;

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

    const globalMetadata = this.getGlobalMetadata();
    span.setMeta(globalMetadata);

    const globalTags = this.getGlobalTags();
    span.setTags(globalTags);

    const traceId = this.config.traceId || pseudoUuid();
    span.setTraceId(traceId);

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
    currentTrace.setTraceId(currentTrace.traceId);
    this.recordTrace(currentTrace);

    return currentTrace;
  }

  public endIf(resource: string, name: string) {
    if (!this.isInTrace(resource, name)) return;
    return this.end();
  }

  public recordTrace(trace: Span) {
    if (Math.random() <= this.config.sampleRate) {
      this.reporter.reportTrace(trace);
    }
  }

  public sanitizeTags(tags: any) {
    return _(tags).omitBy(_.isObject).mapValues(_.toString).value();
  }

  public getGlobalMetadata() {
    return _.isFunction(this.config.globalMetadata)
      ? this.config.globalMetadata()
      : this.config.globalMetadata;
  }

  public getGlobalTags() {
    return _.isFunction(this.config.globalTags)
      ? this.config.globalTags()
      : this.config.globalTags;
  }

  public getTraceId() {
    const currentTrace = this.get();
    return _.get(currentTrace, 'traceId');
  }
}
