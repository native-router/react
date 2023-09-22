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
 * Link support hover prefetch.
 * @param props
 * @group Components
 */
export default function PrefetchLink({to, children, ...rest}: LinkProps) {
  const router = useRouter();
  const viewPromiseRef = useRef<undefined | Promise<ReactNode>>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const [view, setView] = useState<ReactNode>();
  const location = toLocation(router, to);

  function prefetchIt() {
    setLoading(true);
    viewPromiseRef.current = resolve(router, location)
      .then((v) => {
        setView(v);
        return v;
      })
      .catch((e) => {
        setError(e);
        throw e;
      })
      .finally(() => setLoading(false));
  }

  function handlePrefetch() {
    if (viewPromiseRef.current) return;
    prefetchIt();
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (!viewPromiseRef.current) {
      prefetchIt();
    }
    commit(router, viewPromiseRef.current!, location).finally(
      () => (viewPromiseRef.current = undefined)
    );
  }

  useEffect(() => {
    viewPromiseRef.current = undefined;
  }, [to, router]);

  const linkContext = useMemo(
    () => ({loading, error, view}),
    [loading, error, view]
  );

  return (
    <Context.Provider value={linkContext}>
      <a
        {...rest}
        href={createHref(router, to)}
        onMouseEnter={handlePrefetch}
        onClick={handleClick}
      >
        {children}
      </a>
    </Context.Provider>
  );
}
