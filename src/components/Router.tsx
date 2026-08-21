import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
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
import {useSyncExternalStore} from 'use-sync-external-store/shim';
import defaultResolve from '@@/resolve-view';

const RouterContext = createContext<RouterInstance<Route, ReactNode> | null>(
  null
);

type Props = {
  children?: ReactNode;
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
  children?: ReactNode;
  router: RouterInstance<Route, ReactNode>;
}) {
  const viewRef = useRef<ReactNode>(getCurrentView(router));
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      listen(router, (view) => {
        viewRef.current = view;
        onStoreChange();
      }),
    [router]
  );
  const getSnapshot = useCallback(() => viewRef.current, []);
  // `getServerSnapshot` is required by the native implementation when the
  // Router is rendered inside server-rendered content(e.g. resolveServerView).
  const getServerSnapshot = useCallback(() => getCurrentView(router), [router]);
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <RouterContext.Provider value={router}>
      {children === undefined ? (
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
  const {baseUrl, currentView} = tracked;
  const router = useMemo(
    () => createRouter(routes, createHistory(), tracked),
    [routes, createHistory, baseUrl, currentView]
  );

  const [loading, setLoading] = useState<LoadStatus>();
  // Options are applied in an effect(never during render) and refreshed on
  // every commit, so `onLoadingChange` always sees the latest closure.
  useEffect(() => {
    setOptions(router, {
      ...rest,
      onLoadingChange(status) {
        setLoading(status && {key: uniqId(), status});
      }
    });
  }, [router, rest]);

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
  const router = useContext(RouterContext);
  if (!router) {
    throw new Error('useRouter() must be used within a <Router> component');
  }
  return router;
}
