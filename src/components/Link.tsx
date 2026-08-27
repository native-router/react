import {createHref, navigate} from '@native-router/core';
import type {AsLinkProps, LinkProps} from '@@/types';
import {
  forwardRef,
  useRef,
  type ElementType,
  type MouseEvent,
  type ReactElement,
  type Ref
} from 'react';
import {useRouter} from './Router';
import {shouldNavigate} from './link-behavior';

// The implementation works on the loose shape; the typed signature is
// attached below so the `as` generic is not threaded through forwardRef's
// typings(the same pattern TypedLink uses for its discriminated union).
type LinkImplProps = LinkProps & {
  as?: ElementType;
  asProps?: Record<string, unknown>;
};

/**
 * Link for navigate in app.
 *
 * Pass an `as` component to render through it instead of the plain anchor:
 * the computed `href` and the navigation-aware click handling are injected,
 * the component's non-conflicting props are accepted directly on the link
 * and its conflicting ones go through `asProps`(see {@link AsLinkProps}).
 * The component should forward its ref and spread the rest props onto the
 * DOM element it renders.
 * @param props
 * @group Components
 */
function LinkImpl(
  {to, as, asProps, onClick, ...rest}: LinkImplProps,
  ref: Ref<HTMLAnchorElement>
) {
  const router = useRouter();
  const lockRef = useRef(false);

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
    lockRef.current = true;
    navigate(router, to)
      .catch(() => undefined)
      .finally(() => {
        lockRef.current = false;
      });
  }

  const A = (as ?? 'a') as ElementType;
  // `aria-current` is NavLink's active-state injection(or a plain anchor
  // attribute on the others): a managed key, so it is injected after
  // asProps like href/onClick instead of traveling through the rest.
  const {'aria-current': ariaCurrent, ...anchorProps} = rest;
  return (
    <A
      {...anchorProps}
      {...asProps}
      ref={ref}
      href={createHref(router, to)}
      onClick={handleClick}
      aria-current={ariaCurrent}
    />
  );
}

// Two call signatures, generic first: call sites resolve through the `as`
// generic, while the plain non-generic signature placed LAST is what
// `ComponentProps<typeof Link>`-style helpers read — without it the
// uninstantiated generic collapses to its `ElementType` constraint and the
// ref becomes required `any`. The tail signature is exactly the pre-`as`
// public shape. The displayName slot keeps the component name settable
// despite the cast(the forwardRef wrapper shows its own name otherwise).
const Link = forwardRef(LinkImpl) as {
  <A extends ElementType = 'a'>(
    props: AsLinkProps<LinkProps, A>
  ): ReactElement | null;
  (props: LinkProps): ReactElement | null;
  displayName?: string;
};

Link.displayName = 'Link';

export default Link;
