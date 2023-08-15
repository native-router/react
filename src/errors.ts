/* eslint-disable max-classes-per-file */

export class NativeRouterError extends Error {}

export class NotFoundError extends NativeRouterError {
  constructor(pathname: string) {
    super(`Can't find the path: ${pathname}`);
  }
}
