import sinon from 'sinon';

// https://github.com/testing-library/react-testing-library/issues/1197
// eslint-disable-next-line import/prefer-default-export
export function useFakeTimers(...args: Parameters<typeof sinon.useFakeTimers>) {
  const sinonClock = sinon.useFakeTimers.call(sinon, ...args);

  // @ts-expect-error
  globalThis.jest = {
    advanceTimersByTime: sinonClock.tickAsync.bind(sinonClock)
  };

  const restore = sinonClock.restore.bind(sinonClock);
  sinonClock.restore = function () {
    // @ts-expect-error
    delete globalThis.jest;
    return restore();
  };
  return sinonClock;
}
