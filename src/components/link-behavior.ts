/**
 * Checks whether a click on an anchor should be intercepted and handled as an
 * in-app navigation, following the standard link interception semantics of
 * react-router/wouter: plain left clicks only.
 *
 * The browser keeps the default behavior whenever this returns `false`, so
 * modified clicks, middle clicks and links to other browsing contexts open in
 * a new tab/window as the user expects.
 *
 * @param e The click event to inspect.
 * @param target The anchor's `target` attribute, if any.
 * @param rel The anchor's `rel` attribute, if any.
 * @group Components
 */

/**
 * Interpolate params into a path pattern: `:name` segments take a
 * string, `*name` wildcards a string array(joined with `/`), both
 * percent-encoded; everything else — including `\` escapes — is static
 * text. The grammar matches the core matcher's(the ASCII identifier
 * scanner the type-level `ExtractPathParams` models).
 * @throws when a required param is missing or empty — the click-time
 * params check of `TypedLink`/`TypedNavLink`
 */
export function interpolatePath(
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
 * Serialize a search object into a query string: array values repeat the
 * key, `undefined`/`null` entries are dropped, everything else is
 * `String()`-ed and percent-encoded — the write-side inverse of the
 * core's `parseSearchInput` degradation, so a serialized search parses
 * back to the same shape(strings, arrays for repeated keys).
 *
 * Shared by the schema-aware search setters(see `useSetSearch`) and the
 * typed link family's `search` prop(see {@link appendSearch}).
 * @group Components
 */
export function stringifySearch(search: Record<string, unknown>): string {
  return Object.entries(search)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) =>
      (Array.isArray(value) ? value : [value])
        .map(
          (v) => `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`
        )
        .join('&')
    )
    .join('&');
}

/**
 * Append a search object to a target path as a query string — the typed
 * link family's `search` prop landing on the very target the href
 * preview, the prefetch and the click navigation all consume. An absent
 * or empty search leaves the target untouched; an existing query string
 * is extended with `&` instead of a second `?`.
 * @group Components
 */
export function appendSearch(
  to: string,
  search: Record<string, unknown> | undefined
): string {
  const qs = search && stringifySearch(search);
  return qs ? `${to}${to.includes('?') ? '&' : '?'}${qs}` : to;
}

export function shouldNavigate(
  e: {
    button: number;
    defaultPrevented: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  },
  target?: string,
  rel?: string
): boolean {
  return (
    !e.defaultPrevented &&
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey &&
    target !== '_blank' &&
    target !== '_parent' &&
    target !== '_top' &&
    !(rel ?? '').split(/\s+/).includes('external')
  );
}
