import {match as createMatcher} from 'path-to-regexp';
import { Matched, Options, BaseRoute, Router } from './types';

export function create<R extends BaseRoute = BaseRoute>(
  routes: R | R[],
  options: Options = {}
): Router<R> {
  return {
    routes: Array.isArray(routes) ? routes : [routes],
    baseUrl: options.baseUrl || '',
    options
  };
}

export function match<R extends BaseRoute = BaseRoute>(
  router: Router<R>,
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
