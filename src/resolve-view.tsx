import type {ComponentType, ReactElement} from 'react';
import type {Context, ResolveViewContext, Route} from '@@/types';
import {
  mergeMatchedParams,
  parseSearch,
  parseSearchInput
} from '@native-router/core';
import type {Matched} from '@native-router/core';
import {DataProvider, MatchedContext, View, ViewProvider} from './context';

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
  {router, location}: ResolveViewContext<Route>,
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
        search: parseSearchInput(location.search)
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
          <DataProvider data={data} name={route.name}>
            <MatchedContext.Provider value={ctx}>
              <C />
            </MatchedContext.Provider>
          </DataProvider>
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
