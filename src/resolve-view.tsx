import type {ComponentType} from 'react';
import type {Matched, ResolveViewContext, Route} from '@@/types';
import {DataProvider, View, ViewProvider} from './context';

/**
 * The default implementation of resolve view
 * @param matched the matched result
 * @param viewContext resolved view context
 * @returns the resolve view
 * @see {@link create router->create}
 */
export default function resolveView(
  matched: Matched<Route>[],
  {router, location}: ResolveViewContext<Route>
) {
  return Promise.all(
    matched.map(({params, route}, index) => {
      const ctx = {
        matched: matched!,
        index,
        router,
        location
      };
      function resolveComponent(): ComponentType | Promise<ComponentType> {
        if (!route.component) return View;
        const r = route.component(params, ctx);
        return Promise.resolve(r).then((m) => ('default' in m ? m.default : m));
      }

      return Promise.all([route.data?.(params, ctx), resolveComponent()]).then(
        ([data, C]) => (
          <DataProvider data={data} name={route.name}>
            <C />
          </DataProvider>
        )
      );
    })
  ).then((views) =>
    views
      .reverse()
      .reduce((acc, view) => <ViewProvider value={acc}>{view}</ViewProvider>)
  );
}
