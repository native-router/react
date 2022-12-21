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
import type {Options, ResolveView, Route, RouterInstance} from '@@/types';
import {LoadingContext, useLoadingSetter, ViewProvider} from '@@/context';
import {create, listen} from '@@/router';
import defaultResolve from '@@/resolve-view';
import {uniqId} from '@@/util';

const RouterContext = createContext<RouterInstance<Route, ReactNode> | null>(
  null
);

type Props = {
  children: ReactNode;
  routes: Route[] | Route;
  baseUrl?: string;
  resolveView?: typeof defaultResolve;
  errorHandler?: (error: Error) => ReactNode;
};

function BRouter({children}: {children: ReactNode}) {
  const setLoading = useLoadingSetter();
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const router = useRouter();

  router.onLoadingChange = (status?) => {
    setLoading(status && {key: uniqId(), status});
  };

  const [view, setView] = useState<ReactNode>();

  useEffect(() => listen(router, setView), [router]);

  return children === 'undefined' ? (
    <>{view}</>
  ) : (
    <ViewProvider value={view}>{children}</ViewProvider>
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

/**
 * Base Router Component.
 * @group Components
 */
export function Router({
  router,
  ...props
}: {
  children: ReactNode;
  router: RouterInstance<Route, ReactNode>;
}) {
  return (
    <LoadingContext.Provider>
      <RouterContext.Provider value={router}>
        <BRouter {...props} />
      </RouterContext.Provider>
    </LoadingContext.Provider>
  );
}

function useNewRouter(
  routes: Route | Route[],
  createHistory: () => History,
  options: Options<ReactNode>
) {
  return useMemo(
    () => createRouter(routes, createHistory(), options),
    [routes, createHistory, ...Object.keys(options), ...Object.values(options)]
  );
}

/**
 * History mode Router Component.
 * @group Components
 */
export function HistoryRouter({children, routes, ...options}: Props) {
  const router = useNewRouter(routes, createBrowserHistory, options);
  return <Router router={router}>{children}</Router>;
}

/**
 * Hash mode Router Component.
 * @group Components
 */
export function HashRouter({children, routes, ...options}: Props) {
  const router = useNewRouter(routes, createHashHistory, options);
  return <Router router={router}>{children}</Router>;
}

/**
 * Memory mode Router Component.
 * @group Components
 */
export function MemoryRouter({
  initialEntries,
  initialIndex,
  children,
  routes,
  ...options
}: Props & MemoryHistoryOptions) {
  const createHistory = useMemo(
    () => () => createMemoryHistory({initialEntries, initialIndex}),
    [initialEntries, initialIndex]
  );
  const router = useNewRouter(routes, createHistory, options);
  return <Router router={router}>{children}</Router>;
}

/**
 * Get Router instance.
 * @group Hooks
 * @returns Router Instance
 */
export function useRouter() {
  return useContext(RouterContext)!;
}
