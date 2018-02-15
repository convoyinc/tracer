# Tracer

[![Build Status](https://img.shields.io/circleci/project/github/convoyinc/tracer/master.svg)](https://circleci.com/gh/convoyinc/workflows/tracer)
[![codecov](https://codecov.io/gh/convoyinc/tracer/branch/master/graph/badge.svg)](https://codecov.io/gh/convoyinc/tracer)

> A tracing library for node and the browser that conforms to DataDog's APM Tracing API,
> where there "resource" and "service" concepts are first-class citizens. It also includes
> support for context objects to avoid continuation-local-storage (CLS).

## Install

```sh
# using yarn
yarn add @convoy/tracer

# using npm
npm install --save @convoy/tracer
```

## Usage

### Reporter ###

In order to start tracing, a project (client or server) should
start by creating a new instance of a Reporter, which defines how a trace should
get reported to Datadog or other APM service. For front-end clients, this
typically involves a service call which passes the trace along to the APM agent.
For NodeJS services, consider using [@convoy/datadog](https://github.com/convoyinc/datadog).


```ts
import { Reporter } from '@convoy/tracer';

const apiReporter = new Reporter({
  flushHandler: async (timings, traces) => {
    return await fetch({...});
  },

});
```

The reporter will call `flushHandler` if there are any traces to report on the next [`requestIdleCallback`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback) (browser) after recording the trace or every `flushIntervalSeconds`.

### Trace Decorator ###
Decorators are a convenient way to add tracing to an app or service. This library exposes a decorator factory function to generate a decorator that can be reused through your app or service. It establishes a default `service` name to use for all traces, specifies the reporter, the sample rate (recommended for frequently called functions) and the ability to configure which argument in the traced function a context object will be read from or created at (nice when the function you are tracing uses a framework that puts the context object at different positions, such as a GQL resolver or Express middleware).

Given JavaScript's asynchronous control flow via an event loop, a context object is an important mechanism to tie APM spans together into one trace without colliding with other async actions that may overlap. This avoids the need to introduce continuation-local-storage which can be difficult to implement and requires some complex monkeypatching.

```ts
import { createTraceDecorator } from '@convoy/tracer';

export const trace = createTraceDecorator({
  service: __CONFIG__.service,
  tracerConfig: {
    fullTraceSampleRate: 1 / 20,
    reporter: apiReporter,
  },
  contextArgumentPosition: 1,
});

class Something {
  @trace()
  function doSomething({ foo, bar }, context) {
    // The context object now includes a Tracer object
    // and can generally be ignored
  }
}
```

The trace decorator is a function itself because its supports the ability to override the attributes of the span it generates.

```ts
class Something {
  @trace({
    resource: 'setThing',
    service: 'my-library',
    name: 'Something.doSomething',
    annotator: (span, { foo }) => {
      if (foo) {
        span.setMeta({ isFoo: true });
      },
    tags: {
      clientId,
    },
  })
  function doSomething({ foo, bar }, context) {
    // Traced function
  }
}
```
