import type {AsLinkProps, TypedNavLinkProps} from '@@/types';
import {
  forwardRef,
  type ElementType,
  type MouseEvent,
  type ReactElement,
  type Ref
} from 'react';
import {interpolatePath} from './link-behavior';
import NavLink from './NavLink';

// Internal delegation to NavLink with the implementation-loose `as`
// shape; the public generic typing lives on the signatures below (the
// same pattern TypedLink uses for its discriminated union).
const LooseNavLink = NavLink as (props: any) => ReactElement | null;

/**
 * {@link NavLink} whose `to` is narrowed to a route table's path
 * patterns and whose `params` is checked against the exact pattern's
 * param segments — {@link TypedLink}'s type safety on an active-state
 * link. Give it the pattern union as its type argument:
 *
 * ```tsx
 * const routes = createRoutes({children: [{path: '/users/:id'}, ...]});
 *
 * <TypedNavLink<RoutePaths<typeof routes>> to="/users/:id" params={{id: '7'}} end>
 *   User 7
 * </TypedNavLink>
 * ```
 *
 * Everything NavLink does keeps working: `end`/`caseSensitive`,
 * active-state `className`/`style`/`children` callbacks, `ariaCurrent`,
 * and `as` composition (see {@link AsLinkProps}). At click time the
 * params are interpolated into the pattern(values percent-encoded,
 * wildcard segments joined with `/`) and the active state is computed on
 * the interpolated target; a missing required param throws instead of
 * navigating — the runtime backstop of the type-level check, unless the
 * `onClick` handler already called `preventDefault`.
 *
 * An `as` component with a single type argument —
 * `<TypedNavLink<Paths> to="/" end as={MyLink} variant="primary" />` —
 * renders through it with the `as`-props region unchecked(TypeScript
 * cannot infer the second type argument once the first is explicit; it
 * would fall back to the plain anchor). Give both type arguments to
 * keep the checking: `<TypedNavLink<Paths, typeof MyLink> ... />`.
 *
 * Without the type argument the component degrades to a plain
 * `NavLink`: any path, params optional.
 * @group Components
 * @param props `to`(a pattern of the table), `params`(per the pattern)
 * and the usual NavLink props
 */
function TypedNavLinkImpl(
  {
    to,
    params,
    onClick,
    ...rest
  }: {
    to: string;
    params?: Record<string, string | string[]>;
  } & Omit<TypedNavLinkProps, 'to' | 'params' | 'href'>,
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

  return <LooseNavLink to={target} onClick={handleClick} {...rest} ref={ref} />;
}

// Generic first for call sites, plain tail for ComponentProps(see
// TypedLink); the middle signature accepts a single type argument plus
// an `as` component with the `as`-props region unchecked.
const TypedNavLink = forwardRef(TypedNavLinkImpl) as {
  <Paths extends string = string, A extends ElementType = 'a'>(
    props: AsLinkProps<TypedNavLinkProps<Paths>, A>
  ): ReactElement | null;
  <Paths extends string = string>(
    props: TypedNavLinkProps<Paths> & {
      as?: ElementType;
      asProps?: Record<string, unknown>;
      ref?: Ref<HTMLAnchorElement>;
    } & Record<string, any>
  ): ReactElement | null;
  <Paths extends string = string>(
    props: TypedNavLinkProps<Paths>
  ): ReactElement | null;
  displayName?: string;
};

TypedNavLink.displayName = 'TypedNavLink';

export default TypedNavLink;
