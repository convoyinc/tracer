import * as _ from 'lodash';
import * as moment from 'moment-timezone';
import * as uuid from 'uuid';

import Reporter, { defaultReporterConfig } from '../src/Reporter';
import Span from '../src/Span';
import { defaultConfig } from '../src/Tracer';
import { Timing, TracerConfiguration, ReporterConfiguration } from '../src/interfaces';

describe(`Reporter`, () => {
  let reporter: Reporter, config: TracerConfiguration, timing: Timing, trace: Span;
  beforeEach(() => {
    jest.useFakeTimers();
    config = {
      ...defaultConfig,
      ...defaultReporterConfig,
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

    reporter = new Reporter(config);
  });

  describe(`constructor`, () => {
    it(`initiates the reporter with the provided config`, () => {
      expect((reporter as any).config).toMatchObject(config);
    });

    it(`kicks off a new interval to evaluate flushes`, () => {
      expect((reporter as any).interval).toBeTruthy;
    });
  });

  describe(`reportTiming`, () => {
    it(`adds the timing to the timings queue`, async () => {
      await reporter.reportTiming(timing);
      expect((reporter as any).timings).toHaveLength(1);
    });

    it(`adds an id to the timing if it doesn't already have one`, async () => {
      delete timing.id;
      await reporter.reportTiming(timing);
      expect((reporter as any).timings.buffer[0].id).toBeDefined;
    });
  });

  describe(`reporterTrace`, () => {
    it(`adds the trace to the array of traces`, async () => {
      await reporter.reportTrace(trace);
      expect((reporter as any).traces).toHaveLength(1);
    });
  });

  describe(`flushIfNeeded`, () => {
    it(`it calls flush if it's not already flushing and it has items to flush`, async () => {
      (reporter as any).timings.buffer = [timing];
      reporter.flush = jest.fn();
      await reporter.flushIfNeeded();
      expect(reporter.flush).toHaveBeenCalled;
    });

    it(`it doesn't call flush if it's already flushing`, async () => {
      (reporter as any).timings.buffer = [timing];
      reporter.flush = jest.fn();
      (reporter as any).isFlushing = true;
      await reporter.flushIfNeeded();
      expect(reporter.flush).not.toHaveBeenCalled;
    });

    it(`it doesn't call flush if the last flush time was too recent`, async () => {
      (reporter as any).timings.buffer = [timing];
      reporter.flush = jest.fn();
      (reporter as any).lastFlush = moment().subtract(2, 'seconds').toISOString();
      await reporter.flushIfNeeded();
      expect(reporter.flush).not.toHaveBeenCalled;
    });
  });

  describe(`startFlush`, () => {
    it(`sets 'isFlushing' to true`, () => {
      reporter.startFlush();
      expect((reporter as any).isFlushing).toBe(true);
    });
  });

  describe(`endFlush`, () => {
    it(`sets 'isFlushing' to false`, () => {
      (reporter as any).isFlushing = true;
      reporter.endFlush();
      expect((reporter as any).isFlushing).toBe(false);
      expect((reporter as any).lastFlushTime).not.toBeNull;
    });
  });

  describe(`removeFromQueue`, () => {
    it(`removes the specified timings from the queue`, () => {
      (reporter as any).timings.buffer = [timing];
      reporter.removeFromQueue([timing], []);
      expect((reporter as any).timings).toHaveLength(0);
    });

    it(`removes the specified traces from the queue`, () => {
      (reporter as any).traces.buffer = [trace];
      reporter.removeFromQueue([], [trace]);
      expect((reporter as any).traces).toHaveLength(0);
    });
  });

  describe(`forceFlush`, () => {
    it(`calls 'flush'`, async () => {
      reporter.flush = jest.fn();
      await reporter.forceFlush();
      expect(reporter.flush).toHaveBeenCalled;
    });
  });

  describe(`flush`, () => {
    it(`calls 'startFlush'`, async () => {
      reporter.startFlush = jest.fn();
      await reporter.flush();
      expect(reporter.startFlush).toHaveBeenCalled;
    });

    it(`doesn't call our flushHandler if there's nothing to flush`, async () => {
      (reporter as any).config.flushHandler = jest.fn();
      await reporter.flush();
      expect((reporter as any).config.flushHandler).not.toHaveBeenCalled;
    });

    it(`does call our flushHandler if there are items to be flushed`, async () => {
      (reporter as any).config.flushHandler = jest.fn();
      (reporter as any).timings.buffer = [timing];
      await reporter.flush();
      expect((reporter as any).config.flushHandler).toHaveBeenCalled;
    });
  });

  describe(`queueSizes`, () => {
    it(`returns the correct size for each queue`, () => {
      (reporter as any).timings.buffer = [timing];
      (reporter as any).traces.buffer = [trace];
      expect(reporter.queueSizes).toMatchObject({ traces: 1, timings: 1 });
    });
  });

  it(`flushes at the correct frequency`, () => {
    reporter.flush = jest.fn();

    reporter.reportTiming(timing);
    reporter.reportTrace(trace);
    (reporter as any).lastFlush = null;
    jest.runTimersToTime((reporter as any).config.evaluateFlushIntervalSeconds * 1000 * 5);

    expect(reporter.flush).toHaveBeenCalledTimes(1);
  });

  it(`logs any errors encountered while flushing`, async () => {
    console.error = jest.fn();
    (reporter as any).timings.buffer = [timing];
    (reporter as any).traces.buffer = [trace];
    const error = new Error('Foo Bar');
    reporter.removeFromQueue = () => {
      throw error;
    };
    await reporter.flush();
    expect(console.error).toHaveBeenCalledWith(`Error encountered while flushing items:\n`, error);
  });
});
