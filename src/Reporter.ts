import * as _ from 'lodash';
import * as moment from 'moment-timezone';
import * as uuid from 'uuid';
import CircularBuffer from 'circularbuffer';

import Span from './Span';
import { AbstractReporter, Logger, ReporterConfiguration, TracerConfiguration } from './interfaces';

export const defaultReporterConfig:ReporterConfiguration = {
  maxTracesBatchSize: 20,
  flushIntervalSeconds: 30,
  logger: console,
  flushHandler: _.noop,
}

export default class Reporter implements AbstractReporter {
  private traces = new CircularBuffer<Span>(100);
  private isFlushing = false;
  private lastFlush: Date | null = null;
  private isPending = false;
  private log:Logger;

  constructor(private config: ReporterConfiguration) {
    this.config = _.defaults(config, defaultReporterConfig);
    this.log = this.config.logger;
  }

  public reportTrace(trace: Span) {
    this.traces.enq(trace);
    this.requestFlush();
  }

  private requestFlush() {
    if (!this.isPending) {
      this.isPending = true;
      idleCallback(
        this.flushIfNeeded.bind(this),
        +moment.duration(this.config.flushIntervalSeconds, 'seconds'),
      );
    }
  }

  public async flushIfNeeded() {
    this.isPending = false;
    if (this.isFlushing || !this.haveItemsToFlush) return;

    await this.flush();
  }

  public startFlush() {
    this.isFlushing = true;
  }

  public endFlush() {
    this.isFlushing = false;
    this.lastFlush = new Date();
  }

  public removeFromQueue(tracesToRemove: Span[]) {
    this.traces.replace(..._.without(this.traces.toArray(), ...tracesToRemove));
  }

  public async forceFlush() {
    await this.flush();
  }

  public async flush() {
    this.startFlush();

    try {
      while (this.haveItemsToFlush) {
        const { traces } = this.sliceFromQueue;
        await this.config.flushHandler(traces);
        this.removeFromQueue(traces);
      }
    } catch (error) {
      this.log.error(`Error encountered while flushing items:\n`, error);
    }

    this.endFlush();
  }

  get sliceFromQueue() {
    return {
      traces: _.take(this.traces.toArray(), this.config.maxTracesBatchSize),
    };
  }

  get queueSizes() {
    return {
      traces: this.traces.size,
    };
  }

  get haveItemsToFlush() {
    return !!(this.traces.size);
  }
}

function idleCallback(callback:(...args:any[]) => void, timeout:number) {
  if (global.requestIdleCallback) {
    return global.requestIdleCallback(callback, { timeout });
  }
  return setTimeout(callback, timeout);
}
