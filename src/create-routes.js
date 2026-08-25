/**
 * Identity function with `satisfies` semantics: the table is checked
 * against `Route` while every `path` keeps its string-literal type, so
 * `RoutePaths<typeof routes>` can extract the full pattern union for
 * `TypedLink`. An `as Route` assertion does the opposite — it widens
 * every `path` to `string` and gives up the literals.
 *
 * ```tsx
 * const routes = createRoutes({
 *   children: [
 *     {path: '/', component: () => import('./Home')},
 *     {path: '/users/:id', component: () => import('./UserProfile')}
 *   ]
 * });
 * // type AppPaths = '/' | '/users/:id'
 * type AppPaths = RoutePaths<typeof routes>;
 * ```
 *
 * Zero runtime cost: the function returns its argument unchanged and
 * tree-shakes away.
 * @group Methods
 * @category Route
 * @param routes the route table, a route object or an array of them
 * @returns the very same route table, literal types preserved
 */
export function createRoutes(
  // The `const` modifier keeps every `path` a string literal(through
  // arbitrary nesting) while the parameter is still checked against
  // `Route` — the `satisfies` semantics an `as Route` assertion lacks:
  // the assertion widens every `path` to `string` instead.
  routes
) {
  return routes;
}
