import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo
} from 'react';
import {
  History,
  createBrowserHistory,
  createHashHistory,
  createMemoryHistory,
  MemoryHistoryOptions
} from 'history';
import type {LoadStatus, Route} from '@@/types';
import {LoadingContext, ViewProvider} from '@@/context';
import {create, getCurrentView, listen, setOptions} from '@native-router/core';
import type {Options, ResolveView, RouterInstance} from '@native-router/core';
import {splitProps, uniqId} from '@native-router/core/util';
import defaultResolve from '@@/resolve-view';

const RouterContext = createContext<RouterInstance<Route, ReactNode> | null>(
  null
);

type Props = {
  children: ReactNode;
  routes: Route[] | Route;
  resolveView?: typeof defaultResolve;
} & Omit<Options<ReactNode>, 'onLoadingChange'>;

/**
 * Base Router Component.
 * @group Components
 */
export function Router({
  router,
  children
}: {
  children: ReactNode;
  router: RouterInstance<Route, ReactNode>;
}) {
  const [view, setView] = useState<ReactNode>(getCurrentView(router));

  useEffect(() => listen(router, setView), [router]);
  return (
    <RouterContext.Provider value={router}>
      {children === 'undefined' ? (
        view
      ) : (
        <ViewProvider value={view}>{children}</ViewProvider>
      )}
    </RouterContext.Provider>
  );
}

export function createRouter(
  routes: Route | Route[],
  history: History,
  {
    resolveView = defaultResolve,
    ...options
  }: Options<ReactNode> & {resolveView?: ResolveView<Route, ReactNode>} = {}
): RouterInstance<Route, ReactNode> {
  return create(routes, history, resolveView, options);
}

function useNewRouter(
  {routes, children, ...options}: Props,
  createHistory: () => History
) {
  const [tracked, rest] = splitProps(options, ['baseUrl', 'currentView']);
  const router = useMemo(
    () => createRouter(routes, createHistory(), tracked),
    [routes, createHistory, ...Object.keys(tracked), ...Object.values(tracked)]
  );

  const [loading, setLoading] = useState<LoadStatus>();
  setOptions(router, {
    ...rest,
    onLoadingChange(status) {
      setLoading(status && {key: uniqId(), status});
    }
  });

  const r = useMemo(
    () => <Router router={router}>{children}</Router>,
    [router, children]
  );

  return <LoadingContext.Provider value={loading}>{r}</LoadingContext.Provider>;
}

/**
 * History mode Router Component.
 * @group Components
 */
export function HistoryRouter(props: Props) {
  return useNewRouter(props, createBrowserHistory);
}

/**
 * Hash mode Router Component.
 * @group Components
 */
export function HashRouter(props: Props) {
  return useNewRouter(props, createHashHistory);
}

/**
 * Memory mode Router Component.
 * @group Components
 */
export function MemoryRouter({
  initialEntries,
  initialIndex,
  ...props
}: Props & MemoryHistoryOptions) {
  const createHistory = useMemo(
    () => () => createMemoryHistory({initialEntries, initialIndex}),
    [initialEntries, initialIndex]
  );
  return useNewRouter(props, createHistory);
}

/**
 * Get Router instance.
 * @group Hooks
 * @returns Router Instance
 */
export function useRouter() {
  return useContext(RouterContext)!;
}
