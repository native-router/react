import {createContext, ReactNode, useContext, useMemo} from 'react';
import type {Context, LoadStatus, Route} from './types';

const ViewContext = createContext<ReactNode>(null);

export function ViewProvider(props: {children: ReactNode; value: ReactNode}) {
  return <ViewContext.Provider {...props} />;
}

/**
 * @group Hooks
 * @see {@link View View Component}
 */
export function useView() {
  return useContext(ViewContext);
}

/**
 * Route-level pending skeleton(`pendingComponent` of the nearest matched
 * ancestor), set by the Router only while a navigation is pending with no
 * previous view to retain(cold start, refresh, re-navigation after an
 * error); `null` otherwise, so in-app navigation keeps the previous view.
 * @see {@link Route.pendingComponent}
 */
export const PendingContext = createContext<ReactNode>(null);

/**
 * Used for route component to render child route component.
 * It just render the return of {@link useView}, falling back to the
 * route-level pending skeleton when the view slot is empty.
 * @group Components
 */
export function View() {
  const view = useView();
  const pending = useContext(PendingContext);
  return view ?? pending;
}

const DataContext = createContext<[any, Record<string, any>]>([undefined, {}]);

function useDataContext() {
  return useContext(DataContext);
}

/**
 * Get the named data map of the resolved route levels: an object keyed by
 * each ancestor's `name`, holding its resolved `data`. The current level
 * is included only when it declares a `name`.
 *
 * Give the generic the expected map shape to read values type-safely:
 * `useNamedData<{user: User}>()`.
 * @group Hooks
 */
export function useNamedData<T = Record<string, unknown>>() {
  return useDataContext()[1] as T;
}

export function DataProvider({
  children,
  name,
  data
}: {
  children: ReactNode;
  data: any;
  name?: string;
}) {
  const namedData = useNamedData();
  const value = useMemo(
    () => [data, name ? {...namedData, [name]: data} : namedData] as [any, any],
    [data, name, namedData]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const MatchedContext = createContext<Context<Route> | undefined>(
  undefined
);

/**
 * @group Hooks
 */
export function useMatched() {
  return useContext(MatchedContext)!;
}

/**
 * Get the resolved `data` of the current route level, or the named data
 * of an ancestor level when `name` is given.
 *
 * Type the read through the loader instead of a hand-written shape —
 * `useData<RouteDataOf<typeof fetchUser>>()` — and the annotation is
 * derived from what the route's `data` loader resolves, so it cannot
 * drift. A hand-written generic keeps priority wherever it is written:
 * `useData<Article>()` → `Article | undefined`. A bare `useData()` stays
 * `unknown` — the loose fallback, never a compile error.
 * @group Hooks
 * @see {@link RouteDataOf}
 */
export function useData<T = unknown>(name?: string): T | undefined {
  const [data, namedData] = useDataContext();
  return (name ? namedData[name] : data) as T | undefined;
}

export const LoadingContext = createContext<LoadStatus | undefined>(undefined);

/**
 * @group Hooks
 */
export function useLoading() {
  return useContext(LoadingContext);
}
