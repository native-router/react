import type {
  Route,
  SearchInput,
  SearchRoutesOf,
  StandardSchemaV1
} from '@@/types';

/**
 * Identity function with `satisfies` semantics: the table is checked
 * against `Route` while every `path` keeps its string-literal type, so
 * `RoutePaths<typeof routes>` can extract the full pattern union for
 * `TypedLink`. An `as Route` assertion does the opposite — it widens
 * every `path` to `string` and gives up the literals.
 *
 * The return type additionally closes the search and params loops(see
 * {@link SearchRoutesOf}): every level's `data` loader and `beforeLoad`
 * guard receive their `ctx.search` typed from the level's own
 * {@link Route.search search schema}, and their `ctx.params` typed from
 * the accumulated path patterns of the matched prefix —
 *
 * ```tsx
 * const routes = createRoutes({
 *   children: [
 *     {
 *       path: '/lists/:list',
 *       search: z.object({page: z.coerce.number()}),
 *       // typeof routes → ctx.search: {page: number}, ctx.params:
 *       // {list: string}, no annotations
 *       data: ({search, params}) => fetchList(params.list, search.page)
 *     }
 *   ]
 * });
 * ```
 *
 * Callbacks written inside the literal are still checked loosely
 * against `Route`(`ctx.search: any`, `ctx.params: Record<string,
 * string>` — TypeScript cannot contextually type a member from sibling
 * properties); the precise types hold on the returned table, and a
 * callback whose annotation contradicts the schema is rejected at the
 * property. An explicit `Route<P, S>` generic keeps priority wherever
 * it is written.
 *
 * Zero runtime cost: the function returns its argument unchanged and
 * tree-shakes away.
 * @group Methods
 * @category Route
 * @param routes the route table, a route object or an array of them
 * @returns the very same route table, literal types preserved and the
 * loader/guard search and params contexts re-typed from the schemas and
 * path patterns
 */
export function createRoutes<const T>(
  // The `const` modifier keeps every `path` a string literal(through
  // arbitrary nesting) while the parameter is still checked against
  // `Route` — the `satisfies` semantics an `as Route` assertion lacks:
  // the assertion widens every `path` to `string` instead. The
  // `SearchRoutesOf<T>` member re-types the level contexts on the
  // checked argument, so an annotation that contradicts the level's
  // schema fails right at the property.
  routes: T & SearchRoutesOf<T> & (Route | Route[])
): SearchRoutesOf<T> {
  return routes;
}

/**
 * The search output a factory config's callbacks are typed with: the
 * schema's output when one is given, the degraded {@link SearchInput}
 * without one. Building block of {@link createRoute}.
 */
type FactorySearchOf<S> =
  S extends StandardSchemaV1<any, infer Output> ? Output : SearchInput;

/**
 * Build a single route with WRITE-TIME typed callbacks — the factory
 * twin of {@link createRoutes}, for authors who prefer one level at a
 * time:
 *
 * ```tsx
 * const listRoute = createRoute('/lists/:list', listSearch, {
 *   // ctx.search: {page: number}, ctx.params: {list: string} — typed
 *   // while you write it, no annotations
 *   data: ({search, params}) => fetchList(params.list, search.page)
 * });
 * ```
 *
 * Passing the {@link Route.search search schema} as the SECOND argument
 * is what buys the write-time `ctx.search`: TypeScript contextually
 * types a parameter from EARLIER arguments only, so a schema declared
 * inside the config object cannot type its sibling callbacks(the
 * createRoutes doc explains the same limitation). The two-argument
 * form — `createRoute(path, {search, ...})` — accepts the schema
 * inside the config: `ctx.params` is still write-time typed from the
 * path pattern, `ctx.search` degrades to the loose `SearchInput`, and
 * the returned route's callbacks are re-typed precisely all the same
 * (see {@link SearchRoutesOf}).
 *
 * The return keeps everything the written config carries — the literal
 * callbacks WITH their contextually-typed parameters and their return
 * types(so `RouteDataOf<typeof route.data>` and `useData` keep
 * working), plus the `path` literal and the `search` schema attached.
 * Nest the results through `children` and the literals accumulate the
 * same way a `createRoutes` table's do — `RoutePaths` and
 * `TypedLink`/`TypedNavLink` unions keep closing over them.
 *
 * Zero runtime cost beyond an object spread: `{path, search?, ...config}`
 * (the search spreads in first; a `search` repeated inside the config
 * wins, so pick ONE place for it).
 * @group Methods
 * @category Route
 * @param path the path pattern, kept as a string literal
 * @param search the search schema — pass it here for write-time typed
 * `ctx.search`
 * @param config the rest of the route(data/component/beforeLoad/
 * errorComponent/pendingComponent/context/children/...)
 * @returns the route object: literal path preserved, search attached,
 * the written callbacks carried over untouched
 */
export function createRoute<
  const P extends string,
  S extends StandardSchemaV1<any, any> | undefined,
  C extends Route[] | undefined,
  const T extends object
>(
  path: P,
  search: S,
  config: Route<P, FactorySearchOf<S>> & {children?: C} & T
): T & {path: P; search: S};
export function createRoute<
  const P extends string,
  C extends Route[] | undefined,
  const T extends object
>(path: P, config: Route<P, SearchInput> & {children?: C} & T): T & {path: P};
export function createRoute(
  path: string,
  searchOrConfig: unknown,
  maybeConfig?: unknown
) {
  if (maybeConfig === undefined) {
    return {path, ...(searchOrConfig as object)};
  }
  return {
    path,
    ...(searchOrConfig === undefined ? undefined : {search: searchOrConfig}),
    ...(maybeConfig as object)
  };
}
