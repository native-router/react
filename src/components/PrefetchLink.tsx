import {commit, createHref, resolve, toLocation} from '@@/router';
import {
  createContext,
  MouseEvent,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import {useRouter} from './Router';

type Props = {
  to: string;
  // eslint-disable-next-line react/require-default-props
  children?: ReactNode;
};

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
export default function PrefetchLink({to, children, ...rest}: Props) {
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
    commit(router, viewPromiseRef.current!, location);
  }

  useEffect(() => {
    viewPromiseRef.current = undefined;
  }, [to]);

  return (
    <Context.Provider value={{loading, error, view}}>
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
