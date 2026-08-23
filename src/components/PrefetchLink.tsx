import {commit, createHref, preload} from '@native-router/core';
import type {ResolvedEntry} from '@native-router/core';
import type {LinkProps, Route} from '@@/types';
import {
  createContext,
  MouseEvent,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
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

/**
 * Link with prefetch support.
 *
 * The `prefetch` prop controls when the target view is resolved:
 * - `'intent'` (default): prefetch on hover or focus.
 * - `'render'`: prefetch as soon as the link mounts.
 * - `'viewport'`: prefetch when the link scrolls into the viewport.
 * - `'none'`: never prefetch; the target is resolved on click.
 *
 * @param props
 * @group Components
 */
export default function PrefetchLink({
  to,
  prefetch = 'intent',
  children,
  ...rest
}: LinkProps) {
  const router = useRouter();
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const entryRef = useRef<Promise<ResolvedEntry<ReactNode>> | undefined>(
    undefined
  );
  const failedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const [view, setView] = useState<ReactNode>();

  function prefetchIt(): Promise<ResolvedEntry<ReactNode>> {
    setLoading(true);
    setError(undefined);
    failedRef.current = false;
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
    // committed does not surface as a global unhandledrejection. Failure is
    // tracked in `failedRef` instead of relying on the rejected task itself.
    entryPromise
      .then((entry) => entry.task)
      .then(
        (v) => setView(v),
        (e) => {
          setError(e);
          failedRef.current = true;
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
    // Modified clicks, other buttons and links to another browsing context
    // keep the browser default behavior (open in new tab/window, etc).
    if (!shouldNavigate(e, rest.target, rest.rel)) return;
    e.preventDefault();
    // A stored entry that already failed can never be committed
    // successfully, so resolve the target again before committing.
    const stored = entryRef.current;
    const entryPromise = !stored || failedRef.current ? prefetchIt() : stored;
    // The terminal location of the entry is committed, not the link target.
    entryPromise
      .then((entry) => commit(router, entry.task, entry.location))
      .catch(() => undefined)
      .finally(() => {
        entryRef.current = undefined;
        failedRef.current = false;
      });
  }

  // Reset every piece of prefetch state when the target changes, so a stale
  // error or preview from the previous target is not rendered for the new one.
  useEffect(() => {
    entryRef.current = undefined;
    failedRef.current = false;
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

  return (
    <Context.Provider value={linkContext}>
      <a
        {...rest}
        {...intentHandlers}
        ref={anchorRef}
        href={createHref(router, to)}
        onClick={handleClick}
      >
        {children}
      </a>
    </Context.Provider>
  );
}
