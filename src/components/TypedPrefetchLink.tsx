import type {AsLinkProps, TypedPrefetchLinkProps} from '@@/types';
import {forwardRef, type ElementType, type ReactElement, type Ref} from 'react';
import {interpolatePath} from './link-behavior';
import PrefetchLink from './PrefetchLink';

// Internal delegation to PrefetchLink with the implementation-loose
// `as` shape; the public generic typing lives on the signatures below.
const LoosePrefetchLink = PrefetchLink as (props: any) => ReactElement | null;

/**
 * {@link PrefetchLink} whose `to` is narrowed to a route table's path
 * patterns and whose `params` is checked against the exact pattern's
 * param segments — {@link TypedLink}'s type safety on a prefetching
 * link. Give it the pattern union as its type argument:
 *
 * ```tsx
 * const routes = createRoutes({children: [{path: '/users/:id'}, ...]});
 *
 * <TypedPrefetchLink<RoutePaths<typeof routes>>
 *   to="/users/:id"
 *   params={{id: '7'}}
 *   prefetch="intent"
 * >
 *   User 7
 * </TypedPrefetchLink>
 * ```
 *
 * Every prefetch strategy(`'intent'`/`'render'`/`'viewport'`/`'none'`)
 * keeps working on the interpolated target, and an `as` component can
 * be layered on top(see {@link AsLinkProps}) — with a single type
 * argument the `as`-props region stays unchecked(see {@link
 * TypedNavLink}), with both arguments it is fully checked.
 *
 * Without the type argument the component degrades to a plain
 * `PrefetchLink`: any path, params optional.
 * @group Components
 * @param props `to`(a pattern of the table), `params`(per the pattern)
 * and the usual PrefetchLink props
 */
function TypedPrefetchLinkImpl(
  {
    to,
    params,
    ...rest
  }: {
    to: string;
    params?: Record<string, string | string[]>;
  } & Omit<TypedPrefetchLinkProps, 'to' | 'params' | 'href'>,
  ref: Ref<HTMLAnchorElement>
) {
  // The interpolated target is what prefetch, preview and click all
  // consume. A missing required param is a programming error the types
  // already flag; the raw pattern stays and PrefetchLink's own click
  // path surfaces the mismatch as a navigation failure.
  let target = to;
  try {
    target = interpolatePath(to, params ?? {});
  } catch {
    // Surfaced by the navigation failing to match the raw pattern.
  }

  return <LoosePrefetchLink to={target} {...rest} ref={ref} />;
}

// Generic first for call sites, plain tail for ComponentProps(see
// TypedLink); the middle signature accepts a single type argument plus
// an `as` component with the `as`-props region unchecked.
const TypedPrefetchLink = forwardRef(TypedPrefetchLinkImpl) as {
  <Paths extends string = string, A extends ElementType = 'a'>(
    props: AsLinkProps<TypedPrefetchLinkProps<Paths>, A>
  ): ReactElement | null;
  <Paths extends string = string>(
    props: TypedPrefetchLinkProps<Paths> & {
      as?: ElementType;
      asProps?: Record<string, unknown>;
      ref?: Ref<HTMLAnchorElement>;
    } & Record<string, any>
  ): ReactElement | null;
  <Paths extends string = string>(
    props: TypedPrefetchLinkProps<Paths>
  ): ReactElement | null;
  displayName?: string;
};

TypedPrefetchLink.displayName = 'TypedPrefetchLink';

export default TypedPrefetchLink;
