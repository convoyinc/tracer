import * as _ from 'lodash';
import * as lolex from 'lolex';

import Span from '../src/Span';

describe(`Span`, () => {
  let name, resource, service, span: Span;
  beforeEach(() => {
    name = 'SpanName';
    resource = 'SomeFn';
    service = 'SomeService';
    span = new Span(resource, name, service);
  });

  describe(`#constructor`, () => {
    it(`creates a new Span instance with the provided name, resource and service`, () => {
      expect(span.name).toBe(name);
      expect(span.resource).toBe(resource);
      expect(span.service).toBe(service);
    });

    it(`sets the start time when it initializes the span`, () => {
      expect(span.start).toBeGreaterThan(0);
    });
  });

  describe(`newChild`, () => {
    it(`adds the new child span to the parent's 'children' array`, () => {
      span.newChild(resource, name, service);
      expect(span.children).toHaveLength(1);
      expect(span.children[0].name).toBe(name);
    });
  });

  describe(`setMeta`, () => {
    let meta;
    beforeEach(() => {
      meta = { foo: 'bar' };
      span.setMeta(meta);
    });

    it(`adds the metadata to the 'meta' property`, () => {
      expect(span.meta).toMatchObject(meta);
    });

    it(`adds the metadata to any existing metadata`, () => {
      const newMeta = { bar: 'foo' };
      span.setMeta(newMeta);
      expect(span.meta).toMatchObject({ ...meta, ...newMeta });
    });

    it(`removes metadata with non-primitive values`, () => {
      const nonPrimitive = { bar: { baz: 'qux' } };
      span.setMeta(nonPrimitive as any);
      expect(span.meta).toMatchObject(meta);
      expect(span.meta).not.toMatchObject(nonPrimitive);
    });

    it(`doesn't add anything if you pass it an empty object`, () => {
      const emptyMeta = {};
      span.meta = {};
      span.setMeta(emptyMeta);
      expect(span.meta).toMatchObject(emptyMeta);
    });
  });

  describe(`setTags`, () => {
    let tags;
    beforeEach(() => {
      tags = { foo: 'bar' };
      span.setTags(tags);
    });

    it(`adds the tags to the 'tags' property`, () => {
      expect(span.tags).toMatchObject(tags);
    });

    it(`adds the tags to any existing tags`, () => {
      const newTags = { bar: 'foo' };
      span.setTags(newTags);
      expect(span.tags).toMatchObject({ ...tags, ...newTags });
    });

    it(`removes tags with non-primitive values`, () => {
      const nonPrimitive = { bar: { baz: 'qux' } };
      span.setTags(nonPrimitive as any);
      expect(span.tags).toMatchObject(tags);
      expect(span.tags).not.toMatchObject(nonPrimitive);
    });

    it(`doesn't add anything if you pass it an empty object`, () => {
      const emptyTags = {};
      span.tags = {};
      span.setTags(emptyTags);
      expect(_.keys(span.tags)).toEqual([]);
    });
  });

  describe(`setError`, () => {
    let error, errorMessage;
    beforeEach(() => {
      errorMessage = 'Some foo error';
      error = new Error(errorMessage);
      span.setError(error);
    });

    it(`sets the 'error' property to '1'`, () => {
      expect(span.error).toBe(1);
    });

    it(`adds the error metadata to the 'metadata' property`, () => {
      expect(span.meta).toMatchObject({
        'error.name': 'Error',
        'error.message': errorMessage,
      });
    });

    it(`adds the error tags to the 'tags' property`, () => {
      expect(span.tags).toMatchObject({
        'error.name': 'Error',
        error: '1',
      });
    });
  });

  describe(`end`, () => {
    it(`records the duration`, () => {
      span.end();
      expect(span.duration).toBeGreaterThan(0);
    });

    it(`allows you to pass it a custom end time`, () => {
      const customEndTime = span.start + 1000;
      span.end(customEndTime);
      expect(span.duration).toBeCloseTo(1000);
    });

    it(`sets the 'unbalanced' meta property to true if we've already ended`, () => {
      span.end();
      expect(span.hasEnded).toBe(true);
      span.end();
      expect(span.meta).toMatchObject({
        'span.unbalanced': 'true',
      });
    });

    it(`ends all child spans that aren't already ended`, () => {
      const children = [
        new Span(resource, name, service).end(),
        new Span(resource, name, service),
        new Span(resource, name, service),
      ];
      span.children = children;
      span.end();
      _.forEach(span.children, child => {
        expect(child.hasEnded).toBe(true);
      });
    });
  });

  describe(`removeShortSpans`, () => {
    let thresholdMs;
    beforeEach(() => {
      thresholdMs = 5;
      const children = _.times(5, () => _.cloneDeep(span));
      _.forEach(children, child => (child.duration = 6));
      children[0].duration = 3;
      span.children = children;
    });

    it(`removes all spans with a duration not exceeding the threshold`, () => {
      span.removeShortSpans(thresholdMs);
      expect(span.children).toHaveLength(4);
    });

    it(`doesn't remove any children if you don't provide it with a threshold`, () => {
      (span as any).removeShortSpans();
      expect(span.children).toHaveLength(5);
    });
  });

  describe(`hasEnded`, () => {
    it(`returns true if the span has ended`, () => {
      span.end();
      expect(span.hasEnded).toBe(true);
    });

    it(`returns false if the span hasn't ended`, () => {
      expect(span.hasEnded).toBe(false);
    });
  });

  describe(`NoOp`, () => {
    it(`returns true for 'hasEnded'`, () => {
      expect(Span.NoOp.hasEnded).toBe(true);
    });

    it(`returns the class for every other property`, () => {
      _.forIn(_.omit(Span.prototype, 'hasEnded'), (fn, key) => {
        expect(_.invoke(Span.NoOp, key)).toBe(Span);
      });
    });
  });

  describe(`duration`, () => {
    let clock: lolex;

    beforeAll(() => {
      clock = lolex.install();
    });

    beforeEach(() => {
      span = new Span(resource, name, service);
    });

    afterAll(() => {
      clock.uninstall();
    });

    it(`returns the correct duration`, () => {
      clock.tick(1337);
      span.end();
      expect(span.duration).toBeCloseTo(1337);
    });

    it(`takes the longer time in an unbalanced span`, () => {
      clock.tick(1000);
      span.end();
      clock.tick(1000);
      span.end();
      expect(span.duration).toBeCloseTo(2000);
    });
  });
});
