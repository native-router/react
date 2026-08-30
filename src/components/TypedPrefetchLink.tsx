import type {AsLinkProps, TypedPrefetchLinkProps} from '@@/types';
import {forwardRef, type ElementType, type ReactElement, type Ref} from 'react';
import {appendSearch, interpolatePath} from './link-behavior';
import PrefetchLink from './PrefetchLink';

// Internal delegation to PrefetchLink with the implementation-loose
// `as` shape; the public generic typing lives on the signatures below.
const LoosePrefetchLink = PrefetchLink as (props: any) => ReactElement | null;

/**
 * {@link PrefetchLink} whose `to` is narrowed to a route table's path
 * patterns and whose `params` is checked against the exact pattern's
 * param segments — {@link TypedLink}'s type safety on a prefetching
 * link. Give it the whole table as its type argument and `search` joins
 * the check too, typed by the pattern's route schema input:
 *
 * ```tsx
 * const routes = createRoutes({
 *   children: [
 *     {path: '/users/:id'}, {path: '/list', search: listSearch}, ...
 *   ]
 * });
 *
 * <TypedPrefetchLink<typeof routes> to="/list" search={{page: 2}}>
 *   Page 2
 * </TypedPrefetchLink>
 * <TypedPrefetchLink<typeof routes>
 *   to="/users/:id"
 *   params={{id: '7'}}
 *   prefetch="intent"
 * >
 *   User 7
 * </TypedPrefetchLink>
 * ```
 *
 * Every prefetch strategy(`'intent'`/`'render'`/`'viewport'`/`'none'`)
 * keeps working on the interpolated target — search included, so the
 * prefetched entry is cached under the exact pathname+search it will
 * commit — and an `as` component can be layered on top(see {@link
 * AsLinkProps}) — with a single type argument the `as`-props region
 * stays unchecked(see {@link TypedNavLink}), with both arguments it is
 * fully checked.
 *
 * The paths-union flavor — `TypedPrefetchLink<RoutePaths<typeof
 * routes>>` — keeps working with `to`/`params` checked and `search`
 * loose(see {@link TypedLink}).
 *
 * Without the type argument the component degrades to a plain
 * `PrefetchLink`: any path, params and search optional.
 * @group Components
 * @param props `to`(a pattern of the table), `params`(per the pattern),
 * `search`(the pattern's schema input) and the usual PrefetchLink props
 */
function TypedPrefetchLinkImpl(
  {
    to,
    params,
    search,
    ...rest
  }: {
    to: string;
    params?: Record<string, string | string[]>;
    search?: Record<string, unknown>;
  } & Omit<TypedPrefetchLinkProps, 'to' | 'params' | 'search' | 'href'>,
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

  return (
    <LoosePrefetchLink to={appendSearch(target, search)} {...rest} ref={ref} />
  );
}

// Generic first for call sites, plain tail for ComponentProps(see
// TypedLink); the middle signature accepts a single type argument plus
// an `as` component with the `as`-props region unchecked.
const TypedPrefetchLink = forwardRef(TypedPrefetchLinkImpl) as {
  <PathsOrRoutes = string, A extends ElementType = 'a'>(
    props: AsLinkProps<TypedPrefetchLinkProps<PathsOrRoutes>, A>
  ): ReactElement | null;
  <PathsOrRoutes = string>(
    props: TypedPrefetchLinkProps<PathsOrRoutes> & {
      as?: ElementType;
      asProps?: Record<string, unknown>;
      ref?: Ref<HTMLAnchorElement>;
    } & Record<string, any>
  ): ReactElement | null;
  (props: TypedPrefetchLinkProps): ReactElement | null;
  displayName?: string;
};

TypedPrefetchLink.displayName = 'TypedPrefetchLink';

export default TypedPrefetchLink;
