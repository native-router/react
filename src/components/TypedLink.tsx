import {createHref, navigate} from '@native-router/core';
import {
  forwardRef,
  useRef,
  type ElementType,
  type MouseEvent,
  type ReactElement,
  type Ref
} from 'react';
import type {AsLinkProps, LinkProps, TypedLinkProps} from '@@/types';
import {useRouter} from './Router';
import PrefetchLink from './PrefetchLink';
import {interpolatePath, appendSearch, shouldNavigate} from './link-behavior';

// Internal delegation to PrefetchLink with the implementation-loose
// `as` shape; the public generic typing lives on the signatures below.
const LoosePrefetchLink = PrefetchLink as (props: any) => ReactElement | null;

/**
 * Link whose `to` is narrowed to a route table's path patterns and whose
 * `params` is checked against the exact pattern's param segments. Give
 * it the whole table as its type argument and `search` joins the check
 * too — typed by the pattern's route schema input:
 *
 * ```tsx
 * const routes = createRoutes({
 *   children: [
 *     {
 *       path: '/list',
 *       search: z.object({page: z.coerce.number()}),
 *       ...
 *     },
 *     {path: '/users/:id'}, ...
 *   ]
 * });
 *
 * <TypedLink<typeof routes> to="/list" search={{page: 2}}>
 *   Page 2
 * </TypedLink>
 * <TypedLink<typeof routes> to="/users/:id" params={{id: '7'}}>
 *   User 7
 * </TypedLink>
 * ```
 *
 * A `to` outside the table, a missing required param, a wrong param
 * shape or a `search` the pattern's schema rejects is a compile error;
 * at click time the params are interpolated into the pattern, the
 * search is serialized into the query string(`String()`-ed values,
 * arrays repeating the key, `undefined`/`null` dropped) and the route's
 * schema validates the result exactly as it would a hand-written URL —
 * a missing required param throws instead of navigating(the type-level
 * check's runtime backstop).
 *
 * The paths-union flavor — `TypedLink<RoutePaths<typeof routes>>` —
 * keeps working unchanged and keeps checking `to`/`params`, with
 * `search` loose(schemas do not ride a bare path string). Without any
 * type argument the component degrades to a plain `Link`: any path,
 * params and search optional. Click interception follows {@link Link}
 * — only plain primary-button clicks are intercepted.
 *
 * A `prefetch` strategy prop(the {@link PrefetchLink} values:
 * `'intent'`/`'render'`/`'viewport'`/`'none'`) upgrades the link in
 * place: declared, the link renders through `PrefetchLink` on the
 * interpolated target — every strategy, the `usePrefetch` preview
 * context and PrefetchLink's click path included — while the type
 * narrowing and the click-time missing-param backstop stay. Omitted,
 * the link stays a plain `Link`-path anchor byte for byte.
 *
 * An `as` component can be layered on top(`asProps`/flattened `as`-props
 * per {@link AsLinkProps}); give both type arguments to keep the pattern
 * narrowing: `<TypedLink<typeof routes, typeof MyLink> ... />`.
 * @group Components
 * @param props `to`(a pattern of the table), `params`(per the pattern),
 * `search`(the pattern's schema input), `prefetch`(optional strategy)
 * and the usual anchor attributes
 */
// The implementation works on the loose shape; the typed signature is
// attached below so discriminated-union props need not be destructured
// across the union.
function TypedLinkImpl(
  {
    to,
    params,
    search,
    onClick,
    prefetch,
    as,
    asProps,
    ...rest
  }: {
    to: string;
    params?: Record<string, string | string[]>;
    search?: Record<string, unknown>;
    prefetch?: LinkProps['prefetch'];
    as?: ElementType;
    asProps?: Record<string, unknown>;
  } & Omit<TypedLinkProps, 'to' | 'params' | 'search' | 'href'>,
  ref: Ref<HTMLAnchorElement>
) {
  const router = useRouter();
  const lockRef = useRef(false);

  // The href shows the interpolated target; when a required param is
  // missing the raw pattern stays and the click-time check below blocks
  // the navigation.
  let href: string = to;
  let missing = false;
  try {
    href = interpolatePath(to, params ?? {});
  } catch {
    // Programming error the types already flag; surfaced on click.
    missing = true;
  }

  // A declared prefetch strategy upgrades the link to a prefetching
  // one: everything from here on is `PrefetchLink`'s — strategies,
  // preview context, click path — on the same interpolated target.
  // The missing-param backstop keeps TypedLink's contract: the wrapped
  // onClick re-throws it before PrefetchLink commits anything.
  if (prefetch !== undefined) {
    return (
      <LoosePrefetchLink
        to={appendSearch(href, search)}
        prefetch={prefetch}
        as={as}
        asProps={asProps}
        {...rest}
        ref={ref}
        onClick={(e: MouseEvent<HTMLAnchorElement>) => {
          onClick?.(e);
          if (missing && !e.defaultPrevented) interpolatePath(to, params ?? {});
        }}
      />
    );
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
    // required param throws instead of navigating. The search joins the
    // target here too — the route's schema validates it on resolve.
    const target = interpolatePath(to, params ?? {});
    lockRef.current = true;
    navigate(router, appendSearch(target, search))
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
      href={createHref(router, appendSearch(href, search))}
      onClick={handleClick}
    />
  );
}

// Generic first for call sites, plain tail for ComponentProps(see Link);
// the tail keeps the pre-`as` discriminated-union shape with the loose
// default argument baked in (a generic tail would collapse to the
// unconstrained type parameter's `unknown` when read uninstantiated
// through ComponentProps).
const TypedLink = forwardRef(TypedLinkImpl) as {
  <PathsOrRoutes = string, A extends ElementType = 'a'>(
    props: AsLinkProps<TypedLinkProps<PathsOrRoutes>, A>
  ): ReactElement | null;
  (props: TypedLinkProps): ReactElement | null;
  displayName?: string;
};

TypedLink.displayName = 'TypedLink';

export default TypedLink;
