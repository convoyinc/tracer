import * as _ from 'lodash';
import * as now from '@streammedev/perfnow';

import { SpanMeta, SpanMetrics } from './interfaces';

/**
 * Spans represent the amount of time spent during a single operation. Traces
 * are composed of spans (and also technically are spans). Spans can have
 * children as well as siblings.
 */
export default class Span {
  public start: number;
  public duration: number;
  public meta: SpanMeta = {};
  public metrics?: SpanMetrics;
  public children: Span[] = [];
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

  public setMetrics(metrics: SpanMetrics) {
    this.metrics = { ...this.metrics, ...metrics };
    return this;
  }

  public setError(error: Error) {
    this.error = 1;

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

  get hasEnded() {
    return 'duration' in this;
  }

  static NoOp = {
    end: () => Span,
    setMeta: () => Span,
    newChild: () => Span,
    setError: () => Span,
    setMetrics: () => Span,
    removeShortSpans: () => Span,
    get hasEnded() {
      return true;
    },
  };
}
