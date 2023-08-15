import {createMemoryHistory} from 'history';
import {ReactElement, ReactNode} from 'react';
import {Router} from './components/Router';
import {
  createHydrateResolveView,
  getViewData,
  resolveViewServer
} from './resolve-view';
import {create, resolve, toLocation} from './router';
import type {Location, Options, Route, RouterInstance} from './types';
import {isString} from './util';

const defaultHydrateKey = '_nativeRouterReactSSRData';

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
            } = ${JSON.stringify({data, location})};`
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

export function resolveClientView(
  routes: Route | Route[],
  options?: Options<ReactElement> & {
    hydrateKey?: string;
  }
) {
  const {data, location} = (window as any)[
    options?.hydrateKey || defaultHydrateKey
  ] as {data: any[]; location: Location};
  const router = create(
    routes,
    createMemoryHistory({initialEntries: [location]}),
    createHydrateResolveView(data),
    options
  );
  return resolve(router, location);
}
