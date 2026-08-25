import {Component, type ReactNode} from 'react';
import type {Context, Route} from '@@/types';
import type {RouterInstance} from '@native-router/core';

type Props = {
  route: Route;
  ctx: Context<Route>;
  router: RouterInstance<Route, ReactNode>;
  children: ReactNode;
};

type State = {error?: Error};

/**
 * Route-level render error boundary: catches errors thrown while the
 * level's component subtree renders and shows the route's
 * `errorComponent` with `ctx.phase === 'render'` — the render-phase
 * twin of the resolve-phase fallback in resolve-view. Just like the
 * browser renders an error page for any failed load, no rendering error
 * of a resolved view should crash past its route.
 *
 * Without a route `errorComponent` the error goes to the global
 * `errorHandler`: a returned view renders in place, while the default
 * handler(plain rejection) and async fallbacks rethrow, resurfacing the
 * error up the React tree like any unhandled error.
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  render() {
    const {error} = this.state;
    if (!error) return this.props.children;
    const {route, ctx, router} = this.props;
    const ErrorComponent = route.errorComponent;
    if (ErrorComponent) {
      return <ErrorComponent error={error} ctx={{...ctx, phase: 'render'}} />;
    }
    // No route-level fallback: hand the error to the global errorHandler.
    // An async fallback cannot render synchronously; observe its rejection
    // and resurface the error itself instead.
    const fallback = router.errorHandler?.(error);
    if (fallback instanceof Promise) {
      fallback.catch(() => undefined);
      throw error;
    }
    if (fallback !== undefined) return fallback;
    throw error;
  }
}
