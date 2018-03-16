import * as _ from 'lodash';

import Reporter from '../src/Reporter';
import Span from '../src/Span';
import Tracer from '../src/Tracer';
import { defaultConfig } from '../src/Tracer';
import { TracerConfiguration } from '../src/interfaces';

describe(`Trace`, () => {
  let tracer: Tracer, config: TracerConfiguration, span: Span, resource, name, service;

  beforeEach(() => {
    config = {
      globalProperties: () => ({
        foo: 'bar',
      }),
      flushHandler: async (...args: any[]) => args,
    };
    resource = 'FooResource';
    name = 'FooName';
    service = 'FooService';

    span = new Span(resource, name, service);
    tracer = new Tracer(config);
  });

  describe(`constructor`, () => {
    it(`initializes the tracer service with the provided config`, () => {
      expect((tracer as any).config).toMatchObject(config);
    });

    it(`initializes a queue`, () => {
      expect((tracer as any).reporter).toBeInstanceOf(Reporter);
    });
  });

  describe(`start`, () => {
    it(`returns the current trace if one isn't already started`, () => {
      const trace = tracer.start(resource, name);
      expect(trace).toBeInstanceOf(Span);
    });

    it(`adds an error to the current trace if we try to start another one`, () => {
      const trace = tracer.start(resource, name, service);
      tracer.start(resource, name);
      expect(trace.error).toBe(1);
      expect(trace.meta['error.message']).toMatch(/called when another trace was active/);
    });
  });

  describe(`startTopLevelSpan`, () => {
    it(`returns a new top level span if there is already a tracer started`, () => {
      tracer.start(resource, name);
      const topLevelSpan = tracer.startTopLevelSpan(resource, name, service);
      expect(topLevelSpan).toBeInstanceOf(Span);
    });

    it(`returns a noop if there isn't a trace started`, () => {
      const topLevelSpan = tracer.startTopLevelSpan(resource, name, service);
      expect(topLevelSpan).toBe(Span.NoOp);
    });
  });

  describe(`startNestedSpan`, () => {
    it(`returns a new nested span if there is already a tracer started`, () => {
      tracer.start(resource, name);
      const nestedSpan = tracer.startNestedSpan(resource, name, service);
      expect(nestedSpan).toBeInstanceOf(Span);
    });

    it(`doesn't add the span to the stack if it's a noop`, () => {
      tracer.start(resource, name);
      tracer.startSpan = () => Span.NoOp;
      const nestedSpan = tracer.startNestedSpan(resource, name, service);
      expect(nestedSpan).toBe(Span.NoOp);
      expect((tracer as any).spanStack).toHaveLength(1);
    });
  });

  describe(`getNestedSpan`, () => {
    it(`returns the last span on the stack that hasn't ended`, () => {
      tracer.start(resource, name);
      const nestedSpanOne = tracer.startNestedSpan(resource, name, service);
      const nestedSpanTwo = tracer.startNestedSpan(resource, name, service);
      nestedSpanTwo.end();
      expect(tracer.getNestedSpan()).toBe(nestedSpanOne);
    });
  });

  describe(`isInTrace`, () => {
    it(`returns true if the resource and name match the trace`, () => {
      tracer.start(resource, name);
      expect(tracer.isInTrace(resource, name)).toBe(true);
    });

    it(`returns false if the resource and name don't match the trace`, () => {
      tracer.start(resource, name);
      expect(tracer.isInTrace('foo', 'bar')).toBe(false);
    });

    it(`returns false if there isn't a current trace started`, () => {
      expect(tracer.isInTrace(resource, name)).toBe(false);
    });
  });

  describe(`end`, () => {
    it(`ends the current trace and returns it`, () => {
      tracer.start(resource, name);
      const ended = tracer.end();
      expect(ended).toBeInstanceOf(Span);
      expect(ended.hasEnded).toBe(true);
    });

    it(`returns nothing if there isn't currently a trace`, () => {
      const ended = tracer.end();
      expect(ended).toBeFalsy;
    });
  });

  describe(`endIf`, () => {
    it(`ends the trace if the name/resource match`, () => {
      tracer.start(resource, name);
      const ended = tracer.endIf(resource, name);
      expect(ended).toBeInstanceOf(Span);
      expect(ended.hasEnded).toBe(true);
    });

    it(`doesn't end the trace if the name/resource doesn't match`, () => {
      tracer.start(resource, name);
      const ended = tracer.endIf('foo', 'bar');
      expect(ended).toBeFalsy;
      expect(tracer.get().hasEnded).toBe(false);
    });
  });

  describe(`recordTrace`, () => {
    it(`doesn't queue the trace if a random float isn't greater than the sampling rate`, () => {
      tracer.start(resource, name);
      (tracer as any).reporter.reportTrace = jest.fn();
      Math.random = () => 0;
      tracer.recordTrace(tracer.get());
      expect((tracer as any).reporter.reportTrace).not.toHaveBeenCalled;
    });

    it(`does queue the trace if a random float is greater than the sampling rate`, () => {
      tracer.start(resource, name);
      (tracer as any).reporter.reportTrace = jest.fn();
      Math.random = () => 1;
      tracer.recordTrace(tracer.get());
      expect((tracer as any).reporter.reportTrace).toHaveBeenCalled;
    });

    it(`calls 'recordSpanTiming' for the trace and each of its children`, () => {
      (tracer as any).recordSpanTiming = jest.fn();
      tracer.start(resource, name);
      const trace = tracer.get();
      trace.children = [span];
      tracer.recordTrace(trace);
      expect((tracer as any).recordSpanTiming.mock.calls[0][0]).toBe(trace);
      expect((tracer as any).recordSpanTiming.mock.calls[1][0]).toBe(span);
    });
  });

  describe(`recordSpanTiming`, () => {
    it(`allows you to pass it extra metadata`, () => {
      (tracer as any).reporter.reportTiming = jest.fn();
      const extraTags = { baz: 'qux' };
      (tracer as any).recordSpanTiming(span, extraTags);
      expect((tracer as any).reporter.reportTiming.mock.calls[0][0].tags).toMatchObject(
        extraTags,
      );
    });

    it(`allows you to pass it a custom prefix`, () => {
      (tracer as any).reporter.reportTiming = jest.fn();
      const prefix = 'fooBarPrefix';
      (tracer as any).recordSpanTiming(span, {}, prefix);
      expect((tracer as any).reporter.reportTiming.mock.calls[0][0].name).toMatch(
        new RegExp(prefix),
      );
    });
  });

  describe(`globalTags`, () => {
    it(`works if you provide it with a function`, () => {
      const globalTags = { baz: 'quux' };
      (tracer as any).config.globalTags = () => globalTags;
      (tracer as any).recordSpanTiming(span);
      expect((tracer as any).reporter.timings.buffer[0].tags).toMatchObject(globalTags);
    });

    it(`works if you provide it with an object`, () => {
      const globalTags = { baz: 'quux' };
      (tracer as any).config.globalTags = globalTags;
      (tracer as any).recordSpanTiming(span);
      expect((tracer as any).reporter.timings.buffer[0].tags).toMatchObject(globalTags);
    });
  });
});
