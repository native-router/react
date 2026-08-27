import {toLocation} from '@native-router/core';
import type {AsLinkProps, NavLinkProps, NavLinkState} from '@@/types';
import {
  forwardRef,
  useCallback,
  type ElementType,
  type ReactElement,
  type Ref
} from 'react';
import {useSyncExternalStore} from 'use-sync-external-store/shim';
import {useRouter} from './Router';
import Link from './Link';

type NavLinkImplProps = NavLinkProps & {
  as?: ElementType;
  asProps?: Record<string, unknown>;
};

// Internal delegation to Link with the implementation-loose `as` shape;
// the public generic typing lives on both components' public signatures.
const LooseLink = Link as (props: any) => ReactElement | null;

/**
 * Link that knows whether its target matches the current location.
 *
 * Active rules(aligned with react-router's `NavLink`):
 *
 * - `target` is the pathname of `toLocation(router, to)`(baseUrl prepended),
 *   `current` is `router.history.location.pathname`; both are lowercased
 *   unless `caseSensitive` is set.
 * - `isExactActive`: `current === target`.
 * - `isActive`: `isExactActive` when `end` is set, otherwise `current` equals
 *   `target` or starts with `target` plus a trailing `/`(so `to="/"` is active
 *   for every path).
 *
 * While active the anchor renders `aria-current={ariaCurrent ?? 'page'}` and
 * `className`/`style`/`children` receive the active state when given as
 * functions. Click behavior is delegated to {@link Link}, inheriting the
 * modified-click guard and the double-click lock.
 *
 * Pass an `as` component to render through it instead of the plain anchor
 * (see {@link AsLinkProps}): the active-state callbacks, the computed
 * `className`/`style` and the injected `aria-current` flow to it like any
 * other prop.
 * @param props
 * @group Components
 */
function NavLinkImpl(
  {
    to,
    end = false,
    caseSensitive = false,
    className,
    style,
    ariaCurrent,
    children,
    as,
    asProps,
    ...rest
  }: NavLinkImplProps,
  ref: Ref<HTMLAnchorElement>
) {
  const router = useRouter();
  // Subscribe to the history location so the active state stays in sync even
  // when rendered outside the routed view(e.g. a nav bar beside <View />).
  const subscribe = useCallback(
    (onStoreChange: () => void) => router.history.listen(() => onStoreChange()),
    [router]
  );
  const getSnapshot = useCallback(
    () => router.history.location.pathname,
    [router]
  );
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const target = toLocation(router, to).pathname;
  const [currentPath, targetPath] = caseSensitive
    ? [current, target]
    : [current.toLowerCase(), target.toLowerCase()];

  const isExactActive = currentPath === targetPath;
  // A root `to="/"` normalizes to the "/" prefix and matches every path.
  const isActive =
    end || isExactActive
      ? isExactActive
      : currentPath.startsWith(
          targetPath.endsWith('/') ? targetPath : `${targetPath}/`
        );

  const state: NavLinkState = {isActive, isExactActive};

  return (
    <LooseLink
      to={to}
      {...rest}
      as={as}
      asProps={asProps}
      ref={ref}
      className={typeof className === 'function' ? className(state) : className}
      style={typeof style === 'function' ? style(state) : style}
      aria-current={isActive ? (ariaCurrent ?? 'page') : undefined}
    >
      {typeof children === 'function' ? children(state) : children}
    </LooseLink>
  );
}

// Generic first for call sites, plain tail for ComponentProps(see Link).
const NavLink = forwardRef(NavLinkImpl) as {
  <A extends ElementType = 'a'>(
    props: AsLinkProps<NavLinkProps, A>
  ): ReactElement | null;
  (props: NavLinkProps): ReactElement | null;
  displayName?: string;
};

NavLink.displayName = 'NavLink';

export default NavLink;
