import * as _ from 'lodash';

import Span from './Span';
import Tracer from './Tracer';
import { TracerConfiguration } from './interfaces';
import { ReporterConfiguration } from './index';

export type AnnotatorFunction = (span: Span, ...args: any[]) => void;

export interface TraceFuncArgs {
  tracer: Tracer;
  context: any;
  name: string;
  resource: string;
  service?: string;
  annotator?: AnnotatorFunction;
}

export interface Context {
  _contextObject: true,
  tracer?: Tracer,
}

export interface Tags {
  [key:string]:string,
}

export function traceFunc({
  tracer,
  context,
  service,
  resource,
  name,
  annotator = _.noop,
}: TraceFuncArgs) {
  if (!name) {
    throw new Error(`You must pass both a context and a function key/name to 'traceFunc'`);
  }
  const origFunction = context[name];
  context[name] = function tracedFunction(...args: any[]) {
    const span = tracer.get() ? tracer.startNestedSpan(resource, name, service) : null;
    try {
      return origFunction.apply(this, args);
    } finally {
      if (span && span !== Span.NoOp) {
        span.end();
        annotator(span as Span, ...args);
      }
    }
  };
}

export function createTraceDecorator({
  service: defaultService,
  tracerConfig,
  contextArgumentPosition = 1,
}:{
  service:string,
  tracerConfig:TracerConfiguration & ReporterConfiguration,
  contextArgumentPosition:number,
}) {
  return function traceDecorator({
    resource,
    service,
    name,
    annotator,
    tags,
    context,
  }:{
    resource?:string,
    service?:string,
    name?:string,
    annotator?:AnnotatorFunction,
    tags?:Tags,
    context?: Context,
  } = {}) {
    return (_target:any, _key?:string, descriptor?:PropertyDescriptor):any => {
      const tracedFunction = descriptor.value;
      descriptor.value = function traceDecorator(...args:any[]) {
        return traceFunction.call(this, {
          resource,
          service: service || defaultService,
          tracerConfig,
          contextArgumentPosition,
          name,
          annotator,
          tags,
          context,
          args,
          tracedFunction,
        });
      };
    };
  };
}

export function createTraceFunction({
  service: defaultService,
  tracerConfig,
  contextArgumentPosition = 1,
}:{
  service:string,
  tracerConfig:TracerConfiguration & ReporterConfiguration,
  contextArgumentPosition:number,
}) {
  return function trace({
    resource,
    service,
    name,
    annotator,
    tags,
    context,
  }:{
    resource?:string,
    service?:string,
    name?:string,
    annotator?:AnnotatorFunction,
    tags?:Tags,
    context?: Context,
  } = {}) {
    return (tracedFunction:Function) => {
      return async (...args:any[]) => {
        return traceFunction({
          resource,
          service: service || defaultService,
          tracerConfig,
          contextArgumentPosition,
          name,
          annotator,
          tags,
          context,
          args,
          tracedFunction,
        });
      };
    };
  };
}

function traceFunction({
  resource,
  service,
  tracerConfig,
  contextArgumentPosition,
  name,
  annotator,
  tags,
  context,
  args,
  tracedFunction,
}:{
  resource:string,
  service:string,
  tracerConfig:TracerConfiguration & ReporterConfiguration,
  contextArgumentPosition:number,
  args:any[],
  tracedFunction:Function,
  name:string,
  annotator:(span:Span, ...args:any[]) => void,
  tags?:Tags,
  context?: Context,
}) {
  if (args.length > contextArgumentPosition + 1 || args.length < contextArgumentPosition) {
    throw new Error(`tracing can only be applied to function with ${contextArgumentPosition} arguments ` +
      `and an optional context argument`);
  }

  context = context || args[contextArgumentPosition];

  if (context === undefined) {
    context = { _contextObject: true };
  }

  if (!context || !context._contextObject) {
    throw new Error(`tracing requires the argument at position ${contextArgumentPosition} to be a context object`);
  }

  args = context ? args.slice(0, args.length - 1) : args;
  name = name || tracedFunction.name;

  let span:Span|typeof Span.NoOp;
  if (context.tracer) {
    resource = resource || context.tracer.get().resource;
    span = context.tracer.startNestedSpan(resource, name, service);
  } else {
    context.tracer = new Tracer(tracerConfig);
    resource = resource || tracedFunction.name;
    span = context.tracer.start(resource, name, service);
  }

  // Note that we are *not* chaining .then().catch(),
  // or handling postPromise inside the try
  // as we do not want to "catch" errors thrown
  // by our record() call (as it would misleadingly
  // show up as coming from the instrumented call).
  let result;
  try {
    result = tracedFunction.call(this, ...args, context);
  } catch (error) {
    span.setError(error);
    postFunction({ span, context, annotator, tags, args });
    throw error;
  }
  if (isPromiselike(result)) {
    result.then(
      () => {
        postFunction({ span, context, annotator, tags, args });
      },
      (error:Error) => {
        span.setError(error);
        postFunction({ span, context, annotator, tags, args });
      }
    );
  } else {
    postFunction({ span, context, annotator, tags, args });
  }
  return result;
}

function postFunction({
  span,
  context,
  annotator,
  tags,
  args,
}:{
  span:any,
  context:Context,
  annotator:AnnotatorFunction,
  tags?:Tags,
  args?:any[],
}) {
  if (span && span !== Span.NoOp) {
    if (tags) {
      span.setMeta(tags);
    }
    if (annotator) {
      annotator(span, ...args);
    }
  }
  if (context.tracer.get() === span) {
    context.tracer.end();
  } else if (span && span !== Span.NoOp) {
    span.end();
  }
}

export function isPromiselike(maybePromise: any): boolean {
  return maybePromise && _.isFunction(maybePromise.then) && _.isFunction(maybePromise.catch);
}
