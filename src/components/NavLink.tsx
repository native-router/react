import {toLocation} from '@native-router/core';
import type {NavLinkProps, NavLinkState} from '@@/types';
import {useCallback} from 'react';
import {useSyncExternalStore} from 'use-sync-external-store/shim';
import {useRouter} from './Router';
import Link from './Link';

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
 * @param props
 * @group Components
 */
export default function NavLink({
  to,
  end = false,
  caseSensitive = false,
  className,
  style,
  ariaCurrent,
  children,
  ...rest
}: NavLinkProps) {
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
    <Link
      to={to}
      {...rest}
      className={typeof className === 'function' ? className(state) : className}
      style={typeof style === 'function' ? style(state) : style}
      aria-current={isActive ? (ariaCurrent ?? 'page') : undefined}
    >
      {typeof children === 'function' ? children(state) : children}
    </Link>
  );
}
