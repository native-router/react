import {createContext, ReactNode, useContext, useMemo, useRef} from 'react';
import {
  createStateContext,
  useSetterContext,
  useValueContext
} from './state-context';
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
 * Used for route component to render child route component.
 * It just render the return of {@link useView}
 * @group Components
 */
export function View() {
  return useView();
}

export function InitializableView({initial}: {initial: ReactNode}) {
  const view = useView();
  const ref = useRef<ReactNode | Symbol>(view);
  if (view === ref.current && !view) return initial;
  ref.current = Symbol('');
  return view;
}

const DataContext = createContext<[any, Record<string, any>]>([undefined, {}]);

function useDataContext() {
  return useContext(DataContext);
}

/**
 * @group Hooks
 */
export function useNamedData() {
  return useDataContext()[1];
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
 * @group Hooks
 */
export function useData(name?: string) {
  const [data, namedData] = useDataContext();
  return name ? namedData[name] : data;
}

export const LoadingContext = createStateContext<LoadStatus>();

/**
 * @group Hooks
 */
export function useLoading() {
  return useValueContext(LoadingContext);
}

/**
 * @group Hooks
 */
export function useLoadingSetter() {
  return useSetterContext(LoadingContext);
}
