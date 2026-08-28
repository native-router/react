import {createBrowserHistory, createPath} from 'history';
import {ReactElement, ReactNode} from 'react';
import {create, resolve} from '@native-router/core';
import type {Location, Options, RouterInstance} from '@native-router/core';
import defaultResolveView, {createHydrateResolveView} from './resolve-view';
import type {Route} from './types';

const defaultHydrateKey = '_nativeRouterReactSSRData';

/**
 * Hydrate the SSR result of {@link resolveServerView} on the client.
 * The router is bound to the browser history(aligned with the index
 * in the SSR payload), so navigation after hydration updates the address bar.
 * @param routes routes config, must match the server side
 * @param options options, `hydrateKey` must match the server side
 * @returns the resolved view and the router instance, for example:
 * `const {router} = await hydrate(routes);`
 * `hydrateRoot(root, <Router router={router}/>)`
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
  const router = create<Route, ReactNode>(
    routes,
    history,
    createHydrateResolveView(data),
    options
  );
  return resolve<Route, ReactNode>(router, location).then((view) => {
    // Seed the resolved view into the view stack: one-shot resolves do
    // not enter it, but `getCurrentView(router)` must return the view
    // for the hydration render. With the stack seeded, a plain
    // `<Router router={router}/>` renders the store view — its first
    // (hydration) render matches the server HTML and later navigations
    // update through the same store.
    router.viewStack[0] = view;
    // The payload-backed resolver only covers the initial chain; every
    // later navigation resolves through the default resolver and runs
    // its own data loaders.
    router.resolveView = defaultResolveView;
    return {view, router};
  });
}
