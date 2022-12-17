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
import type {Route, RouterInstance} from '@@/types';
import {LoadingContext, useLoadingSetter, ViewProvider} from '@@/context';
import {create as createRouter, listen} from '@@/router';
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

function BRouter({
  routes,
  history,
  children,
  errorHandler = Promise.reject,
  baseUrl,
  resolveView = defaultResolve
}: Props & {history: History}) {
  const setLoading = useLoadingSetter();
  const router = useMemo(
    () =>
      createRouter(routes, history, resolveView, {
        baseUrl,
        errorHandler,
        onLoadingChange(status?) {
          setLoading(status && {key: uniqId(), status});
        }
      }),
    [routes, history, resolveView, baseUrl, errorHandler]
  );

  const [view, setView] = useState<ReactNode>();
  useEffect(() => listen(router, setView), [router]);

  return (
    <RouterContext.Provider value={router}>
      {typeof children === 'undefined' ? (
        view
      ) : (
        <ViewProvider value={view}>{children}</ViewProvider>
      )}
    </RouterContext.Provider>
  );
}

/**
 * Base Router Component.
 * @group Components
 */
export function BaseRouter(props: Props & {history: History}) {
  return (
    <LoadingContext.Provider>
      <BRouter {...props} />
    </LoadingContext.Provider>
  );
}

/**
 * History mode Router Component.
 * @group Components
 */
function RouterComponent(props: Props) {
  const history = createBrowserHistory() as History;
  return <BaseRouter {...props} history={history} />;
}

export {RouterComponent as Router};

/**
 * Hash mode Router Component.
 * @group Components
 */
export function HashRouter(props: Props) {
  const history = createHashHistory() as History;
  return <BaseRouter {...props} history={history} />;
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
  const history = createMemoryHistory({
    initialEntries,
    initialIndex
  }) as History;
  return <BaseRouter {...props} history={history} />;
}

/**
 * Get Router instance.
 * @group Hooks
 * @returns Router Instance
 */
export function useRouter() {
  return useContext(RouterContext)!;
}
