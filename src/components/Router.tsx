import {
  ReactNode,
  useCallback,
  useRef,
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';
import {
  History,
  createPath,
  parsePath,
  createBrowserHistory,
  createHashHistory,
  createMemoryHistory,
  MemoryHistoryOptions
} from 'history';
import type {Route, Location, Router} from '@@/types';
import {createCurrentGuard, uniqId} from '@@/util';
import {ViewProvider} from '@@/context';
import {create as createRouter} from '@@/router';
import defaultResolve from '@@/resolve';

export type LoadStatus = {
  key: number;
  status: 'pending' | 'resolved' | 'rejected';
};

export type RouterContext = {
  go: History['go'];
  back: History['back'];
  forward: History['forward'];
  createHref(to: string): string;
  setView(view: ReactNode): void;
  loading?: LoadStatus;
  setLoading(loading?: LoadStatus): void;
  prefetch: (
    to: string,
    options?: {
      state?: any;
      replace?: boolean;
      done?: (view: ReactNode) => void;
      onError?: (e: Error) => void;
    }
  ) => () => void;
  navigate: (to: string, options?: {state?: any; replace?: boolean}) => void;
  refresh(): void;
  cancel(): void;
};
const Context = createContext<RouterContext | null>(null);

type HistoryState = {locationStack: Location[]; index?: number} | null;
type Props = {
  children: ReactNode;
  routes: Route[] | Route;
  baseUrl?: string;
  resolve?: typeof defaultResolve;
  errorHandler?: (error: Error) => ReactNode;
};

const [currentGuard, cancelAll] = createCurrentGuard();

export function BaseRouter({
  routes,
  history,
  children,
  errorHandler = Promise.reject,
  baseUrl,
  resolve = defaultResolve
}: Props & {history: History<HistoryState>}) {
  const routerRef = useRef<Router<Route>>();
  routerRef.current = createRouter(routes, {baseUrl});
  // TODO: 移到上层 context
  const [loading, setLoading] = useState<LoadStatus>();
  const [view, setView] = useState<ReactNode>();
  const viewStackRef = useRef<ReactNode[]>([]);
  const locationStackRef = useRef<Location[]>([history.location]);

  const cancel = useCallback(() => {
    setLoading((l) => {
      if (l && l.status === 'pending') {
        cancelAll();
        return undefined;
      }
      return l;
    });
  }, []);

  const rejectLoading = (key: number) => (e: Error) => {
    setLoading({key, status: 'rejected'});
    throw e;
  };

  const prefetch = useCallback((to, {state, replace, done, onError} = {}) => {
    const router = routerRef.current!;
    to = router.baseUrl + to;
    const location = {
      pathname: '',
      search: '',
      hash: '',
      ...parsePath(to),
      state
    } as Location;
    const resolvePromise = resolve(router, location.pathname, location).catch(
      errorHandler
    );

    resolvePromise.then(done, onError);

    return function commit() {
      const nextIndex =
        (history.location.state?.index || 0) + (replace ? 0 : 1);
      const key = uniqId();
      setLoading({key, status: 'pending'});
      currentGuard(resolvePromise)
        .then((resolvedView) => {
          locationStackRef.current = [
            ...locationStackRef.current.slice(0, nextIndex),
            location
          ];
          viewStackRef.current = [
            ...viewStackRef.current.slice(0, nextIndex),
            resolvedView
          ];
          history[replace ? 'replace' : 'push'](to, {
            index: nextIndex,
            locationStack: locationStackRef.current
          });
          setLoading({key, status: 'resolved'});
        })
        .catch(rejectLoading(key));
    };
  }, []);

  const navigate = useCallback((to, options) => {
    prefetch(to, options)();
  }, []);

  const refresh = useCallback(() => {
    const router = routerRef.current!;
    const {pathname, state} = history.location;
    const key = uniqId();
    setLoading({key, status: 'pending'});
    const l = {
      ...history.location,
      pathname: pathname.slice(router.baseUrl.length)
    };
    return resolve(router, createPath(l), l)
      .catch(errorHandler)
      .then((v) => {
        viewStackRef.current[state?.index || 0] = v;
        history.replace(createPath(history.location), history.location.state);
        setLoading({key, status: 'resolved'});
      })
      .catch(rejectLoading(key));
  }, []);

  const go = useCallback((delta: number) => {
    history.go(delta);
  }, []);

  const back = useCallback(() => {
    history.back();
  }, []);

  const forward = useCallback(() => {
    history.forward();
  }, []);

  const createHref = useCallback(
    (to: string) => routerRef.current!.baseUrl + history.createHref(to),
    []
  );

  useEffect(() => {
    const router = routerRef.current!;
    const locationStack =
      history.location.state?.locationStack || locationStackRef.current;
    locationStackRef.current = locationStack;

    const key = uniqId();
    setLoading({key, status: 'pending'});
    Promise.all(
      locationStack.map((l) =>
        resolve(router, createPath(l), l).catch(errorHandler)
      )
    )
      .then((views) => {
        viewStackRef.current = views;
        history.replace(createPath(history.location), history.location.state);
        setLoading({key, status: 'resolved'});
      })
      .catch(rejectLoading(key));

    return cancel;
  }, []);

  useEffect(
    () =>
      history.listen(({action, location}) => {
        cancel();

        const index = location.state?.index || 0;
        setView(viewStackRef.current[index]);

        if (action === 'POP') {
          history.replace(createPath(history.location), {
            ...history.location.state,
            locationStack: locationStackRef.current
          });
        }
      }),
    [history]
  );

  return (
    <Context.Provider
      value={{
        go,
        back,
        forward,
        createHref,
        loading,
        setLoading,
        setView,
        prefetch,
        navigate,
        refresh,
        cancel
      }}
    >
      {typeof children === 'undefined' ? (
        view
      ) : (
        <ViewProvider value={view}>{children}</ViewProvider>
      )}
    </Context.Provider>
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
  return useContext(Context)!;
}

export function useLoading() {
  return useContext(Context)!.loading;
}
