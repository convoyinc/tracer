import Tracer from '../src/Tracer';
import traceFunc from '../src/traceFunc';
import Span from '../src/Span';

describe(`traceFunc`, () => {
  let tracer: Tracer, resource, name, service, context;

  beforeEach(() => {
    tracer = new Tracer({ flushHandler: jest.fn() });
    resource = 'FooResource';
    name = 'FooName';
    service = 'FooService';
    tracer.start(resource, name, service);
    context = {
      someFn: function() {
        return true;
      },
    };
  });

  function traceFn() {
    traceFunc({ tracer, context, name: 'someFn', service, resource });
  }

  it(`wraps the provided function`, () => {
    const originalFunction = context.someFn;
    traceFn();
    expect(context.someFn !== originalFunction).toBe(true);
  });

  it(`creates a span when the wrapped function is invoked`, () => {
    expect(tracer.get().children).toHaveLength(0);
    traceFn();
    context.someFn();
    expect(tracer.get().children).toHaveLength(1);
  });

  it(`doesn't try to end the span if it's a noop`, () => {
    tracer.startNestedSpan = () => Span.NoOp;
    traceFn();
    context.someFn();
    expect(tracer.get().children).toHaveLength(0);
  });

  it(`doesn't create a span if there isn't currently an active trace`, () => {
    const trace = tracer.get();
    (tracer as any).get = () => undefined;
    traceFn();
    context.someFn('test');
    expect(trace.children).toHaveLength(0);
  });

  it(`blows up if you don't pass it a function name`, () => {
    let error;
    try {
      traceFunc({ tracer, context, service, resource } as any);
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeUndefined;
    expect(error.message).toMatch(/You must pass both a context and a function key/);
  });

  it(`will annotate the span with any user-provided annotator function`, () => {
    const meta = { foo: 'baz' };
    const annotator = (span: Span) => span.setMeta(meta);
    traceFunc({ tracer, context, name: 'someFn', service, resource, annotator } as any);
    context.someFn();
    expect(tracer.get().children[0].meta).toMatchObject(meta);
  });
});
