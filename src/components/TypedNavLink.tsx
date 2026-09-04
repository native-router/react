import type {
  AsLinkProps,
  LinkProps,
  NavLinkProps,
  NavLinkState,
  TypedNavLinkProps
} from '@@/types';
import {
  forwardRef,
  type ElementType,
  type MouseEvent,
  type ReactElement,
  type Ref
} from 'react';
import {appendSearch, interpolatePath} from './link-behavior';
import NavLink, {useActiveState} from './NavLink';
import PrefetchLink from './PrefetchLink';
import {useRouter} from './Router';

// Internal delegation to NavLink/PrefetchLink with the
// implementation-loose `as` shape; the public generic typing lives on
// the signatures below (the same pattern TypedLink uses for its
// discriminated union).
const LooseNavLink = NavLink as (props: any) => ReactElement | null;
const LoosePrefetchLink = PrefetchLink as (props: any) => ReactElement | null;

/**
 * The prefetch flavor of `TypedNavLink`: NavLink's active-state
 * resolution rendered through `PrefetchLink`. Internal — the public
 * surface is `TypedNavLink`'s `prefetch` prop.
 */
const ActivePrefetchLink = forwardRef(function ActivePrefetchLink(
  {
    to,
    end = false,
    caseSensitive = false,
    className,
    style,
    ariaCurrent,
    children,
    ...rest
  }: NavLinkProps & {prefetch?: LinkProps['prefetch']},
  ref: Ref<HTMLAnchorElement>
) {
  const router = useRouter();
  const state: NavLinkState = useActiveState(router, to, end, caseSensitive);

  return (
    <LoosePrefetchLink
      to={to}
      {...rest}
      ref={ref}
      className={typeof className === 'function' ? className(state) : className}
      style={typeof style === 'function' ? style(state) : style}
      aria-current={state.isActive ? (ariaCurrent ?? 'page') : undefined}
    >
      {typeof children === 'function' ? children(state) : children}
    </LoosePrefetchLink>
  );
});

/**
 * {@link NavLink} whose `to` is narrowed to a route table's path
 * patterns and whose `params` is checked against the exact pattern's
 * param segments — {@link TypedLink}'s type safety on an active-state
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
 * <TypedNavLink<typeof routes> to="/users/:id" params={{id: '7'}} end>
 *   User 7
 * </TypedNavLink>
 * <TypedNavLink<typeof routes> to="/list" search={{page: 2}}>
 *   Page 2
 * </TypedNavLink>
 * ```
 *
 * Everything NavLink does keeps working: `end`/`caseSensitive`,
 * active-state `className`/`style`/`children` callbacks, `ariaCurrent`,
 * and `as` composition (see {@link AsLinkProps}). At click time the
 * params are interpolated into the pattern(values percent-encoded,
 * wildcard segments joined with `/`), the search is serialized into the
 * query string, and the active state is computed on the interpolated
 * pathname(search never affects matching); a missing required param
 * throws instead of navigating — the runtime backstop of the type-level
 * check, unless the `onClick` handler already called `preventDefault`.
 *
 * A `prefetch` strategy prop(the {@link PrefetchLink} values:
 * `'intent'`/`'render'`/`'viewport'`/`'none'`) upgrades the link in
 * place: declared, the active state keeps computing exactly as above
 * but the link renders through `PrefetchLink` on the interpolated
 * target — every strategy, the `usePrefetch` preview context and
 * PrefetchLink's click path included. Omitted, the link stays a plain
 * `NavLink` byte for byte.
 *
 * The paths-union flavor — `TypedNavLink<RoutePaths<typeof routes>>` —
 * keeps working with `to`/`params` checked and `search` loose(see
 * {@link TypedLink}).
 *
 * An `as` component with a single type argument —
 * `<TypedNavLink<Paths> to="/" end as={MyLink} variant="primary" />` —
 * renders through it with the `as`-props region unchecked(TypeScript
 * cannot infer the second type argument once the first is explicit; it
 * would fall back to the plain anchor). Give both type arguments to
 * keep the checking: `<TypedNavLink<typeof routes, typeof MyLink> ... />`.
 *
 * Without the type argument the component degrades to a plain
 * `NavLink`: any path, params and search optional.
 * @group Components
 * @param props `to`(a pattern of the table), `params`(per the pattern),
 * `search`(the pattern's schema input) and the usual NavLink props
 */
function TypedNavLinkImpl(
  {
    to,
    params,
    search,
    onClick,
    prefetch,
    ...rest
  }: {
    to: string;
    params?: Record<string, string | string[]>;
    search?: Record<string, unknown>;
    prefetch?: LinkProps['prefetch'];
  } & Omit<TypedNavLinkProps, 'to' | 'params' | 'search' | 'href'>,
  ref: Ref<HTMLAnchorElement>
) {
  // The href shows the interpolated target; when a required param is
  // missing the raw pattern stays and the click-time check below blocks
  // the navigation.
  let target = to;
  let missing = false;
  try {
    target = interpolatePath(to, params ?? {});
  } catch {
    // Programming error the types already flag; surfaced on click.
    missing = true;
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // The user's onClick runs first with the same event; calling
    // e.preventDefault() there suppresses the navigation entirely.
    onClick?.(e);
    if (missing && !e.defaultPrevented) {
      // Re-running the interpolation throws the missing-param error
      // out of the click handler, before NavLink's Link navigates.
      interpolatePath(to, params ?? {});
    }
  }

  // A declared prefetch strategy keeps the whole NavLink capability
  // set(end/caseSensitive, the active-state callbacks, ariaCurrent)
  // but renders through PrefetchLink on the interpolated target.
  if (prefetch !== undefined) {
    return (
      <ActivePrefetchLink
        to={appendSearch(target, search)}
        prefetch={prefetch}
        onClick={handleClick}
        {...rest}
        ref={ref}
      />
    );
  }

  return (
    <LooseNavLink
      to={appendSearch(target, search)}
      onClick={handleClick}
      {...rest}
      ref={ref}
    />
  );
}

// Generic first for call sites, plain tail for ComponentProps(see
// TypedLink); the middle signature accepts a single type argument plus
// an `as` component with the `as`-props region unchecked.
const TypedNavLink = forwardRef(TypedNavLinkImpl) as {
  <PathsOrRoutes = string, A extends ElementType = 'a'>(
    props: AsLinkProps<TypedNavLinkProps<PathsOrRoutes>, A>
  ): ReactElement | null;
  <PathsOrRoutes = string>(
    props: TypedNavLinkProps<PathsOrRoutes> & {
      as?: ElementType;
      asProps?: Record<string, unknown>;
      ref?: Ref<HTMLAnchorElement>;
    } & Record<string, any>
  ): ReactElement | null;
  (props: TypedNavLinkProps): ReactElement | null;
  displayName?: string;
};

TypedNavLink.displayName = 'TypedNavLink';

export default TypedNavLink;
