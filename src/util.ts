let i = 1;
export function uniqId() {
  return i++;
}

export function cancelPromise() {
  return new Promise(() => {});
}

export function createCurrentGuard() {
  let current: number | undefined;
  return [
    function currentGuard<T>(promise: Promise<T>): Promise<T> {
      const cur = uniqId();
      current = cur;
      return promise
        .then((result) =>
          current === cur ? result : (cancelPromise() as Promise<T>)
        )
        .catch((err) =>
          current === cur
            ? Promise.reject(err)
            : (cancelPromise() as Promise<T>)
        );
    },
    function cancel() {
      current = undefined;
    }
  ] as const;
}
