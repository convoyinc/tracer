import * as _ from 'lodash';

import Span from './Span';
import Tracer from './Tracer';
import { SpanMeta, SpanTags, TracerConfiguration } from './interfaces';
import { ReporterConfiguration } from './index';

export type AnnotatorFunction = (span: Span, ...args: any[]) => void;
export type ErrorAnnotatorFunction = (span: Span|typeof Span.NoOp, error: Error, ...args: any[]) => void;

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

export type Metadata = SpanMeta;

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
  name: defaultName,
  tracerConfig,
  contextArgumentPosition,
  errorAnnotator,
}:{
  service:string,
  name?:string,
  tracerConfig:TracerConfiguration,
  contextArgumentPosition?:number,
  errorAnnotator?:ErrorAnnotatorFunction,
}) {
  return function traceDecorator({
    resource,
    service,
    name,
    annotator,
    metadata,
    tags,
    context,
  }:{
    resource?:string,
    service?:string,
    name?:string,
    annotator?:AnnotatorFunction,
    metadata?:SpanMeta,
    tags?:SpanTags,
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
          name: name || defaultName,
          annotator,
          errorAnnotator,
          metadata,
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
  name: defaultName = 'unknownTracedFunction',
  tracerConfig,
  contextArgumentPosition,
  errorAnnotator,
}:{
  service:string,
  name?:string,
  tracerConfig:TracerConfiguration,
  contextArgumentPosition?:number,
  errorAnnotator?:ErrorAnnotatorFunction,
}) {
  return function trace({
    resource,
    service,
    name,
    annotator,
    metadata,
    tags,
    context,
  }:{
    resource?:string,
    service?:string,
    name?:string,
    annotator?:AnnotatorFunction,
    metadata?:SpanMeta,
    tags?:SpanTags,
    context?: Context,
  } = {}) {
    return (tracedFunction:Function) => {
      return async (...args:any[]) => {
        return traceFunction({
          resource,
          service: service || defaultService,
          tracerConfig,
          contextArgumentPosition,
          name: name || defaultName,
          annotator,
          errorAnnotator,
          metadata,
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
  errorAnnotator = baseErrorAnnotator,
  metadata,
  tags,
  context,
  args,
  tracedFunction,
}:{
  resource:string,
  service:string,
  tracerConfig:TracerConfiguration,
  contextArgumentPosition?:number,
  args:any[],
  tracedFunction:Function,
  name:string,
  annotator:(span:Span, ...args:any[]) => void,
  errorAnnotator?:ErrorAnnotatorFunction,
  metadata?:SpanMeta,
  tags?:SpanTags,
  context?: Context,
}) {

  context = args[contextArgumentPosition] || context || { _contextObject: true };

  if(_.isNumber(contextArgumentPosition)) {
    args[contextArgumentPosition] = context;
  }

  if (!context || !context._contextObject) {
    throw new Error(`tracing requires the argument at position ${contextArgumentPosition} to be a context object`);
  }

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
    result = tracedFunction.call(this, ...args);
  } catch (error) {
    span.setError(error);
    postFunction({ span, context, annotator, metadata, tags, args });
    throw error;
  }
  if (isPromiselike(result)) {
    result.then(
      () => {
        postFunction({ span, context, annotator, metadata, tags, args });
      },
      (error:Error) => {
        errorAnnotator(span, error, ...args);
        postFunction({ span, context, annotator, metadata, tags, args });
      }
    );
  } else {
    postFunction({ span, context, annotator, metadata, args });
  }
  return result;
}

function postFunction({
  span,
  context,
  annotator,
  metadata,
  tags,
  args,
}:{
  span:any,
  context:Context,
  annotator:AnnotatorFunction,
  metadata?:SpanMeta,
  tags?:SpanTags,
  args?:any[],
}) {
  if (span && span !== Span.NoOp) {
    if (metadata) {
      span.setMeta(metadata);
    }
    if (tags) {
      span.setTags(tags);
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

function baseErrorAnnotator(span:Span|typeof Span.NoOp, error:Error) {
  span.setError(error);
}
