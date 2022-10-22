import {createPath, History, parsePath} from 'history';
import {match as createMatcher} from 'path-to-regexp';
import type {
  Location,
  Matched,
  Options,
  BaseRoute,
  RouterInstance,
  ResolveView,
  HistoryState
} from './types';
import {createCurrentGuard, noop} from './util';

export function create<R extends BaseRoute = BaseRoute, V = any>(
  routes: R | R[],
  history: History,
  resolveView: ResolveView<R, V>,
  options?: Options<V>
): RouterInstance<R, V> {
  const [currentGuard, cancelAll] = createCurrentGuard();

  return {
    routes: Array.isArray(routes) ? routes : [routes],
    resolveView,

    history: history as History<HistoryState>,
    locationStack: [],
    viewStack: [],
    currentGuard,
    cancelAll,

    ...options,
    baseUrl: options?.baseUrl || ''
  };
}

export function match<R extends BaseRoute = BaseRoute>(
  router: RouterInstance<R>,
  pathname: string
) {
  function matchRoutes(
    routes: R[],
    baseUrl: string,
    // eslint-disable-next-line @typescript-eslint/no-shadow
    pathname: string
  ): Matched<R>[] | undefined {
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const end = !route.children;
      const matched = route.path
        ? createMatcher(route.path, {
            strict: true,
            sensitive: true,
            decode:
              typeof decodeURIComponent === 'function'
                ? decodeURIComponent
                : undefined,
            end
          })(pathname)
        : {
            path: '',
            index: 0,
            params: {}
          };

      if (matched) {
        const result = {route, ...matched};
        if (end) return [result];
        const children = matchRoutes(
          route.children!,
          `${baseUrl}${route.path || ''}`,
          pathname.slice(matched.path.length)
        );
        if (children) return [result, ...children];
        return undefined;
      }
    }
    return undefined;
  }

  return matchRoutes(
    router.routes,
    router.baseUrl,
    pathname.slice(router.baseUrl.length)
  );
}

export function toLocation<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>,
  to: string,
  state?: any
): Location {
  const {baseUrl} = router;
  return {
    pathname: '',
    search: '',
    hash: '',
    ...parsePath(baseUrl + to),
    state
  } as Location;
}

export function resolve<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>,
  location: Location
) {
  const matched = match<R>(router, location.pathname);
  if (!matched) return Promise.reject(new Error('Not Found'));

  const {resolveView} = router;
  return resolveView(matched, {router, location}).catch(router.errorHandler);
}

export function resolveTo<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>,
  to: string,
  state?: any
) {
  const location = toLocation(router, to, state);
  return resolve(router, location);
}

export function commit<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>,
  resolvePromise: Promise<V>,
  location: Location
): Promise<void> {
  const {history, currentGuard, onLoadingChange = noop} = router;
  const nextIndex = (history.location.state?.index || 0) + 1;
  if (router.resolving) {
    onLoadingChange();
  }
  router.resolving = location;
  onLoadingChange('pending');
  return currentGuard(resolvePromise)
    .then((resolvedView) => {
      router.locationStack = [
        ...router.locationStack.slice(0, nextIndex),
        location
      ];
      router.viewStack = [
        ...router.viewStack.slice(0, nextIndex),
        resolvedView
      ];
      history.push(location, {
        index: nextIndex,
        locationStack: router.locationStack
      });
      onLoadingChange('resolved');
    })
    .catch((e) => {
      onLoadingChange('rejected');
      throw e;
    });
}

export function commitReplace<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>,
  resolvePromise: Promise<V>,
  location: Location
): Promise<void> {
  const {history, currentGuard, onLoadingChange = noop} = router;
  const index = history.location.state?.index || 0;
  if (router.resolving) {
    onLoadingChange();
  }
  router.resolving = location;
  onLoadingChange('pending');
  return currentGuard(resolvePromise)
    .then((resolvedView) => {
      router.locationStack[index] = location;
      router.viewStack[index] = resolvedView;
      history.replace(location, {
        index,
        locationStack: router.locationStack
      });
      onLoadingChange('resolved');
    })
    .catch((e) => {
      onLoadingChange('rejected');
      throw e;
    });
}

export function navigate<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>,
  to: string,
  state?: any
): Promise<void> {
  const location = toLocation(router, to, state);
  const viewPromise = resolve(router, location);
  return commit(router, viewPromise, location);
}

export function refresh<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>
) {
  const {location} = router.history;
  const viewPromise = resolve(router, location);
  return commitReplace(router, viewPromise, location);
}

export function go<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>,
  delta: number
) {
  router.history.go(delta);
}

export function forward<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>
) {
  router.history.forward();
}

export function back<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>
) {
  router.history.back();
}

export function createHref<R extends BaseRoute = BaseRoute, V = any>(
  {baseUrl, history}: RouterInstance<R, V>,
  to: string
) {
  return baseUrl + history.createHref(to);
}

export function cancel<R extends BaseRoute = BaseRoute, V = any>({
  cancelAll,
  onLoadingChange = noop
}: RouterInstance<R, V>) {
  cancelAll();
  onLoadingChange();
}

export function listen<R extends BaseRoute = BaseRoute, V = any>(
  router: RouterInstance<R, V>,
  onViewChange: (v: V) => void
) {
  const {onLoadingChange = noop, history} = router;
  const locationStack = history.location.state?.locationStack || [
    history.location
  ];
  router.locationStack = locationStack;

  onLoadingChange('pending');
  Promise.all(locationStack.map((l) => resolve(router, l)))
    .then((views) => {
      router.viewStack = views;
      history.replace(createPath(history.location), history.location.state);
      onLoadingChange('resolved');
    })
    .catch((e) => {
      onLoadingChange('rejected');
      throw e;
    });

  const rmListener = history.listen(({action, location}) => {
    cancel(router);

    const index = location.state?.index || 0;
    onViewChange(router.viewStack[index]);

    if (action === 'POP') {
      history.replace(createPath(history.location), {
        ...history.location.state,
        locationStack: router.locationStack
      });
    }
  });
  return () => {
    cancel(router);
    rmListener();
  };
}
