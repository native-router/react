let i = 1;
export function uniqId() {
  return i++;
}

export function createCurrentGuard() {
  let current: number | undefined;
  return [
    function currentGuard<T>(promise: Promise<T>): Promise<T> {
      const cur = uniqId();
      current = cur;
      return promise.then((result) =>
        current === cur ? result : new Promise(() => {})
      );
    },
    function cancel() {
      current = undefined;
    }
  ] as const;
}
