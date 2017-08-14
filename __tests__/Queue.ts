import * as _ from 'lodash';
import * as moment from 'moment-timezone';
import * as uuid from 'uuid';

import Queue from '../src/Queue';
import Span from '../src/Span';
import { defaultConfig } from '../src/Tracer';
import { Timing, TracerConfiguration } from '../src/interfaces';

describe(`Queue`, () => {
  let queue: Queue, config: TracerConfiguration, timing: Timing, trace: Span;
  beforeEach(() => {
    jest.useFakeTimers();

    config = {
      ...defaultConfig,
      globalProperties: { foo: 'bar' },
      flushHandler: jest.fn(),
    };

    trace = new Span('FooResource', 'FooName', 'FooService');
    timing = {
      id: uuid.v4(),
      name: 'Foo',
      duration: 500,
      tags: {
        foo: 'bar',
      },
    };

    queue = new Queue(config);
  });

  describe(`constructor`, () => {
    it(`initiates the queue with the provided config`, () => {
      expect((queue as any).config).toMatchObject(config);
    });

    it(`kicks off a new interval to evaluate flushes`, () => {
      expect((queue as any).interval).toBeTruthy;
    });
  });

  describe(`queueTiming`, () => {
    it(`adds the timing to the array of timings`, async () => {
      await queue.queueTiming(timing);
      expect((queue as any).state.timings).toHaveLength(1);
    });

    it(`adds an id to the timing if it doesn't already have one`, async () => {
      delete timing.id;
      await queue.queueTiming(timing);
      expect((queue as any).state.timings[0].id).toBeDefined;
    });
  });

  describe(`queueTrace`, () => {
    it(`adds the trace to the array of traces`, async () => {
      await queue.queueTrace(trace);
      expect((queue as any).state.traces).toHaveLength(1);
    });
  });

  describe(`flushIfNeeded`, () => {
    it(`it calls flush if it's not already flushing and it has items to flush`, async () => {
      (queue as any).state.timings = [timing];
      queue.flush = jest.fn();
      await queue.flushIfNeeded();
      expect(queue.flush).toHaveBeenCalled;
    });

    it(`it doesn't call flush if it's already flushing`, async () => {
      (queue as any).state.timings = [timing];
      queue.flush = jest.fn();
      (queue as any).state.isFlushing = true;
      await queue.flushIfNeeded();
      expect(queue.flush).not.toHaveBeenCalled;
    });

    it(`it doesn't call flush if the last flush time was too recent`, async () => {
      (queue as any).state.timings = [timing];
      queue.flush = jest.fn();
      (queue as any).state.lastFlush = moment().subtract(2, 'seconds').toISOString();
      await queue.flushIfNeeded();
      expect(queue.flush).not.toHaveBeenCalled;
    });
  });

  describe(`startFlush`, () => {
    it(`sets 'isFlushing' to true`, () => {
      queue.startFlush();
      expect(queue.isFlushing).toBe(true);
    });
  });

  describe(`endFlush`, () => {
    it(`sets 'isFlushing' to false`, () => {
      (queue as any).state.isFlushing = true;
      queue.endFlush();
      expect(queue.isFlushing).toBe(false);
      expect(queue.lastFlushTime).not.toBeUndefined;
    });
  });

  describe(`removeFromQueue`, () => {
    it(`removes the specified timings from the queue`, () => {
      (queue as any).state.timings = [timing];
      queue.removeFromQueue([timing], []);
      expect((queue as any).state.timings).toHaveLength(0);
    });

    it(`removes the specified traces from the queue`, () => {
      (queue as any).state.traces = [trace];
      queue.removeFromQueue([], [trace]);
      expect((queue as any).state.traces).toHaveLength(0);
    });
  });

  describe(`forceFlush`, () => {
    it(`calls 'flush'`, async () => {
      queue.flush = jest.fn();
      await queue.forceFlush();
      expect(queue.flush).toHaveBeenCalled;
    });
  });

  describe(`flush`, () => {
    it(`calls 'startFlush'`, async () => {
      queue.startFlush = jest.fn();
      await queue.flush();
      expect(queue.startFlush).toHaveBeenCalled;
    });

    it(`doesn't call our flushHandler if there's nothing to flush`, async () => {
      (queue as any).config.flushHandler = jest.fn();
      await queue.flush();
      expect((queue as any).config.flushHandler).not.toHaveBeenCalled;
    });

    it(`does call our flushHandler if there are items to be flushed`, async () => {
      (queue as any).config.flushHandler = jest.fn();
      (queue as any).state.timings = [timing];
      await queue.flush();
      expect((queue as any).config.flushHandler).toHaveBeenCalled;
    });
  });

  describe(`queueSizes`, () => {
    it(`returns the correct size for each queue`, () => {
      (queue as any).state.timings = [timing];
      (queue as any).state.traces = [trace];
      expect(queue.queueSizes).toMatchObject({ traces: 1, timings: 1 });
    });
  });

  it(`flushes at the correct frequency`, () => {
    queue.flush = jest.fn();

    (queue as any).state.timings = [timing];
    (queue as any).state.traces = [trace];
    (queue as any).state.lastFlush = null;
    jest.runTimersToTime((queue as any).config.evaluateFlushIntervalSeconds * 1000 * 5);

    expect(queue.flush).toHaveBeenCalledTimes(5);
  });
});
