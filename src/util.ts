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

export function splitProps<
  T extends object = object,
  K extends keyof T = keyof T
>(obj: T, keys: K[]): [Pick<T, K>, Omit<T, K>] {
  const picked = {} as any;
  const rest = {...obj};
  keys.forEach((key) => {
    picked[key] = rest[key];
    delete rest[key];
  });
  return [picked, rest];
}
