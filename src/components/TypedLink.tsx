import {createHref, navigate} from '@native-router/core';
import {useRef, type MouseEvent, type ReactElement} from 'react';
import type {TypedLinkProps} from '@@/types';
import {useRouter} from './Router';
import {shouldNavigate} from './link-behavior';

/**
 * Interpolate params into a path pattern: `:name` segments take a
 * string, `*name` wildcards a string array(joined with `/`), both
 * percent-encoded; everything else — including `\` escapes — is static
 * text. The grammar matches the core matcher's(the ASCII identifier
 * scanner the type-level `ExtractPathParams` models).
 * @throws when a required param is missing or empty — the click-time
 * params check of {@link TypedLink}
 */
function interpolatePath(
  pattern: string,
  params: Record<string, string | string[]>
): string {
  return pattern.replace(
    /\\.|[:*]([A-Za-z_$][A-Za-z0-9_$]*)/g,
    (match, name?: string) => {
      if (name === undefined) return match;
      const value = params[name];
      if (value === undefined || value.length === 0) {
        throw new Error(
          `Missing param "${name}" for the path pattern "${pattern}"`
        );
      }
      return (Array.isArray(value) ? value : [value])
        .map(encodeURIComponent)
        .join('/');
    }
  );
}

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
 * @group Components
 * @param props `to`(a pattern of the table), `params`(per the pattern)
 * and the usual anchor attributes
 */
// The implementation works on the loose shape; the typed signature is
// attached below so discriminated-union props need not be destructured
// across the union.
function TypedLinkImpl({
  to,
  params,
  onClick,
  ...rest
}: {
  to: string;
  params?: Record<string, string | string[]>;
} & Omit<TypedLinkProps, 'to' | 'params' | 'prefetch' | 'href'>) {
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
    onClick?.(e);
    // Modified clicks, other buttons and links to another browsing context
    // keep the browser default behavior (open in new tab/window, etc).
    if (!shouldNavigate(e, rest.target, rest.rel)) return;
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

  return (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a {...rest} href={createHref(router, href)} onClick={handleClick} />
  );
}

const TypedLink = TypedLinkImpl as <Paths extends string = string>(
  props: TypedLinkProps<Paths>
) => ReactElement | null;

export default TypedLink;
