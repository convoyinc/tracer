import * as _ from 'lodash';
import * as moment from 'moment-timezone';
import * as uuid from 'uuid';

import Span from './Span';
import { QueueState, TracerConfiguration, Timing } from './interfaces';

export default class Queue {
  private interval: NodeJS.Timer;
  private state: QueueState = {
    traces: [],
    timings: [],
    isFlushing: false,
    lastFlush: null,
  };

  constructor(private config: TracerConfiguration) {
    this.interval = setInterval(
      this.flushIfNeeded.bind(this),
      +moment.duration(config.evaluateFlushIntervalSeconds, 'seconds'),
    );
  }

  public queueTiming(timing: Timing) {
    if (_.isEmpty(timing.id)) {
      timing.id = uuid.v4();
    }

    const globalProperties = _.isFunction(this.config.globalProperties)
      ? this.config.globalProperties()
      : this.config.globalProperties;

    timing.tags = {
      ...globalProperties,
      ..._(timing.tags).omitBy(_.isObject).mapValues(_.toString).value(),
    };

    this.state.timings.push(timing);
  }

  public queueTrace(trace: Span) {
    this.state.traces.push(trace);
  }

  public async flushIfNeeded() {
    if (this.isFlushing || !this.haveItemsToFlush) return;

    if (
      !this.lastFlushTime ||
      moment(this.lastFlushTime).isBefore(
        moment().subtract(this.config.flushIntervalSeconds, 'seconds'),
      )
    ) {
      await this.flush();
    }
  }

  public startFlush() {
    this.state.isFlushing = true;
  }

  public endFlush() {
    this.state.isFlushing = false;
    this.state.lastFlush = moment().toISOString();
  }

  public removeFromQueue(timingsToRemove: Timing[], tracesToRemove: Span[]) {
    this.state.timings = _.without(this.state.timings, ...timingsToRemove);
    this.state.traces = _.without(this.state.traces, ...tracesToRemove);
  }

  public async forceFlush() {
    await this.flush();
  }

  public async flush() {
    this.startFlush();

    try {
      while (this.haveItemsToFlush) {
        const { timings, traces } = this.sliceFromQueue;
        _.each(traces, trace => (trace.error = ~~trace.error));
        await this.config.flushHandler(timings, traces);
        this.removeFromQueue(timings, traces);
      }
    } catch (error) {}

    this.endFlush();
  }

  get sliceFromQueue() {
    return {
      timings: _.take(this.state.timings, this.config.maxTimingsBatchSize),
      traces: _.take(this.state.traces, this.config.maxTracesBatchSize),
    };
  }

  get queueSizes() {
    return {
      timings: _.size(this.state.timings),
      traces: _.size(this.state.traces),
    };
  }

  get haveItemsToFlush() {
    return !!(_.size(this.state.traces) || _.size(this.state.timings));
  }

  get lastFlushTime() {
    return this.state.lastFlush;
  }

  get isFlushing() {
    return this.state.isFlushing;
  }
}
