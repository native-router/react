import type {Path, MatchResult} from 'path-to-regexp';
import type {History, Path as HPath} from 'history';
import type {
  AnchorHTMLAttributes,
  ComponentType,
  Context as ReactContext,
  DetailedHTMLProps,
  ReactNode
} from 'react';

export type Location<T = any> = HPath & {state: T};

export type HistoryState = {locationStack: Location[]; index: number} | null;

export type Awaitable<T> = T | Promise<T>;

export type BaseRoute<T = any> = {
  path?: Path;
  children?: BaseRoute<T>[];
} & Omit<T, 'path' | 'children'>;

export type Matched<R extends BaseRoute = BaseRoute> = {route: R} & MatchResult<
  Record<string, string>
>;

export type ResolveViewContext<R extends BaseRoute> = {
  // eslint-disable-next-line no-use-before-define
  router: RouterInstance<R>;
  location: Location;
};
export type ResolveView<R extends BaseRoute, V> = (
  matched: Matched<R>[],
  ctx: ResolveViewContext<R>
) => Promise<V>;

export type Options<V> = {
  baseUrl?: string;
  currentView?: V;
  errorHandler?(e: Error): V | Promise<V>;
  onLoadingChange?(status?: 'pending' | 'resolved' | 'rejected'): void;
};

export type RequiredOf<T, K extends keyof T> = Required<Pick<T, K>> &
  Omit<T, K>;

export type RouterInstance<R extends BaseRoute, V = any> = {
  routes: R[];
  baseUrl: string;
  history: History;
  viewStack: V[];
  locationStack: Location[];
  resolveView: ResolveView<R, V>;
  currentGuard<T>(promise: Promise<T>): Promise<T>;
  cancelAll(): void;
  resolving?: Location;
} & RequiredOf<Options<V>, 'baseUrl'>;

export type Context<T extends BaseRoute> = {
  matched: Matched<T>[];
  index: number;
  router: RouterInstance<BaseRoute>;
  location: Location;
  params: Record<string, string>;
};

export type Route = BaseRoute<{
  name?: string;
  data?(ctx: Context<Route>): any | Promise<any>;
  component?(
    ctx: Context<Route>
  ): ComponentType | Promise<ComponentType | {default: ComponentType}>;
}>;

export type StateContext<S> = {
  SetterContext: ReactContext<((v: S) => void) | undefined>;
  ValueContext: ReactContext<S | undefined>;
  Provider: ComponentType<{children: ReactNode}>;
};

export type LoadStatus = {
  key: number;
  status: 'pending' | 'resolved' | 'rejected';
};

export type LinkProps = {
  to: string;
  children?: ReactNode;
} & DetailedHTMLProps<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  HTMLAnchorElement
>;
