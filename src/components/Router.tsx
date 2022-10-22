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
import type {Route, Location, RouterInstance} from '@@/types';
import {LoadingContext, useLoadingSetter, ViewProvider} from '@@/context';
import {create as createRouter, listen} from '@@/router';
import defaultResolve from '@@/resolve-view';
import {uniqId} from '@@/util';

export const RouterContext = createContext<RouterInstance<
  Route,
  ReactNode
> | null>(null);

type HistoryState = {locationStack: Location[]; index?: number} | null;
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
}: Props & {history: History<HistoryState>}) {
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

export function BaseRouter(props: Props & {history: History<HistoryState>}) {
  return (
    <LoadingContext.Provider>
      <BRouter {...props} />
    </LoadingContext.Provider>
  );
}

function RouterComponent(props: Props) {
  const history = createBrowserHistory() as History<HistoryState>;
  return <BaseRouter {...props} history={history} />;
}

export {RouterComponent as Router};

export function HashRouter(props: Props) {
  const history = createHashHistory() as History<HistoryState>;
  return <BaseRouter {...props} history={history} />;
}

export function MemoryRouter({
  initialEntries,
  initialIndex,
  ...props
}: Props & MemoryHistoryOptions) {
  const history = createMemoryHistory({
    initialEntries,
    initialIndex
  }) as History<HistoryState>;
  return <BaseRouter {...props} history={history} />;
}

export function useRouter() {
  return useContext(RouterContext)!;
}
