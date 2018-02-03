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

Create a new instance of tracer:

```ts
import { Reporter, createTraceDecorator } from '@convoy/tracer';

const apiReporter = new Reporter({
  flushHandler: async (_timings, traces) => {
    return await client.mutate({
      mutation: reportTraces,
      variables: {
        timings: [],
        traces,
      },
    });
  },
});

export const trace = createTraceDecorator({
  service: __CONFIG__.service,
  reporter: apiReporter,
  tracerConfig: {
    fullTraceSampleRate: 1,
    reporter: apiReporter,
  },
});

@trace()
function doSomething({ foo, bar}) {
  // Traced function
}

```
