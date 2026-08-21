import {commit, createHref, resolve, toLocation} from '@native-router/core';
import type {LinkProps} from '@@/types';
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
  const viewPromiseRef = useRef<Promise<ReactNode> | undefined>(undefined);
  const failedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const [view, setView] = useState<ReactNode>();
  const location = toLocation(router, to);

  function prefetchIt(): Promise<ReactNode> {
    setLoading(true);
    setError(undefined);
    failedRef.current = false;
    const task = resolve(router, location);
    viewPromiseRef.current = task;
    // The derived chain carries the loading/error/view state and handles the
    // rejection of `task`, so a prefetched task that is never committed does
    // not surface as a global unhandledrejection. Failure is tracked in
    // `failedRef` instead of relying on the rejected task itself.
    task
      .then(
        (v) => setView(v),
        (e) => {
          setError(e);
          failedRef.current = true;
        }
      )
      .finally(() => setLoading(false));
    return task;
  }

  function handlePrefetch() {
    if (viewPromiseRef.current) return;
    prefetchIt();
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    // A stored task that already failed can never be committed
    // successfully, so resolve the target again before committing.
    const task =
      !viewPromiseRef.current || failedRef.current
        ? prefetchIt()
        : viewPromiseRef.current;
    commit(router, task, location)
      .catch(() => undefined)
      .finally(() => {
        viewPromiseRef.current = undefined;
        failedRef.current = false;
      });
  }

  // Reset every piece of prefetch state when the target changes, so a stale
  // error or preview from the previous target is not rendered for the new one.
  useEffect(() => {
    viewPromiseRef.current = undefined;
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
