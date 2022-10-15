import type {Path, MatchResult} from 'path-to-regexp';
import type {Path as HPath} from 'history';
import { ComponentType } from 'react';

export type Location<T = any> = HPath & {state: T};

export type Awaitable<T> = T | Promise<T>;

export type BaseRoute<T = any> = {
  path?: Path;
  children?: BaseRoute<T>[];
} & Omit<T, 'path' | 'children'>;

export type Matched<R extends BaseRoute = BaseRoute> = {route: R} & MatchResult;

export type Options = {
  baseUrl?: string;
};

export type Router<R> = {
  routes: R[];
  baseUrl: string;
  options: Options;
};

export type Context<T extends BaseRoute> = {
  matched: Matched<T>[];
  index: number;
  router: Router<BaseRoute>;
  pathname: string;
  location: Location;
};

export type Route = BaseRoute<{
  name?: string;
  data?(params: any, ctx: Context<Route>): any | Promise<any>;
  component?(
    params: any,
    ctx: Context<Route>
  ): ComponentType | Promise<ComponentType | {default: ComponentType}>;
}>;
