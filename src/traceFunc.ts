import * as _ from 'lodash';

import Span from './Span';
import Tracer from './Tracer';
import { TraceFuncArgs } from './interfaces';

export default function traceFunc({
  tracer,
  context,
  service,
  resource,
  name,
  annotator = _.noop,
}: TraceFuncArgs) {
  if (!name) {
    throw new Error(
      `You must pass both a context and a function key/name to 'traceFunc'`,
    );
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
