import {
  Tracer,
  Reporter,
  Span,
  traceFunc,
  createTraceDecorator,
  createTraceFunction,
} from '../src';

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

describe(`createTraceDecorator`, () => {
  let reporter: Reporter, trace, mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mock = jest.fn();
    reporter = new Reporter({ flushHandler: mock });

    trace = createTraceDecorator({
      service: 'FooService',
      tracerConfig: {
        sampleRate: 1,
        reporter,
      },
      contextArgumentPosition: 1,
    });
  });

  it(`can wrap a class method`, () => {
    class Something {
      @trace()
      doSomething(_args:any, context?:any) {
        let x = 1;
        x++;
      }
    }
    const something = new Something();

    something.doSomething(1);
    jest.runTimersToTime((reporter as any).config.flushIntervalSeconds * 1000);

    expect(mock).toHaveBeenCalledTimes(1);
    const traces = mock.mock.calls[0][0];
    expect(traces[0].service).toEqual('FooService');
    expect(typeof traces[0].traceId).toEqual('number');
    expect(typeof traces[0].duration).toEqual('number');
    expect(typeof traces[0].start).toEqual('number');
    expect(traces[0].error).toEqual(0);
  });
});
