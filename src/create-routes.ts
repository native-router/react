import type {Route, SearchRoutesOf} from '@@/types';

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
