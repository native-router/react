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
import {LoadingContext, PendingContext, ViewProvider} from '@@/context';
import {
  create,
  getCurrentView,
  listen,
  match,
  setOptions
} from '@native-router/core';
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
  // Route-level pending skeleton, only when no previous view is retained
  // (cold start, refresh, re-navigation after an error); in-app navigation
  // keeps the old view by design, the global loading signal already
  // covers that phase. Reading LoadingContext here also re-renders the
  // Router on every loading transition.
  const loading = useContext(LoadingContext);
  const pending =
    view == null && loading?.status === 'pending'
      ? resolvePendingView(router, loading.key)
      : null;

  return (
    <RouterContext.Provider value={router}>
      {children === undefined ? (
        (view ?? pending)
      ) : (
        <ViewProvider value={view}>
          <PendingContext.Provider value={pending}>
            {children}
          </PendingContext.Provider>
        </ViewProvider>
      )}
    </RouterContext.Provider>
  );
}

/**
 * Render the `pendingComponent` of the nearest matched ancestor of the
 * resolving location, walked deepest first(the resolving route's own
 * included). Keyed by the loading episode so a new pending phase remounts
 * the skeleton(stateful shimmer animations restart). Guards may still
 * redirect the resolution away; until then the initially matched chain
 * is the best — and only — answer available.
 */
function resolvePendingView(
  router: RouterInstance<Route, ReactNode>,
  key: number
) {
  const {resolving} = router;
  const matched = resolving ? match(router, resolving.pathname) : undefined;
  if (!matched) return null;
  for (let i = matched.length - 1; i >= 0; i--) {
    const Pending = matched[i].route.pendingComponent;
    if (Pending) return <Pending key={key} />;
  }
  return null;
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
  const [loading, setLoading] = useState<LoadStatus>();
  // Initial options are baked in at creation: the cold-start resolve fires
  // from the subscribe effect(children effects run first) before the
  // setOptions effect below runs, and the default errorHandler would let
  // listen's refresh().catch(noop) swallow a first failure, leaving the
  // view blank forever.
  const router = useMemo(
    () =>
      createRouter(routes, createHistory(), {
        ...options,
        onLoadingChange(status) {
          setLoading(status && {key: uniqId(), status});
        }
      }),
    // Only the tracked options belong to the deps: option updates flow
    // through the setOptions effect below instead of recreating the router.
    [routes, createHistory, baseUrl, currentView]
  );

  // Options are refreshed on every commit, so `onLoadingChange` and the
  // callback options always see the latest closure.
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
