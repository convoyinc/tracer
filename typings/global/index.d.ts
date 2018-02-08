import 'path';

declare global {
  namespace NodeJS {
    export interface Global {
      requestIdleCallback: (
        callback:(...args:any[]) => void,
        options?:{ timeout?: number },
      ) => void;
    }
  }
}
