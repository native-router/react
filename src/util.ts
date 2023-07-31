let i = 1;
export function uniqId() {
  return i++;
}

export function noop() {}

export const resolve = /* @__PURE__ */ Promise.resolve.bind(Promise);
export const reject = /* @__PURE__ */ Promise.reject.bind(Promise);

export function cancelPromise() {
  return new Promise(noop);
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
