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
// eslint-disable-next-line import/prefer-default-export -- named utility imported by Link/PrefetchLink
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
