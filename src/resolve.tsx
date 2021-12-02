import {Component, FC} from 'react';
import type {Location} from '@@/types';
import {DataProvider, View, ViewProvider} from './context';
import {match, Matched, Route as BaseRoute, Router} from './router';

export type Context<T> = {
  matched: Matched<T>[];
  index: number;
  router: Router<BaseRoute>;
  pathname: string;
  location: Location;
};

type ReactComponent = Component | FC;

export type Route = BaseRoute<{
  name?: string;
  data?(params: any, ctx: Context<Route>): any | Promise<any>;
  component?(
    params: any,
    ctx: Context<Route>
  ): ReactComponent | Promise<ReactComponent | {default: ReactComponent}>;
}>;

export function resolve(
  router: Router<Route>,
  pathname: string,
  location: Location
) {
  const matched = match(router, pathname);
  if (!matched) return Promise.reject(new Error('Not Found'));
  return Promise.all(
    matched.map(({params, route}, index) => {
      const ctx = {
        matched: matched!,
        index,
        router,
        pathname,
        location
      };
      function resolveComponent() {
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
