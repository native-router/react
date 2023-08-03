import {createMemoryHistory} from 'history';
import {ReactElement} from 'react';
import {create, resolve} from './router';
import {
  getViewData,
  createHydrateResolveView,
  resolveViewServer
} from './resolve-view';
import type {Location, Options, Route} from './types';
import {Router} from './components/Router';

const defaultHydrateKey = '_nativeRouterReactSSRData';

// eslint-disable-next-line import/prefer-default-export
export function resolveServerView(
  routes: Route | Route[],
  location: Location,
  options?: Options<ReactElement> & {
    scriptAttributes?: Record<string, string>;
    hydrateKey?: string;
  }
) {
  const router = create(
    routes,
    createMemoryHistory({initialEntries: [location]}),
    resolveViewServer,
    options
  );
  return resolve(router, location).then((view) => {
    const data = getViewData(view);
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
