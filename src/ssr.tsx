import {createBrowserHistory, createMemoryHistory, createPath} from 'history';
import {ReactElement, ReactNode} from 'react';
import {create, resolve, toLocation} from '@native-router/core';
import type {
  HistoryState,
  Location,
  Options,
  RouterInstance
} from '@native-router/core';
import {isString} from '@native-router/core/util';
import {Router} from './components/Router';
import {
  createHydrateResolveView,
  getViewData,
  resolveViewServer
} from './resolve-view';
import type {Route} from './types';

const defaultHydrateKey = '_nativeRouterReactSSRData';

/**
 * Serialize the SSR payload for embedding in a script element.
 * `JSON.stringify` does not escape `<`, U+2028 and U+2029,
 * so route data like `</script>` would break out of the script element.
 * @param payload the payload to serialize
 * @returns the escaped JSON string
 */
function serializePayload(payload: {
  data?: any[];
  location: Location;
  index: number;
}) {
  return JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function resolveServerViewBase(
  router: RouterInstance<Route, ReactNode>,
  location: Location,
  options?: {
    scriptAttributes?: Record<string, string>;
    hydrateKey?: string;
  }
) {
  return resolve<Route, ReactNode>(router, location).then((view) => {
    const data = getViewData(view as ReactElement);
    const index =
      (router.history.location.state as HistoryState | undefined)?.index || 0;
    return (
      <>
        <Router router={router}>{view}</Router>
        <script
          {...options?.scriptAttributes}
          suppressHydrationWarning
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `window.${
              options?.hydrateKey || defaultHydrateKey
            } = ${serializePayload({data, location, index})};`
          }}
        />
      </>
    );
  });
}

export function resolveServerView(
  routes: Route | Route[],
  location: Location | string,
  {
    scriptAttributes,
    hydrateKey,
    ...options
  }: Options<ReactElement> & {
    scriptAttributes?: Record<string, string>;
    hydrateKey?: string;
  } = {}
) {
  const router = create(
    routes,
    createMemoryHistory({initialEntries: [location]}),
    resolveViewServer,
    options
  );

  return resolveServerViewBase(
    router,
    isString(location) ? toLocation(router, location) : location,
    {
      scriptAttributes,
      hydrateKey
    }
  );
}

/**
 * Hydrate the SSR result of {@link resolveServerView} on the client.
 * The router is bound to the browser history(aligned with the index
 * in the SSR payload), so navigation after hydration updates the address bar.
 * @param routes routes config, must match the server side
 * @param options options, `hydrateKey` must match the server side
 * @returns the resolved view and the router instance, for example:
 * `const {view, router} = await hydrate(routes);`
 * `hydrateRoot(root, <Router router={router}>{view}</Router>)`
 * @group Methods
 */
export function hydrate(
  routes: Route | Route[],
  options?: Options<ReactElement> & {
    hydrateKey?: string;
  }
): Promise<{view: ReactNode; router: RouterInstance<Route, ReactNode>}> {
  const {
    data,
    location,
    index = 0
  } = (window as any)[options?.hydrateKey || defaultHydrateKey] as {
    data: any[];
    location: Location;
    index?: number;
  };
  const history = createBrowserHistory();
  history.replace(createPath(history.location), {index});
  const router = create(
    routes,
    history,
    createHydrateResolveView(data),
    options
  );
  return resolve<Route, ReactNode>(router, location).then((view) => ({
    view,
    router
  }));
}
