import {createContext, MouseEvent, ReactNode, useContext, useEffect, useRef, useState} from 'react';
import {useRouter} from './Router';

type Props = {
  to: string;
  // eslint-disable-next-line react/require-default-props
  children?: ReactNode;
};

type PrefetchLinkContext = {loading: boolean; error?: Error; view?: ReactNode};

const Context = createContext<PrefetchLinkContext>({loading: false});

export function usePrefetch() {
  return useContext(Context);
}

export default function PrefetchLink({to, children, ...rest}: Props) {
  const {prefetch, createHref} = useRouter();
  const commitRef = useRef<undefined | (() => void)>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const [view, setView] = useState<ReactNode>();

  function prefetchIt() {
    setLoading(true);
    const commit = prefetch(to, {
      done(v) {
        if (commit !== commitRef.current) return;
        setLoading(false);
        setView(v);
      },
      onError(e) {
        if (commit !== commitRef.current) return;
        setLoading(false);
        setError(e);
      }
    });
    commitRef.current = commit;
  }

  function handlePrefetch() {
    if (commitRef.current) return;
    prefetchIt();
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (!commitRef.current) {
      prefetchIt();
    }
    commitRef.current!();
  }

  useEffect(() => {
    commitRef.current = undefined;
  }, [to]);

  return (
    <Context.Provider value={{loading, error, view}}>
      <a
        {...rest}
        href={createHref(to)}
        onMouseEnter={handlePrefetch}
        onClick={handleClick}
      >
        {children}
      </a>
    </Context.Provider>
  );
}
