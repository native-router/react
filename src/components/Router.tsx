import {
  ReactNode,
  useMemo,
  useCallback,
  useRef,
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';
import UniversalRouter, {Route, RouterOptions, Routes} from 'universal-router';
import {
  createBrowserHistory,
  History,
  Path,
  createPath,
  parsePath
} from 'history';
import {createCurrentGuard, uniqId} from '@@/util';

export type LoadStatus = {
  key: number;
  status: 'pending' | 'resolved' | 'rejected';
};

export type RouterContext = {
  router: UniversalRouter;
  history: History;
  view: ReactNode;
  setView(view: ReactNode): void;
  loading?: LoadStatus;
  setLoading(loading?: LoadStatus): void;
  navigate: (to: string, options?: {state?: any; replace?: boolean}) => void;
  refresh(): void;
  cancel(): void;
};
const Context = createContext<RouterContext | null>(null);

type Location<T = any> = Path & {state: T};
type HistoryState = {locationStack: Location[]; index?: number} | null;
type Props<R = any, C extends RouterContext = RouterContext> = {
  children: ReactNode;
  routes: Routes<R, C> | Route<R, C>;
} & RouterOptions<R, C>;

const [currentGuard, cancelAll] = createCurrentGuard();

export function BaseRouter<R = any, C extends RouterContext = RouterContext>({
  routes,
  history,
  children,
  ...rest
}: Props<R, C> & {history: History<HistoryState>}) {
  const router = useMemo(
    () => new UniversalRouter<R, C>(routes, rest),
    [routes, ...Object.values(rest)]
  );
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

  const navigate = useCallback(
    (to, {state, replace} = {}) => {
      to = router.baseUrl + to;
      const location = {
        pathname: '',
        search: '',
        hash: '',
        ...parsePath(to),
        state
      } as Location;
      const nextIndex =
        (history.location.state?.index || 0) + (replace ? 0 : 1);

      const key = uniqId();
      setLoading({key, status: 'pending'});
      currentGuard(
        router.resolve({
          pathname: location.pathname,
          location
        })
      )
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
        .catch(() => setLoading({key, status: 'rejected'}));

      return cancel;
    },
    [router]
  );

  const refresh = useCallback(() => {
    const {pathname, state, ...restLocation} = history.location;
    return navigate(
      createPath({
        ...restLocation,
        pathname: pathname.slice(router.baseUrl.length)
      }),
      {replace: true, state: locationStackRef.current[state!.index!].state}
    );
  }, [navigate]);

  useEffect(() => {
    const locationStack =
      history.location.state?.locationStack || locationStackRef.current;
    locationStackRef.current = locationStack;

    const key = uniqId();
    setLoading({key, status: 'pending'});
    currentGuard(
      Promise.all(
        locationStack.map((l) =>
          router.resolve({
            pathname: createPath(l),
            location: l
          })
        )
      )
    )
      .then((views) => {
        viewStackRef.current = views;
        history.replace(createPath(history.location), history.location.state);
        setLoading({key, status: 'resolved'});
      })
      .catch(() => setLoading({key, status: 'rejected'}));
    // return cancel;
  }, [router]);

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
      {...rest}
      value={{
        history,
        router,
        loading,
        setLoading,
        view,
        setView,
        navigate,
        refresh,
        cancel
      }}
    >
      {typeof children === 'undefined' ? view : children}
    </Context.Provider>
  );
}

export function Router<R = any, C extends RouterContext = RouterContext>(
  props: Props<R, C>
) {
  const history = createBrowserHistory() as History<HistoryState>;
  return <BaseRouter {...props} history={history} />;
}

export function useRouter() {
  return useContext(Context)!;
}

export function useLoading() {
  return useContext(Context)!.loading;
}

export function View() {
  const {view} = useRouter();
  return <>{view}</>;
}
