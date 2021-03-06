import * as _ from 'lodash';
import * as now from '@streammedev/perfnow';

import { SpanMeta, SpanTags } from './interfaces';

/**
 * Spans represent the amount of time spent during a single operation. Traces
 * are composed of spans (and also technically are spans). Spans can have
 * children as well as siblings.
 */
export default class Span {
  public traceId: number;
  public start: number;
  public duration: number;
  public meta: SpanMeta = {};
  public children: Span[] = [];
  public tags: SpanTags = {};
  public error: number = 0;

  constructor(public resource: string, public name: string, public service?: string) {
    this.start = now();
  }

  public newChild(resource: string, name: string, service?: string) {
    const child = new Span(resource, name, service);
    this.children.push(child);
    return child;
  }

  public setMeta(meta: SpanMeta) {
    if (_.isEmpty(meta)) return this;
    const cleanMeta = _(meta).omitBy(_.isObject).mapValues(_.toString).value();
    this.meta = { ...this.meta, ...cleanMeta };
    return this;
  }

  public setTags(tags: SpanTags) {
    if (_.isEmpty(tags)) return this;
    const cleanTags = _(tags).omitBy(_.isObject).mapValues(_.toString).value();
    this.tags = { ...this.tags, ...cleanTags };
    return this;
  }

  public setError(error: Error) {
    this.error = 1;

    // Add tags so we can filter metrics by them
    this.setTags({
      error: '1',
      'error.name': error.name,
    });

    // Add meta for diving deep into specific error
    this.setMeta({
      'error.name': error.name,
      'error.message': error.message,
    });

    return this;
  }

  public end(endTime = now()) {
    if (this.hasEnded) this.setMeta({ 'span.unbalanced': 'true' });

    this.duration = endTime - this.start;

    _.each(this.children, (child: Span) => {
      if (child.hasEnded) return;
      child.end(endTime);
    });

    return this;
  }

  public removeShortSpans(thresholdMs: number) {
    if (!thresholdMs || !this.children) return this;
    _.remove(this.children, (child: Span) => child.duration < thresholdMs);
    _.forEach(this.children, child => {
      child.removeShortSpans(thresholdMs);
    });
    return this;
  }

  public setTraceId(traceId: number) {
    this.traceId = traceId;
    if (!this.children) return this;
    _.forEach(this.children, child => {
      child.setTraceId(traceId);
    });
    return this;
  }

  get hasEnded() {
    return 'duration' in this;
  }

  static NoOp = {
    end: () => Span,
    setMeta: () => Span,
    setTags: () => Span,
    newChild: () => Span,
    setError: (error?:Error) => Span,
    removeShortSpans: () => Span,
    setTraceId: () => Span,
    get hasEnded() {
      return true;
    },
  };
}
