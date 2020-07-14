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