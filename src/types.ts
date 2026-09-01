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
  StandardSchemaV1 as CoreStandardSchemaV1
} from '@native-router/core';

export type ResolveViewContext<R extends BaseRoute, C = any> = {
  router: RouterInstance<R, any, C>;
  location: Location;
  /**
   * The navigation chain's abort signal, aborted when this navigation is
   * superseded or cancelled. Optional for custom `resolveView`
   * implementations: core always passes it, but hand-rolled contexts
   * (tests, SSR shims) keep compiling without it.
   */
  signal?: AbortSignal;
  /**
   * The router's {@link Options.context instance context} — the value
   * passed as `context` to the router. Core always passes it; optional
   * here for the same hand-rolled-context reason as `signal`.
   */
  context?: C;
};

export type Context<
  T extends BaseRoute,
  P = Record<string, string>,
  S = SearchInput,
  C = any
> = {
  matched: Matched<T>[];
  index: number;
  router: RouterInstance<T, any, C>;
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
   * The router's {@link Options.context instance context}: the value
   * passed as the `context` prop of `Router`/`HistoryRouter`/
   * `HashRouter`/`MemoryRouter`(or the `context` option of
   * `createRouter`), one per router instance — the injection point for
   * per-instance dependencies(an API client, config, i18n handles, test
   * fixtures) that a module singleton cannot isolate.
   *
   * Un-annotated loaders see it `any` — the loose default that keeps
   * differently typed levels assignable to plain `Route`(the same
   * treatment `search` gets). Thread the context type through the
   * {@link Route} generic(`Route<P, S, AppContext>`) to type it.
   */
  context: C;
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
 * for the `data` loader and the `beforeLoad` guard alike. Give the third
 * generic your app context shape — the value of the Router's `context`
 * prop — and the callbacks' `ctx.context` is typed from it, e.g.
 * `Route<'/list', {page: number}, {api: Api}>`.
 *
 * Without the search generic an untyped `ctx.search` stays `any` — the
 * default that keeps differently typed levels assignable to plain
 * `Route`: schema outputs are arbitrary(coerced numbers, defaults, ...),
 * so no single degraded shape is bivariant with all of them. The context
 * generic degrades to `any` for the same reason. At runtime
 * `ctx.search` holds the raw input object of `parseSearchInput`; see
 * `useSearch`
 * for the typed degraded shape. Prefer {@link createRoutes}: its
 * returned table derives every level's `ctx.search` from the level's own
 * schema(see {@link SearchRoutesOf}), so the manual generic is only
 * needed for hand-annotated route objects.
 * `children` accepts `Route<any, any>` so levels with different patterns
 * and search shapes nest without variance conflicts.
 * @group Types
 * @category Route
 */
export type Route<P extends string = string, S = any, C = any> = Omit<
  BaseRoute<{
    name?: string;
    data?(ctx: Context<Route, RouteParams<P>, S, C>): any | Promise<any>;
    component?(
      ctx: Context<Route, RouteParams<P>, S, C>
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
   * Route guard inherited from `BaseRoute`, re-typed by the search and
   * context generics: `ctx.search` is `S`, `ctx.context` is `C`(both
   * `any` by default — see the Route doc above). At runtime the search
   * holds the level's parsed search — the schema output, or the degraded
   * input without a schema — and the context holds the router's
   * `context` option. The guard context types `router` as
   * `RouterInstance<any>`: a precise `RouterInstance<Route>` here would
   * recurse into `Route`'s own members and break `Route`'s assignability
   * to plain `BaseRoute`.
   */
  beforeLoad?(
    ctx: GuardContext<any, S, Record<string, string>, C>
  ): Awaitable<string | void>;
  /** Path pattern; params of the contexts above are inferred from it. */
  path?: P;
  /**
   * `Route<any, any>` accepts levels with any path pattern and search
   * shape, so typed levels nest without variance conflicts. The
   * `search` field is inherited from `BaseRoute`, loosely typed — see
   * the Route doc above.
   */
  children?: Route<any, any, any>[];
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
  search: CoreStandardSchemaV1<any, infer Output>;
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
 * A context with only its `params` member replaced. An accumulated
 * params type of `unknown`(no path pattern contributed anything — see
 * {@link SearchRoutesOf}) passes the context through unchanged, so
 * param-less levels keep their original loose `Record<string, string>`.
 * @group Types
 * @category Route
 */
export type WithParams<C, P> = [unknown] extends [P]
  ? C
  : Omit<C, 'params'> & {params: P};

/**
 * The base every re-typed loader/guard context stands on: the loose
 * context when the callback declared none(a zero-arg `data: () => view`
 * infers `unknown`), intersected with the author's own annotation when
 * it did. Standing on the loose members keeps the re-typed function
 * assignable to the loose `Route` signatures(their method declarations
 * compare bivariantly — precise `params` are assignable to the raw
 * string map) while the author's custom shapes survive the intersection.
 */
type LooseCtxBase<Loose, C> = [unknown] extends [C] ? Loose : Loose & C;

/**
 * Params contributed by a level's own `path` pattern: the precise
 * {@link RouteParams} shape for a literal pattern, the legacy
 * `Record<string, string>` for a widened one, and `unknown`(nothing —
 * the accumulator identity) for a path-less layout level or a pattern
 * without params. Building block of {@link SearchRoutesOf}.
 */
type OwnPathParamsOf<T> = T extends {path?: infer PathT}
  ? [unknown] extends [PathT]
    ? unknown
    : PathT extends string
      ? keyof RouteParams<PathT> extends never
        ? unknown // A literal pattern without params: keep the loose shape
        : RouteParams<PathT>
      : unknown // `path?: undefined` — a layout level
  : unknown;

/**
 * Output type of a level's {@link Route.params params schema} when it
 * declares one, `unknown` otherwise.
 */
type ParamsSchemaOutputOf<T> = T extends {
  params: CoreStandardSchemaV1<any, infer Output>;
}
  ? Output
  : unknown;

/**
 * The runtime's level-by-level params spread `{...a, ...b}`:
 * `b`'s keys override `a`'s. `unknown` on either side is the
 * accumulator identity. The result is flattened so hovers and strict
 * type equality see one plain object.
 */
type MergeParams<A, B> = [unknown] extends [A]
  ? B
  : [unknown] extends [B]
    ? A
    : Flatten<Omit<A, keyof B> & B>;

/** Flatten an intersection of params objects into one plain object. */
type Flatten<T> = {[K in keyof T]: T[K]};

/**
 * Re-type a route table so every level's `data` loader and `beforeLoad`
 * guard derive their `ctx.search` AND `ctx.params` from the table
 * itself, closing both type loops — this is what {@link createRoutes}
 * returns.
 *
 * `ctx.search` comes from the level's own {@link Route.search search
 * schema} output(see {@link RouteSearchOf}). `ctx.params` mirrors the
 * runtime's accumulation: `data` loaders see the raw string params of
 * the matched prefix(`mergeMatchedParams`), `beforeLoad` guards see
 * them upgraded by any prefix level's {@link Route.params params
 * schema}(the deepest schema output seen replaces the map, deeper raw
 * segments spread over it). A level without params in its pattern — or
 * a whole table of widened paths — keeps the loose `Record<string,
 * string>` it always had: precision is progressive, never a breaking
 * re-type.
 *
 * Everything else passes through unchanged: `path` literals(so
 * `RoutePaths<typeof routes>` and `TypedLink` keep working), the
 * loaders' return types, and the rest of every level's members. A
 * callback that annotates its ctx with a shape the table contradicts
 * is rejected at the `data`/`beforeLoad` property; an un-annotated
 * callback written inside the literal is checked loosely against
 * `Route`(`ctx.search: any`, `ctx.params: Record<string, string>` —
 * TypeScript cannot contextually type a member from sibling
 * properties) and precisely on the returned table.
 * @group Types
 * @category Route
 */
export type SearchRoutesOf<
  T,
  GuardP = unknown,
  RawP = unknown
> = T extends readonly unknown[]
  ? {-readonly [K in keyof T]: SearchRoutesOf<T[K], GuardP, RawP>}
  : T extends Route
    ? T extends {
        data?: infer Data;
        beforeLoad?: infer BeforeLoad;
        children?: infer Children;
      }
      ? Omit<T, 'data' | 'beforeLoad' | 'children'> & {
          // The raw prefix params the data loader receives; the
          // schema-aware value the guard receives (a level's params
          // schema output replaces the whole accumulated map). The
          // re-typed contexts stand on the loose bases so zero-arg and
          // partially-annotated callbacks stay assignable to `Route`.
          data?: [unknown] extends [Data]
            ? undefined
            : Data extends (ctx: infer DataCtx) => infer R
              ? (
                  ctx: WithParams<
                    WithSearch<
                      LooseCtxBase<Context<Route>, DataCtx>,
                      RouteSearchOf<T>
                    >,
                    MergeParams<RawP, OwnPathParamsOf<T>>
                  >
                ) => R
              : Data;
          beforeLoad?: [unknown] extends [BeforeLoad]
            ? undefined
            : BeforeLoad extends (ctx: infer GuardCtx) => infer R
              ? (
                  ctx: WithParams<
                    WithSearch<
                      LooseCtxBase<
                        GuardContext<any, any, Record<string, string>, any>,
                        GuardCtx
                      >,
                      RouteSearchOf<T>
                    >,
                    [unknown] extends [ParamsSchemaOutputOf<T>]
                      ? MergeParams<GuardP, OwnPathParamsOf<T>>
                      : ParamsSchemaOutputOf<T>
                  >
                ) => R
              : BeforeLoad;
          children?: [unknown] extends [Children]
            ? undefined
            : SearchRoutesOf<
                Children,
                [unknown] extends [ParamsSchemaOutputOf<T>]
                  ? MergeParams<GuardP, OwnPathParamsOf<T>>
                  : ParamsSchemaOutputOf<T>,
                MergeParams<RawP, OwnPathParamsOf<T>>
              >;
        }
      : T
    : T;

/**
 * The data a {@link useData} read resolves to for one route level or
 * its `data` loader: the awaited return type of the loader.
 *
 * The channel couples neither paths nor props(see the README's *Typing
 * `useData`*): a view derives its annotation from the
 * loader it is written against — the same reference the route table
 * hangs — so the annotation carries a compile-time link to what
 * `route.data` resolves and cannot drift:
 *
 * ```tsx
 * const loadUser = ({params, signal}) => api.user(params.id, {signal});
 * // → Promise<User>
 * {path: '/users/:id', data: loadUser, component: () => UserView}
 *
 * // UserView
 * const user = useData<RouteDataOf<typeof loadUser>>(); // User | undefined
 * ```
 *
 * Resolution, in order:
 *
 * - a loader function → its awaited return type;
 * - a level with a `data` loader → that loader's awaited return type
 *   (a level holding both `data` and `children` still reads its own);
 * - an object level without `data` — the key absent or `undefined` — →
 *   `undefined`, the value `useData()` returns there at runtime. (Weak
 *   type checking makes the property pattern below miss such levels —
 *   no overlapping member — so the miss IS the signal, not a failure);
 * - anything else — a table array(many levels, no single data type), a
 *   hand-annotated `Route` whose `data` is the broad optional signature
 *   (its `any` return collapses here too), a non-route input — →
 *   `unknown`, the same loose fallback a bare `useData()` has. Inference
 *   failure degrades to the loose read; it never becomes a compile
 *   error.
 *
 * Per-level semantics mirror the runtime's nearest-provider rule: a view
 * reads the data of its own matched level, so a nested chain with
 * loaders at several levels types each level through its own reference
 * (named data of ancestors is read through `useNamedData`, which stays
 * manually typed).
 * @group Types
 * @category Route
 */
export type RouteDataOf<S> = S extends (ctx: any) => infer R
  ? LoaderReturn<R>
  : S extends readonly unknown[]
    ? unknown
    : S extends object
      ? S extends {data?: infer D}
        ? D extends (ctx: any) => infer R
          ? LoaderReturn<R>
          : D extends undefined
            ? undefined
            : unknown
        : undefined
      : unknown;

/**
 * Await a loader's return, collapsing `any` — widened `as Route` tables,
 * loosely annotated loaders — into the loose `unknown` fallback instead
 * of letting it silently switch off checking downstream. Building block
 * of {@link RouteDataOf}.
 */
type LoaderReturn<R> = 0 extends 1 & Awaited<R> ? unknown : Awaited<R>;

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
 * One member of the {@link TypedLinkProps} discriminated union: `to`
 * narrowed to a single pattern, `params` required exactly when the
 * pattern has param segments(`:name` → `{name: string}`,
 * `*name` → `{name: string[]}`, static patterns take none — see
 * {@link RouteParams}), and `search` typed by whoever collected the
 * member(the schema input for a table, the loose
 * {@link SearchInput} for a bare paths union).
 */
type TypedLinkMember<P extends string, Search> =
  Record<never, never> extends RouteParams<P>
    ? {to: P; search?: Search}
    : {to: P; params: RouteParams<P>; search?: Search};

/**
 * The {@link TypedLinkProps} union collected from a whole route TABLE:
 * recursion mirrors {@link RoutePaths} — a level with `children`
 * contributes only the concatenated parent+child patterns(the runtime
 * matcher requires a child to consume the remainder), a `path`-less
 * layout passes its children through, a leaf contributes its own
 * pattern — except each pattern now carries its leaf level's search
 * input type(see {@link RouteSearchInputOf}) alongside it, so `to`
 * discrimination picks the right `search` shape too. A widened `path`
 * (an `as Route` assertion) degrades the whole union to the loose
 * single-member shape, exactly like `RoutePaths` degrades to `string`.
 */
type TypedLinkMembersOf<Table> = Table extends readonly (infer R)[]
  ? RouteLinkMembers<R>
  : RouteLinkMembers<Table>;

type RouteLinkMembers<R> = R extends {path?: infer P; children?: infer C}
  ? [P] extends [never]
    ? never
    : unknown extends P
      ? C extends readonly unknown[]
        ? TypedLinkMembersOf<C>
        : never
      : string extends P
        ? TypedLinkMember<string, SearchInput>
        : C extends readonly unknown[]
          ? PrefixedLinkMembers<P & string, TypedLinkMembersOf<C>>
          : TypedLinkMember<OwnPath<P>, RouteSearchInputOf<R>>
  : never;

/**
 * Re-prefix every member's `to` with the parent's pattern
 * (`{to: '/:id'}` under `'/users'` → `{to: '/users/:id'}`); params and
 * search ride along untouched. A widened child member degrades to the
 * loose single-member shape(the member-twin of `ParentPaths`).
 */
type PrefixedLinkMembers<P extends string, Members> = Members extends {
  to: infer T;
}
  ? string extends T
    ? TypedLinkMember<string, SearchInput>
    : T extends string
      ? {to: `${P}${T}`} & Omit<Members, 'to'>
      : never
  : never;

/**
 * Props of {@link TypedLink}: a discriminated union over the route
 * table, so `params` is checked against the param segments of the exact
 * `to` pattern — omitted for static patterns, required with
 * `{name: string}` for `:name` segments and `{name: string[]}` for
 * `*name` wildcards(see {@link RouteParams}) — and `search` is checked
 * against that pattern's route schema input(see
 * {@link RouteSearchInputOf}), serialized into the href and the
 * navigation target.
 *
 * Give the component the whole table as its type argument —
 * `TypedLink<typeof routes>` over a `createRoutes` table — and `to`,
 * `params` and `search` are all checked per pattern. The paths-union
 * flavor keeps working too: `TypedLink<RoutePaths<typeof routes>>`
 * checks `to`/`params` as before, with `search` loose
 * ({@link SearchInput}) since a bare path string carries no schema.
 * @group Types
 * @category Link
 */
export type TypedLinkProps<PathsOrRoutes = string> =
  (PathsOrRoutes extends string
    ? {[P in PathsOrRoutes]: TypedLinkMember<P, SearchInput>}[PathsOrRoutes]
    : TypedLinkMembersOf<PathsOrRoutes>) &
    Omit<LinkProps, 'to' | 'prefetch' | 'href'>;

/**
 * Props of {@link TypedNavLink}: the {@link TypedLinkProps} discriminated
 * union over the route table(`to` narrowed, `params` and `search`
 * checked per pattern) combined with every NavLink capability — `end`,
 * `caseSensitive`, the active-state `className`/`style`/`children`
 * callbacks and `ariaCurrent`.
 *
 * Give the component the table as its type argument:
 * `TypedNavLink<typeof routes>`(or the paths-union flavor, see
 * {@link TypedLinkProps}).
 * @group Types
 * @category Link
 */
export type TypedNavLinkProps<PathsOrRoutes = string> =
  (PathsOrRoutes extends string
    ? {[P in PathsOrRoutes]: TypedLinkMember<P, SearchInput>}[PathsOrRoutes]
    : TypedLinkMembersOf<PathsOrRoutes>) &
    Omit<NavLinkProps, 'to' | 'href'>;

/**
 * Props of {@link TypedPrefetchLink}: the same discriminated union as
 * {@link TypedLinkProps}(`to` narrowed, `params` and `search` checked
 * per pattern), with the `prefetch` strategy prop kept.
 * @group Types
 * @category Link
 */
export type TypedPrefetchLinkProps<PathsOrRoutes = string> =
  (PathsOrRoutes extends string
    ? {[P in PathsOrRoutes]: TypedLinkMember<P, SearchInput>}[PathsOrRoutes]
    : TypedLinkMembersOf<PathsOrRoutes>) &
    Omit<LinkProps, 'to' | 'href'>;

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

export type {SearchInput, SearchOutputOf} from '@native-router/core';

/**
 * The [Standard Schema](https://standardschema.dev) interface, version 1,
 * as this package re-exports it: the core's inlined shape plus the spec's
 * optional `~standard.types` phantom pair — the ONLY member able to carry
 * the schema's INPUT type(`validate`'s signature only ever mentions the
 * output). zod/valibot/arktype schemas expose it, which is what lets
 * {@link RouteSearchInputOf} extract the URL-side input type a link's
 * `search` prop accepts; schemas without it(a bare `validate`, older
 * vendors, hand-written fixtures) stay perfectly assignable — their
 * input just degrades to the loose {@link SearchInput}.
 *
 * The `types` property never holds a runtime value: vendors write
 * `types: undefined as unknown as Types<Input, Output>` precisely so
 * the pair rides the static type. Structurally compatible with the
 * core's `StandardSchemaV1` in both directions(the extra member is
 * optional), so existing annotations keep working unchanged.
 *
 * The spec's `Props`/`Types` inner interfaces ship as flat siblings
 * (`StandardSchemaV1Props`/`StandardSchemaV1Types`) rather than a
 * namespace declaration.
 * @group Types
 * @category Route
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1Props<Input, Output>;
}

/**
 * The `~standard` properties of {@link StandardSchemaV1}: the core's
 * spec shape(`version`/`vendor`/`validate`) plus the optional
 * input/output phantom pair. See {@link StandardSchemaV1}.
 * @group Types
 * @category Route
 */
export interface StandardSchemaV1Props<
  Input = unknown,
  Output = Input
> extends CoreStandardSchemaV1.Props<Input, Output> {
  readonly types?: StandardSchemaV1Types<Input, Output> | undefined;
}

/**
 * The phantom input/output pair of {@link StandardSchemaV1Props}; see
 * {@link StandardSchemaV1}.
 * @group Types
 * @category Route
 */
export interface StandardSchemaV1Types<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

/**
 * The search a link passes to a route: the level's own
 * {@link Route.search search schema} INPUT — the URL-side type, what the
 * query string degrades into before the schema coerces/defaults it —
 * or the loose {@link SearchInput} when the level declares no schema or
 * the schema's static type carries no input(see
 * {@link StandardSchemaV1}). The output-side twin consumed by
 * `data`/`beforeLoad` is {@link RouteSearchOf}.
 *
 * Input, not output, is the honest contract for a link: the link
 * serializes(`String()`-ed, arrays repeating the key) and the schema
 * validates the result exactly as it would a hand-written URL, so a
 * field the schema accepts only as a coerced output(a `Date`, a
 * transformed enum) is not offerable here — a coerce-flavored schema
 * (`z.coerce.number()`, input `unknown`) checks keys and leaves values
 * loose, a strict one checks values too.
 * @group Types
 * @category Route
 */
export type RouteSearchInputOf<R> = R extends {
  search: StandardSchemaV1<infer Input, any>;
}
  ? [unknown] extends [Input]
    ? SearchInput
    : Input
  : SearchInput;

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
