import {commit, commitReplace, createHref, preload} from '@native-router/core';
import type {ResolvedEntry} from '@native-router/core';
import type {AsLinkProps, LinkProps, Route} from '@@/types';
import {
  createContext,
  forwardRef,
  MouseEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type ReactElement,
  type Ref
} from 'react';
import {useRouter} from './Router';
import {shouldNavigate} from './link-behavior';

type PrefetchLinkContext = {loading: boolean; error?: Error; view?: ReactNode};

const Context = createContext<PrefetchLinkContext>({loading: false});

/**
 * Get the prefetch context. Use for render a preview view.
 * @group Hooks
 */
export function usePrefetch() {
  return useContext(Context);
}

type PrefetchLinkImplProps = LinkProps & {
  as?: ElementType;
  asProps?: Record<string, unknown>;
};

/**
 * Link with prefetch support.
 *
 * The `prefetch` prop controls when the target view is resolved:
 * - `'intent'` (default): prefetch on hover or focus.
 * - `'render'`: prefetch as soon as the link mounts.
 * - `'viewport'`: prefetch when the link scrolls into the viewport.
 * - `'none'`: never prefetch; the target is resolved on click.
 *
 * Pass an `as` component to render through it instead of the plain anchor
 * (see {@link AsLinkProps}); every strategy keeps working. The `viewport`
 * strategy observes the DOM node the component forwards its ref to, so a
 * component that does not forward the ref down to a DOM element never
 * triggers a viewport prefetch.
 * @param props
 * @group Components
 */
function PrefetchLinkImpl(
  {
    to,
    prefetch = 'intent',
    children,
    as,
    asProps,
    onClick,
    ...rest
  }: PrefetchLinkImplProps,
  forwardedRef: Ref<HTMLAnchorElement>
) {
  const router = useRouter();
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const entryRef = useRef<Promise<ResolvedEntry<ReactNode>> | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const [view, setView] = useState<ReactNode>();

  // Feed both the internal viewport-observation ref and the user's ref.
  const setAnchorRef = useCallback(
    (node: HTMLAnchorElement | null) => {
      anchorRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );

  function prefetchIt(): Promise<ResolvedEntry<ReactNode>> {
    setLoading(true);
    setError(undefined);
    // Route guards(redirect/beforeLoad) run before the view resolves; the
    // stored entry carries the terminal location, so prefetch, preview and
    // commit all agree on the final target. preload() caches the entry at
    // the router level(keyed by pathname+search, TTL bounded), so repeated
    // prefetches of the same target share one resolution and the entry is
    // evicted once committed.
    const entryPromise = preload<Route, ReactNode>(router, to);
    entryRef.current = entryPromise;
    // The derived chain carries the loading/error/view state and handles
    // the rejection of the entry task, so a prefetched task that is never
    // committed does not surface as a global unhandledrejection. A failure
    // also drops the stored entry — but only while this promise is still
    // the stored one, so a superseding prefetch(to change, retry) is not
    // clobbered — letting a later hover retry instead of reusing the
    // rejected promise forever.
    entryPromise
      .then((entry) => entry.task)
      .then(
        (v) => setView(v),
        (e) => {
          setError(e);
          if (entryRef.current === entryPromise) {
            entryRef.current = undefined;
          }
        }
      )
      .finally(() => setLoading(false));
    return entryPromise;
  }

  function handlePrefetch() {
    if (entryRef.current) return;
    prefetchIt();
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
    // Always resolve through preload(), never through the stored entry: a
    // component-local entry is invisible to invalidate(router) and to the
    // TTL/commit evictions of the router-level cache, so committing it
    // directly could land a stale guard-passed target without re-running
    // the guards. Within the TTL preload() hands back the very same cached
    // entry promise, so the happy path re-validation is free.
    const entryPromise = prefetchIt();
    // The terminal location of the entry is committed, not the link target.
    // A redirect entry flagged `replace` lands through commitReplace, so a
    // guard like "must not leave the protected URL in history" keeps its
    // promise even when the redirect came from a prefetch.
    entryPromise
      .then((entry) =>
        entry.replace
          ? commitReplace(router, entry.task, entry.location)
          : commit(router, entry.task, entry.location)
      )
      .catch(() => undefined)
      .finally(() => {
        entryRef.current = undefined;
      });
  }

  // Reset every piece of prefetch state when the target changes, so a stale
  // error or preview from the previous target is not rendered for the new one.
  useEffect(() => {
    entryRef.current = undefined;
    setLoading(false);
    setError(undefined);
    setView(undefined);
  }, [to, router]);

  useEffect(() => {
    if (prefetch === 'render') {
      handlePrefetch();
      return undefined;
    }
    if (prefetch !== 'viewport') return undefined;
    const el = anchorRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    // eslint-disable-next-line compat/compat -- guarded above at runtime
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      handlePrefetch();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // `location` and `handlePrefetch` are derived from these deps.
  }, [prefetch, to, router]);

  const linkContext = useMemo(
    () => ({loading, error, view}),
    [loading, error, view]
  );

  // Hover/focus are intent signals only; 'render', 'viewport' and 'none'
  // never prefetch on interaction.
  const intentHandlers =
    prefetch === 'intent'
      ? {onMouseEnter: handlePrefetch, onFocus: handlePrefetch}
      : undefined;

  const A = (as ?? 'a') as ElementType;

  return (
    <Context.Provider value={linkContext}>
      <A
        {...rest}
        {...intentHandlers}
        {...asProps}
        ref={setAnchorRef}
        href={createHref(router, to)}
        onClick={handleClick}
      >
        {children}
      </A>
    </Context.Provider>
  );
}

// Generic first for call sites, plain tail for ComponentProps(see Link).
const PrefetchLink = forwardRef(PrefetchLinkImpl) as {
  <A extends ElementType = 'a'>(
    props: AsLinkProps<LinkProps, A>
  ): ReactElement | null;
  (props: LinkProps): ReactElement | null;
  displayName?: string;
};

PrefetchLink.displayName = 'PrefetchLink';

export default PrefetchLink;
