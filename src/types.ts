import type {
  AnchorHTMLAttributes,
  ComponentType,
  CSSProperties,
  DetailedHTMLProps,
  ReactNode
} from 'react';
import type {
  BaseRoute,
  ExtractPathParams,
  Matched,
  Location,
  RouterInstance,
  SearchInput
} from '@native-router/core';

export type ResolveViewContext<R extends BaseRoute> = {
  router: RouterInstance<R>;
  location: Location;
  /**
   * The navigation chain's abort signal, aborted when this navigation is
   * superseded or cancelled. Optional for custom `resolveView`
   * implementations: core always passes it, but hand-rolled contexts
   * (tests, SSR shims) keep compiling without it.
   */
  signal?: AbortSignal;
};

export type Context<
  T extends BaseRoute,
  P = Record<string, string>,
  S = SearchInput
> = {
  matched: Matched<T>[];
  index: number;
  router: RouterInstance<T>;
  location: Location;
  params: P;
  /**
   * The parsed search of the current location: with a route
   * {@link Route.search search schema} the schema output, otherwise the
   * raw input object of `parseSearchInput`(strings, arrays for repeated
   * keys).
   */
  search: S;
  /**
   * Aborted when this navigation is superseded by a newer one or
   * cancelled(see {@link RouterInstance.cancelAll cancel}). Forward it to
   * the loader's requests — `fetch(url, {signal})` or
   * `useRun({signal: true})` loaders — so a discarded navigation stops
   * consuming the network instead of only having its result dropped.
   */
  signal: AbortSignal;
};

/**
 * Params shape of a route path. Literal patterns get a precise shape via
 * {@link ExtractPathParams}; the default `string`(and `any`) degrade to
 * the legacy `Record<string, string>` so untyped routes keep working.
 * @group Types
 * @category Route
 */
export type RouteParams<P extends string> = string extends P
  ? Record<string, string>
  : ExtractPathParams<P>;

/**
 * Route with optional path-pattern and search generics. Give `path` a
 * string literal type and the `data`/`component`/`errorComponent`
 * contexts receive precisely-typed `params`, e.g.
 * `Route<'/users/:id'>` → `params: {id: string}`. Give the second
 * generic the output type of the route `search` schema and `ctx.search`
 * is typed accordingly, e.g. `Route<'/list', {page: number}>` with
 * `search: z.object({page: z.coerce.number()})` → `search: {page: number}`.
 *
 * Without the search generic an untyped `ctx.search` stays `any` — the
 * default that keeps differently typed levels assignable to plain
 * `Route`: schema outputs are arbitrary(coerced numbers, defaults, ...),
 * so no single degraded shape is bivariant with all of them. At runtime
 * it holds the raw input object of `parseSearchInput`; see `useSearch`
 * for the typed degraded shape.
 * `children` accepts `Route<any, any>` so levels with different patterns
 * and search shapes nest without variance conflicts.
 * @group Types
 * @category Route
 */
export type Route<P extends string = string, S = any> = Omit<
  BaseRoute<{
    name?: string;
    data?(ctx: Context<Route, RouteParams<P>, S>): any | Promise<any>;
    component?(
      ctx: Context<Route, RouteParams<P>, S>
    ): ComponentType | Promise<ComponentType | {default: ComponentType}>;
    /**
     * Not parametrized by `P`: props are strictly contravariant, so a
     * precise params type here would break assignability between
     * `Route<'/a/:id'>` and plain `Route`.
     */
    errorComponent?: ComponentType<{error: Error; ctx: Context<Route>}>;
    /**
     * Skeleton rendered while a navigation is pending AND there is no
     * previous view to retain — cold start, refresh, or re-navigation
     * after an error left the view slot blank. The nearest one up the
     * matched chain(deepest first, the route's own included) wins.
     *
     * In-app navigation never renders it: the previous view stays on
     * screen until the new one resolves(the view stack design), the
     * global loading signal(`useLoading`) already covers that phase.
     * Receives no props.
     */
    pendingComponent?: ComponentType;
  }>,
  'path' | 'children'
> & {
  /** Path pattern; params of the contexts above are inferred from it. */
  path?: P;
  /**
   * `Route<any, any>` accepts levels with any path pattern and search
   * shape, so typed levels nest without variance conflicts. The
   * `search` field is inherited from `BaseRoute`, loosely typed — see
   * the Route doc above.
   */
  children?: Route<any, any>[];
};

export type LoadStatus = {
  key: number;
  status: 'pending' | 'resolved' | 'rejected';
};

export type LinkProps = {
  to: string;
  /**
   * 预取策略：'intent'（默认，hover/focus 触发）、'render'（挂载即预取）、
   * 'viewport'（进入视口）、'none'（不预取）
   */
  prefetch?: 'intent' | 'render' | 'viewport' | 'none';
  children?: ReactNode;
} & DetailedHTMLProps<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  HTMLAnchorElement
>;

export type {
  SearchInput,
  SearchOutputOf,
  StandardSchemaV1
} from '@native-router/core';

/**
 * Active state passed to the render-prop / callback flavors of
 * {@link NavLinkProps.className}, {@link NavLinkProps.style} and
 * {@link NavLinkProps.children}.
 */
export type NavLinkState = {
  /** Matches the target pathname, partially or exactly. */
  isActive: boolean;
  /** Matches the target pathname exactly. */
  isExactActive: boolean;
};

export type NavLinkProps = {
  /** Target path, same as {@link LinkProps.to}. */
  to: string;
  /** Only the exact pathname counts as active. @default false */
  end?: boolean;
  /** Compare pathnames case-sensitively. @default false */
  caseSensitive?: boolean;
  className?: string | ((state: NavLinkState) => string);
  style?: CSSProperties | ((state: NavLinkState) => CSSProperties);
  /** `aria-current` value rendered while active. @default 'page' */
  ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time';
  children?: ReactNode | ((state: NavLinkState) => ReactNode);
} & Omit<
  DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
  // Click handling is owned by Link; className/style/children are re-typed
  // above to accept the active-state callbacks.
  'className' | 'style' | 'children' | 'onClick'
>;
