import * as _ from 'lodash';
import * as moment from 'moment-timezone';
import * as uuid from 'uuid';
import CircularBuffer from 'circularbuffer';

import Span from './Span';
import { AbstractReporter, TracerConfiguration, Timing } from './interfaces';

export default class Reporter implements AbstractReporter {
  private interval: NodeJS.Timer;
  private traces = new CircularBuffer<Span>(100);
  private timings = new CircularBuffer<Timing>(100);
  private isFlushing = false;
  private lastFlush: Date | null = null;

  constructor(private config: TracerConfiguration) {
    this.interval = setInterval(
      this.flushIfNeeded.bind(this),
      +moment.duration(config.evaluateFlushIntervalSeconds, 'seconds'),
    );
  }

  private log = this.config.logger;

  public reportTiming(timing: Timing) {
    if (_.isEmpty(timing.id)) {
      timing.id = uuid.v4();
    }

    this.timings.enq(timing);
  }

  public reportTrace(trace: Span) {
    this.traces.enq(trace);
  }

  public async flushIfNeeded() {
    if (this.isFlushing || !this.haveItemsToFlush) return;

    if (
      !this.lastFlush ||
      moment(this.lastFlush).isBefore(
        moment().subtract(this.config.flushIntervalSeconds, 'seconds'),
      )
    ) {
      await this.flush();
    }
  }

  public startFlush() {
    this.isFlushing = true;
  }

  public endFlush() {
    this.isFlushing = false;
    this.lastFlush = new Date();
  }

  public removeFromQueue(timingsToRemove: Timing[], tracesToRemove: Span[]) {
    this.timings.replace(..._.without(this.timings.toArray(), ...timingsToRemove));
    this.traces.replace(..._.without(this.traces.toArray(), ...tracesToRemove));
  }

  public async forceFlush() {
    await this.flush();
  }

  public async flush() {
    this.startFlush();

    try {
      while (this.haveItemsToFlush) {
        const { timings, traces } = this.sliceFromQueue;
        await this.config.flushHandler(timings, traces);
        this.removeFromQueue(timings, traces);
      }
    } catch (error) {
      this.log.error(`Error encountered while flushing items:\n`, error);
    }

    this.endFlush();
  }

  get sliceFromQueue() {
    return {
      timings: _.take(this.timings.toArray(), this.config.maxTimingsBatchSize),
      traces: _.take(this.traces.toArray(), this.config.maxTracesBatchSize),
    };
  }

  get queueSizes() {
    return {
      timings: this.timings.size,
      traces: this.traces.size,
    };
  }

  get haveItemsToFlush() {
    return !!(this.traces.size || this.timings.size);
  }
}
