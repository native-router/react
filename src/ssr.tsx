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
  // TODO: remove history
  const router = create(
    routes,
    createMemoryHistory(),
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
  const {data, location} = (window as Record<string, any>)[
    options?.hydrateKey || defaultHydrateKey
  ];
  // TODO: remove history
  const router = create(
    routes,
    createMemoryHistory(),
    createHydrateResolveView(data),
    options
  );
  return resolve(router, location);
}