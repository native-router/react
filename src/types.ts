import type {
  AnchorHTMLAttributes,
  ComponentType,
  DetailedHTMLProps,
  ReactNode
} from 'react';
import type {
  BaseRoute,
  Matched,
  Location,
  RouterInstance
} from '@native-router/core';

export type ResolveViewContext<R extends BaseRoute> = {
  // eslint-disable-next-line no-use-before-define
  router: RouterInstance<R>;
  location: Location;
};

export type Context<T extends BaseRoute> = {
  matched: Matched<T>[];
  index: number;
  router: RouterInstance<BaseRoute>;
  location: Location;
  params: Record<string, string>;
};

export type Route = BaseRoute<{
  name?: string;
  data?(ctx: Context<Route>): any | Promise<any>;
  component?(
    ctx: Context<Route>
  ): ComponentType | Promise<ComponentType | {default: ComponentType}>;
  errorComponent?: ComponentType<{error: Error; ctx: Context<Route>}>;
}>;

export type LoadStatus = {
  key: number;
  status: 'pending' | 'resolved' | 'rejected';
};

export type LinkProps = {
  to: string;
  /**
   * 预取策略：'intent'（默认，hover/focus 触发）、'render'（挂载即预取）、
   * 'viewport'（进入视口时预取）、'none'（不预取）
   */
  prefetch?: 'intent' | 'render' | 'viewport' | 'none';
  children?: ReactNode;
} & DetailedHTMLProps<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  HTMLAnchorElement
>;
