/* eslint-disable import/prefer-default-export */
export function sleep(interval: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, interval);
  });
}
