import type {ComponentType, ReactElement} from 'react';
import type {Context, Matched, ResolveViewContext, Route} from '@@/types';
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
    matched.map(({params, route}, index) => {
      const ctx = {
        matched: matched!,
        params,
        index,
        router,
        location
      };
      function resolveComponent(): ComponentType | Promise<ComponentType> {
        if (!route.component) return View;
        const r = route.component(ctx);
        return Promise.resolve(r).then((m) => ('default' in m ? m.default : m));
      }

      return Promise.all([
        resolveData(route.data, ctx),
        resolveComponent()
      ]).then(([data, C]) => (
        <DataProvider data={data} name={route.name}>
          <MatchedContext.Provider value={ctx}>
            <C />
          </MatchedContext.Provider>
        </DataProvider>
      ));
    })
  ).then((views) =>
    views
      .reverse()
      .reduce((acc, view) => <ViewProvider value={acc}>{view}</ViewProvider>)
  );
}
