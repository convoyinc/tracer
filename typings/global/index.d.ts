declare namespace NodeJS {
  export interface Global {
    requestIdleCallback: (
      callback:(...args:any[]) => void,
      options?:{ timeout?: number },
    ) => void;
  }
}
