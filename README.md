# Tracer

[![Build Status](https://img.shields.io/circleci/project/github/convoyinc/tracer/master.svg)](https://circleci.com/gh/convoyinc/workflows/tracer)
[![codecov](https://codecov.io/gh/convoyinc/tracer/branch/master/graph/badge.svg)](https://codecov.io/gh/convoyinc/tracer)

> A tracing library for node and the browser that conforms to DataDog's Tracing API.

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
import Tracer, { TracerConfiguration, FlushFunction } from '@convoy/tracer';

const tracer = new Tracer({
  fullTraceSampleRate: 1 / 10,
  minimumDurationMs: 10,
  // Note: If you provide a custom 'Reporter', you don't need to provide a 'flushHandler'
  flushHandler:FlushFunction = (timings, traces) => {
    // Do something here
  },
});
```

You can also use a custom reporter if you'd like to manage the queueing and reporting yourself:

```ts
import Tracer, { AbstractReporter, Span, Timing } from '@convoy/tracer';

class CustomReporter implements AbstractReporter {
  reportTiming(timing: Timing) { /* Your implementation */ }
  reportTrace(trace: Span) { /* Your implementation */ }
}

const tracer = new Tracer({
  reporter: new CustomReporter(),
});
```
