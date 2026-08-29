import {createHref, navigate} from '@native-router/core';
import {
  forwardRef,
  useRef,
  type ElementType,
  type MouseEvent,
  type ReactElement,
  type Ref
} from 'react';
import type {AsLinkProps, TypedLinkProps} from '@@/types';
import {useRouter} from './Router';
import {interpolatePath, shouldNavigate} from './link-behavior';

/**
 * Link whose `to` is narrowed to a route table's path patterns and whose
 * `params` is checked against the exact pattern's param segments. Give
 * it the pattern union as its type argument:
 *
 * ```tsx
 * const routes = createRoutes({children: [{path: '/users/:id'}, ...]});
 *
 * <TypedLink<RoutePaths<typeof routes>> to="/users/:id" params={{id: '7'}}>
 *   User 7
 * </TypedLink>
 * ```
 *
 * A `to` outside the table, a missing required param or a wrong param
 * shape is a compile error; at click time the params are interpolated
 * into the pattern and a missing required param throws instead of
 * navigating(the type-level check's runtime backstop).
 *
 * Without the type argument the component degrades to a plain `Link`:
 * any path, params optional. Click interception follows {@link Link}
 * — only plain primary-button clicks are intercepted.
 *
 * An `as` component can be layered on top(`asProps`/flattened `as`-props
 * per {@link AsLinkProps}); give both type arguments to keep the pattern
 * narrowing: `<TypedLink<Paths, typeof MyLink> ... />`.
 * @group Components
 * @param props `to`(a pattern of the table), `params`(per the pattern)
 * and the usual anchor attributes
 */
// The implementation works on the loose shape; the typed signature is
// attached below so discriminated-union props need not be destructured
// across the union.
function TypedLinkImpl(
  {
    to,
    params,
    onClick,
    as,
    asProps,
    ...rest
  }: {
    to: string;
    params?: Record<string, string | string[]>;
    as?: ElementType;
    asProps?: Record<string, unknown>;
  } & Omit<TypedLinkProps, 'to' | 'params' | 'prefetch' | 'href'>,
  ref: Ref<HTMLAnchorElement>
) {
  const router = useRouter();
  const lockRef = useRef(false);

  // The href shows the interpolated target; when a required param is
  // missing the raw pattern stays and the click-time check below blocks
  // the navigation.
  let href: string = to;
  try {
    href = interpolatePath(to, params ?? {});
  } catch {
    // Programming error the types already flag; surfaced on click.
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // The user's onClick runs first with the same event; calling
    // e.preventDefault() there suppresses the navigation entirely.
    onClick?.(e);
    // Modified clicks, other buttons and links to another browsing context
    // keep the browser default behavior (open in new tab/window, etc).
    // asProps overrides the base anchor attributes at runtime, so the guard
    // judges the effective target/rel — the ones actually rendered.
    if (
      !shouldNavigate(
        e,
        (asProps?.target as string | undefined) ?? rest.target,
        (asProps?.rel as string | undefined) ?? rest.rel
      )
    )
      return;
    e.preventDefault();

    if (lockRef.current) return;
    // Click-time params check per the pattern's param segments: a missing
    // required param throws instead of navigating.
    const target = interpolatePath(to, params ?? {});
    lockRef.current = true;
    navigate(router, target)
      .catch(() => undefined)
      .finally(() => {
        lockRef.current = false;
      });
  }

  const A = (as ?? 'a') as ElementType;
  return (
    <A
      {...rest}
      {...asProps}
      ref={ref}
      href={createHref(router, href)}
      onClick={handleClick}
    />
  );
}

// Generic first for call sites, plain tail for ComponentProps(see Link);
// the tail keeps the pre-`as` discriminated-union shape.
const TypedLink = forwardRef(TypedLinkImpl) as {
  <Paths extends string = string, A extends ElementType = 'a'>(
    props: AsLinkProps<TypedLinkProps<Paths>, A>
  ): ReactElement | null;
  <Paths extends string = string>(
    props: TypedLinkProps<Paths>
  ): ReactElement | null;
  displayName?: string;
};

TypedLink.displayName = 'TypedLink';

export default TypedLink;
