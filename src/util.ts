export function createCurrentGuard() {
  let current: Symbol | undefined;
  return [
    function currentGuard<T>(promise: Promise<T>) {
      const cur = Symbol('current key');
      current = cur;
      return promise.then((result) => (current === cur ? result : new Promise(() => {})));
    },
    function cancel() {
      current = undefined;
    },
  ] as const;
}

