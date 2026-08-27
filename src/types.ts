import type {
  AnchorHTMLAttributes,
  ComponentPropsWithRef,
  ComponentPropsWithoutRef,
  ComponentType,
  CSSProperties,
  DetailedHTMLProps,
  ElementType,
  ReactNode
} from 'react';
import type {
  Awaitable,
  BaseRoute,
  ExtractPathParams,
  GuardContext,
  Matched,
  Location,
  RouterInstance,
  SearchInput,
  StandardSchemaV1
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
  /**
   * Which error phase an `errorComponent` is being rendered for. Absent
   * during the resolve phase(loader/guard/search failures — the fallback
   * of `resolve-view`); `'render'` when the component subtree threw while
   * rendering and the route-level error boundary caught it.
   */
  phase?: 'render';
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
 * `search: z.object({page: z.coerce.number()})` → `search: {page: number}` —
 * for the `data` loader and the `beforeLoad` guard alike.
 *
 * Without the search generic an untyped `ctx.search` stays `any` — the
 * default that keeps differently typed levels assignable to plain
 * `Route`: schema outputs are arbitrary(coerced numbers, defaults, ...),
 * so no single degraded shape is bivariant with all of them. At runtime
 * it holds the raw input object of `parseSearchInput`; see `useSearch`
 * for the typed degraded shape. Prefer {@link createRoutes}: its
 * returned table derives every level's `ctx.search` from the level's own
 * schema(see {@link SearchRoutesOf}), so the manual generic is only
 * needed for hand-annotated route objects.
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
     * `Route<'/a/:id'>` and plain `Route`. Rendered for both error
     * phases: resolve failures(search/data/component load, no
     * `ctx.phase`) and render errors thrown by the level's component
     * subtree(`ctx.phase === 'render'`, caught by the route-level
     * render error boundary).
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
  'path' | 'children' | 'beforeLoad'
> & {
  /**
   * Route guard inherited from `BaseRoute`, re-typed by the search
   * generic: `ctx.search` is `S`(`any` by default — see the Route doc
   * above). At runtime it holds the level's parsed search — the schema
   * output, or the degraded input without a schema. The guard context
   * types `router` as `RouterInstance<any>`: a precise
   * `RouterInstance<Route>` here would recurse into `Route`'s own
   * members and break `Route`'s assignability to plain `BaseRoute`.
   */
  beforeLoad?(ctx: GuardContext<any, S>): Awaitable<string | void>;
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

/**
 * The search a route's `data`/`beforeLoad` contexts receive: the
 * level's own {@link Route.search search schema} output, or the
 * degraded {@link SearchInput} when the level declares no schema.
 * Building block of {@link SearchRoutesOf}.
 * @group Types
 * @category Route
 */
export type RouteSearchOf<R> = R extends {
  search: StandardSchemaV1<any, infer Output>;
}
  ? Output
  : SearchInput;

/**
 * A context with only its `search` member replaced — everything the
 * callback declared(`params` precision, `signal`, custom shapes)
 * passes through untouched.
 * @group Types
 * @category Route
 */
export type WithSearch<C, S> = Omit<C, 'search'> & {search: S};

/**
 * Re-type a route table so every level's `data` loader and `beforeLoad`
 * guard derive their `ctx.search` from the level's own
 * {@link Route.search search schema}: the schema's parsed output(see
 * {@link RouteSearchOf}) instead of the loose `any`. This is what
 * {@link createRoutes} returns, closing the type loop — no manual
 * `Route<P, S>` generics or callback annotations needed for the search
 * typing.
 *
 * Everything else passes through unchanged: `path` literals(so
 * `RoutePaths<typeof routes>` and `TypedLink` keep working), the
 * loaders' return types, and the rest of every level's members. A
 * callback that annotates its ctx with a search shape the schema
 * contradicts is rejected at the `data`/`beforeLoad` property; an
 * un-annotated callback written inside the literal is checked loosely
 * against `Route`(`ctx.search: any` — TypeScript cannot contextually
 * type a member from sibling properties) and precisely on the returned
 * table.
 * @group Types
 * @category Route
 */
export type SearchRoutesOf<T> = T extends readonly unknown[]
  ? {-readonly [K in keyof T]: SearchRoutesOf<T[K]>}
  : T extends Route
    ? T extends {
        data?: infer Data;
        beforeLoad?: infer BeforeLoad;
        children?: infer Children;
      }
      ? Omit<T, 'data' | 'beforeLoad' | 'children'> & {
          data?: [unknown] extends [Data]
            ? undefined
            : Data extends (ctx: infer DataCtx) => infer R
              ? (ctx: WithSearch<DataCtx, RouteSearchOf<T>>) => R
              : Data;
          beforeLoad?: [unknown] extends [BeforeLoad]
            ? undefined
            : BeforeLoad extends (ctx: infer GuardCtx) => infer R
              ? (ctx: WithSearch<GuardCtx, RouteSearchOf<T>>) => R
              : BeforeLoad;
          children?: [unknown] extends [Children]
            ? undefined
            : SearchRoutesOf<Children>;
        }
      : T
    : T;

/**
 * Union of every navigable path pattern of a route table, computed from
 * the table's type. Each level's `path` literal concatenates with its
 * children's patterns the way the runtime matcher consumes them
 * (`{path: '/users', children: [{path: '/:id'}]}` → `'/users/:id'`),
 * layout levels without `path` pass their children's patterns through,
 * and param segments stay in the union, e.g. `'/article/:title'`.
 *
 * The table must keep its `path` literal types: build it with
 * {@link createRoutes}(satisfies semantics) or annotate levels with
 * `Route<'/literal'>`. An `as Route` assertion widens every `path` to
 * `string`, the union degrades to `string`, and {@link TypedLink}
 * accepts any path — exactly like a plain `Link`.
 * @group Types
 * @category Route
 */
export type RoutePaths<Routes> = Routes extends readonly (infer R)[]
  ? RoutePathsOf<R>
  : RoutePathsOf<Routes>;

/**
 * One level's contribution: with `children`, only the concatenated
 * parent+child patterns are navigable(the runtime matcher requires a
 * child — or a `path: ''` leaf — to consume the remainder); without
 * children, the level's own pattern. A widened `path`(`string`, e.g.
 * an `as Route` assertion) short-circuits to `string` — which also
 * stops the recursion over the self-referential `Route` type. A
 * `path`-less layout level(P `undefined`) recurses into its children.
 */
/**
 * One level's contribution: with `children`, only the concatenated
 * parent+child patterns are navigable(the runtime matcher requires a
 * child — or a `path: ''` leaf — to consume the remainder); without
 * children, the level's own pattern.
 *
 * The widened short-circuits matter: a `path`-less layout level infers
 * `P = unknown`(optional-property inference) and recurses into its
 * children; a widened `path: string`(an `as Route` assertion) yields
 * `string` — which also stops the recursion over the self-referential
 * `Route` type, where the non-literal child paths degrade to `string`.
 */
type RoutePathsOf<R> = R extends {path?: infer P; children?: infer C}
  ? [P] extends [never]
    ? never
    : unknown extends P
      ? C extends readonly unknown[]
        ? RoutePaths<C>
        : never
      : string extends P
        ? string
        : C extends readonly unknown[]
          ? ParentPaths<P, RoutePaths<C>>
          : OwnPath<P>
  : never;

type OwnPath<P> = P extends string ? P : never;

/**
 * Prefix every child pattern with the parent's pattern
 * (`'/users'` + `'/:id'` → `'/users/:id'`); a layout parent without
 * `path` contributes nothing. A non-literal(widened) side degrades the
 * whole union to `string`.
 */
type ParentPaths<P, ChildPaths> = string extends ChildPaths
  ? string
  : ChildPaths extends string
    ? P extends string
      ? string extends P
        ? string
        : `${P}${ChildPaths}`
      : ChildPaths
    : never;

/**
 * Props of {@link TypedLink}: a discriminated union over the table's
 * path patterns, so `params` is checked against the param segments of
 * the exact `to` pattern — omitted for static patterns, required with
 * `{name: string}` for `:name` segments and `{name: string[]}` for
 * `*name` wildcards(see {@link RouteParams}).
 *
 * Give the component the table's pattern union as its type argument:
 * `TypedLink<RoutePaths<typeof routes>>`.
 * @group Types
 * @category Route
 */
export type TypedLinkProps<Paths extends string = string> = {
  [P in Paths]: Record<never, never> extends RouteParams<P>
    ? {to: P}
    : {to: P; params: RouteParams<P>};
}[Paths] &
  Omit<LinkProps, 'to' | 'prefetch' | 'href'>;

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

/**
 * Keys owned by the link components themselves when rendering through an
 * `as` component: the injection surface(`href`, the composed `onClick`,
 * NavLink's `aria-current`) plus React's reserved keys and the polymorphism
 * props' own names. They are stripped from the flattened `as`-props region
 * and from `asProps`, so a same-named prop of the `as` component can never
 * interfere with the navigation semantics.
 */
type AsManagedKeys =
  'as' | 'asProps' | 'ref' | 'key' | 'href' | 'onClick' | 'aria-current';

/**
 * Union-preserving `Omit`: the built-in collapses unions(`Omit<A | B, K>`
 * picks across the members), which would flatten the discriminated union
 * of {@link TypedLinkProps}.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/**
 * Union of every key appearing on any member: `keyof (A | B)` intersects
 * the members' keys, so a key living on only part of a union(`params` on
 * {@link TypedLinkProps}) would escape an `Omit` keyed on plain `keyof`.
 */
type KeysOfUnion<T> = T extends unknown ? keyof T : never;

/**
 * The `ref` an `as` component accepts — `{ref?: never}` when it does not
 * take one(i.e. is not wrapped in `forwardRef`), so passing a ref to such
 * a component is a compile error. The detection relies on how
 * `ComponentPropsWithRef` is typed: guaranteed under `@types/react` ≥ 19;
 * under `@types/react` 18 it always includes `ref`, so the guard degrades
 * to accepting the ref(and React warns at runtime that it is dropped).
 */
type AsRefProps<A extends ElementType> =
  'ref' extends keyof ComponentPropsWithRef<A>
    ? Pick<ComponentPropsWithRef<A>, 'ref'>
    : {ref?: never};

/**
 * Props of the link family({@link Link}, {@link NavLink},
 * {@link PrefetchLink}, {@link TypedLink}) when rendering through a custom
 * `as` component. Three regions, no ambiguity:
 *
 * 1. The component's own props(`Base`: `to`, anchor attributes, NavLink's
 *    active-state callbacks, ...) minus its anchor `ref`.
 * 2. The flattened `as`-props region: every prop of the `as` component
 *    that does not collide with `Base`(`variant`, `tone`, ...) is accepted
 *    directly on the link. A key appearing on any member of a union
 *    `Base` counts as colliding(`params` on {@link TypedLinkProps} is
 *    owned by the link, never by the `as` component).
 * 3. The `asProps` escape hatch for the colliding keys: only the props the
 *    `as` component shares with `Base`(`title`, `target`, ...) may be set
 *    there — `Pick` degrades to `{}` when there is no overlap — minus the
 *    managed keys(see {@link AsManagedKeys}), and it is spread last at
 *    runtime, explicitly overriding the base value.
 *
 * `href`, the composed `onClick` and NavLink's `aria-current` are always
 * injected by the link itself(see {@link AsManagedKeys}) and win over
 * everything else — neither the flattened region nor `asProps` can set
 * them; the `ref` is the `as` component's own, so it must be
 * ref-forwarding for `ref` to type-check.
 * @group Types
 * @category Link
 */
export type AsLinkProps<Base, A extends ElementType> = {
  as?: A;
  asProps?: Omit<
    Pick<
      ComponentPropsWithoutRef<A>,
      keyof Base & keyof ComponentPropsWithoutRef<A>
    >,
    AsManagedKeys
  >;
} & DistributiveOmit<Base, 'ref'> &
  Omit<ComponentPropsWithoutRef<A>, KeysOfUnion<Base> | AsManagedKeys> &
  AsRefProps<A>;

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
  // Click handling is owned by Link(user onClick runs first, then the
  // navigation decision); className/style/children are re-typed above to
  // accept the active-state callbacks.
  'className' | 'style' | 'children'
>;
