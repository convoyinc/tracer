import * as _ from 'lodash';

/**
 * A helper for building a method decorator, and dealing with all the common
 * crap when doing so.
 *
 */
export function makeMethodDecorator<TFunction extends Function>(decorator:TFunction) {
  return (_target:any, _name:string, descriptor:PropertyDescriptor & { initializer: Function }) => {
    const { value, initializer } = descriptor;
    const origMethod = _.isFunction(value)
      ? value
      : initializer;

    if (!origMethod) {
      throw new Error(`Method decorators must decorate …methods`);
    }

    descriptor.value = function decoratedMethod(...args:any[]) {
      return decorator.call(this, origMethod.bind(this), ...args);
    };
  };
}
