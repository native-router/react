import type {ComponentType, ReactElement} from 'react';
import type {Context, ResolveViewContext, Route} from '@@/types';
import {
  mergeMatchedParams,
  parseSearch,
  parseSearchInput
} from '@native-router/core';
import type {Matched} from '@native-router/core';
import {DataProvider, MatchedContext, View, ViewProvider} from './context';
import RouteErrorBoundary from './components/RouteErrorBoundary';

/**
 * The default implementation of resolve view
 * @param matched the matched result
 * @param viewContext resolved view context
 * @returns the resolve view
 * @see {@link create router->create}
 */
export default function resolveView(
  matched: Matched<Route>[],
  ctx: ResolveViewContext<Route>
) {
  return resolveViewBase(matched, ctx, (data, dataCtx) => data?.(dataCtx));
}

const viewDataMap = new WeakMap<ReactElement, any[]>();

/**
 * Fold the matched prefix's route contexts over the router's instance
 * context, deeper levels winning on key conflicts — the data-loader
 * twin of the merge core applies for `beforeLoad` guards. The base is
 * `router.context` first, the incoming `ctx.context` only as the
 * hand-rolled-context fallback: with core ≥ 1.15 the incoming value is
 * already folded over the WHOLE chain, and folding a prefix back over
 * it would leak deeper levels' keys into shallower loaders. Levels
 * without a `context` contribute nothing, so route-context-less tables
 * keep the exact instance value.
 */
function foldRouteContext(
  base: unknown,
  matched: Matched<Route>[],
  end: number
) {
  let merged = base;
  for (let i = 0; i <= end; i++) {
    const routeContext = matched[i].route.context;
    if (routeContext == null) continue;
    merged =
      merged == null
        ? {...(routeContext as object)}
        : {...(merged as object), ...(routeContext as object)};
  }
  return merged;
}

export function resolveViewServer(
  matched: Matched<Route>[],
  ctx: ResolveViewContext<Route>
) {
  const dataResults = new Array(matched.length);
  return resolveViewBase(matched, ctx, (data, dataCtx) =>
    Promise.resolve(data?.(dataCtx)).then(
      (result) => (dataResults[dataCtx.index] = result)
    )
  ).then((view) => {
    viewDataMap.set(view, dataResults);
    return view;
  });
}

export function createHydrateResolveView(data: any[]) {
  return (matched: Matched<Route>[], ctx: ResolveViewContext<Route>) =>
    resolveViewBase(matched, ctx, (_, dataCtx) => data[dataCtx.index]);
}

export function getViewData(view: ReactElement) {
  return viewDataMap.get(view);
}

function resolveViewBase(
  matched: Matched<Route>[],
  {router, location, signal, context}: ResolveViewContext<Route>,
  resolveData: (
    dataFetcher: ((ctx: Context<Route>) => any) | undefined,
    ctx: Context<Route>
  ) => any
) {
  return Promise.all(
    matched.map(({route}, index) => {
      // `search` starts as the degraded input and is upgraded to the
      // schema output before the data fetcher runs below; schema outputs
      // are user-typed(`Route<P, S>`), so the property stays `any` here.
      const ctx: Context<Route, Record<string, string>, any> = {
        matched: matched!,
        params: mergeMatchedParams(matched, index),
        index,
        router,
        location,
        search: parseSearchInput(location.search),
        // The instance context folded with this level's prefix of route
        // contexts (see foldRouteContext); the fallback covers
        // hand-rolled resolveView contexts like the one covering
        // `signal` below.
        context: foldRouteContext(router.context ?? context, matched, index),
        // The chain's abort signal(navigation-superseded/cancelled) is
        // forwarded to every level's loader; a hand-rolled resolveView
        // context without one still yields a never-aborting signal.
        signal: signal ?? new AbortController().signal
      };
      function resolveComponent(): ComponentType | Promise<ComponentType> {
        if (!route.component) return View;
        const r = route.component(ctx);
        return Promise.resolve(r).then((m) => ('default' in m ? m.default : m));
      }

      // The level's search schema runs before its data fetcher: the parsed
      // output replaces the degraded input in `ctx.search`, and a rejected
      // validation fails the level exactly like a data error.
      const resolveDataWithSearch = () =>
        route.search
          ? parseSearch(route.search, location.search).then((search) => {
              ctx.search = search;
              return resolveData(route.data, ctx);
            })
          : resolveData(route.data, ctx);

      // A level that fails to resolve (search, data or component) is
      // replaced by its route-level errorComponent when configured;
      // otherwise the error bubbles up to the global errorHandler as before.
      return Promise.all([resolveDataWithSearch(), resolveComponent()]).then(
        ([data, C]) => (
          // The boundary is the render-phase twin of the resolve-phase
          // fallback below: a component that throws while rendering is
          // caught here and rendered through the same route errorComponent
          // (with ctx.phase === 'render'), instead of crashing past the
          // route to the React root.
          // Keyed by the level's path so React never reuses one route's
          // boundary fiber for another's at the same slot: a retained
          // error state would otherwise leak across routes when the
          // tree diff lands the same position(the class instance — and
          // its `state.error` — survives the prop change, and React
          // replays the cached error during the swap). The level index
          // only disambiguates same-path levels of one chain.

          <RouteErrorBoundary
            // eslint-disable-next-line @eslint-react/no-array-index-key -- not a list key: a per-level boundary identity (path + level)
            key={`${index}:${route.path ?? ''}`}
            route={route}
            ctx={ctx}
            router={router}
          >
            <DataProvider data={data} name={route.name}>
              <MatchedContext.Provider value={ctx}>
                <C />
              </MatchedContext.Provider>
            </DataProvider>
          </RouteErrorBoundary>
        ),
        (error: Error) => {
          if (!route.errorComponent) throw error;
          return (
            <DataProvider data={undefined} name={route.name}>
              <MatchedContext.Provider value={ctx}>
                <route.errorComponent error={error} ctx={ctx} />
              </MatchedContext.Provider>
            </DataProvider>
          );
        }
      );
    })
  ).then((views) =>
    views
      .reverse()
      .reduce((acc, view) => <ViewProvider value={acc}>{view}</ViewProvider>)
  );
}
