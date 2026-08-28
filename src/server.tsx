import {createMemoryHistory} from 'history';
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
import {getViewData, resolveViewServer} from './resolve-view';
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
          // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- serialized state for hydration
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
