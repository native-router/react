/**
 * End-to-end integration tests with the REAL `@native-router/core` and the
 * REAL `history` package.
 *
 * `test/index.test.tsx` has a top-level `vi.mock('@native-router/core')`
 * (hoisted over the whole module), so real-core cases cannot be merged into
 * it. This file MUST NOT mock anything module-level: only per-test `vi.fn`
 * data fetchers are allowed. Future integration cases(route guards,
 * NavLink, scroll restoration, ...) should be appended here.
 */
import {
  describe,
  it,
  expect,
  expectTypeOf,
  vi,
  afterEach,
  beforeEach
} from 'vitest';
import {render, screen, act, fireEvent} from '@testing-library/react';
import React from 'react';
import {createBrowserHistory, createMemoryHistory} from 'history';
import {
  NotFoundError,
  SearchError,
  commitReplace,
  create,
  go,
  initHistoryStack,
  navigate,
  refresh,
  resolve,
  setBlocker,
  toLocation
} from '@native-router/core';
import type {
  Location,
  RouterInstance,
  StandardSchemaV1
} from '@native-router/core';
import {resetViewTransitionCapability} from '../src/view-transition';
import type {ViewTransitionInfo} from '../src/view-transition';
import {
  Link,
  MemoryRouter,
  NavLink,
  PrefetchLink,
  Router,
  ScrollRestoration,
  TypedLink,
  TypedNavLink,
  TypedPrefetchLink,
  View,
  createRouter,
  createRoutes,
  defaultResolveView,
  useBlocker,
  useData,
  useLoading,
  useNamedData,
  usePrefetch,
  useSearch,
  useSearchParams,
  useSetSearch,
  useRouter
} from '../src/index';
import type {Route, RoutePaths} from '../src/types';

// Route resolution chains are promise-chained but never timer based, so a
// bounded number of microtask ticks is a deterministic flush(no timer
// polling). `act` batches the React updates triggered by view changes.
async function flush(ticks = 20) {
  await act(async () => {
    for (let i = 0; i < ticks; i += 1) {
      await Promise.resolve();
    }
  });
}

function Home() {
  return (
    <main>
      <h1>Home</h1>
      <Link to="/page">GoPage</Link>
      <Link to="/err">GoErr</Link>
    </main>
  );
}

function Page() {
  const data = useData();
  return (
    <div>
      <h1>Page</h1>
      <p>{String(data)}</p>
    </div>
  );
}

function A() {
  return <h1>A</h1>;
}

function B() {
  return <h1>B</h1>;
}

// A design-system-style link for the `as` tests: own props plus anchor
// attributes, forwardRef and rest 透传 — the documented component contract.
type PillProps = {
  variant: 'primary' | 'ghost';
  tone?: 'strong';
} & React.AnchorHTMLAttributes<HTMLAnchorElement>;

const PillLink = React.forwardRef<HTMLAnchorElement, PillProps>(
  function PillLink({variant, tone, ...rest}, ref) {
    // Children arrive through the rest spread.
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return <a ref={ref} data-variant={variant} data-tone={tone} {...rest} />;
  }
);

function Login() {
  return <h1>Login</h1>;
}

function Secret() {
  const data = useData();
  return (
    <div>
      <h1>Secret</h1>
      <p>{String(data)}</p>
    </div>
  );
}

function PrefetchStatus() {
  const {loading, error, view} = usePrefetch();
  let status = 'idle';
  if (error) status = `error:${error.message}`;
  else if (view !== undefined) status = 'view';
  else if (loading) status = 'loading';
  return <span data-testid="status">{status}</span>;
}

function List() {
  const [searchParams] = useSearchParams();
  return (
    <section>
      <h1>List</h1>
      <span data-testid="view-search">{searchParams.toString()}</span>
    </section>
  );
}

function SearchControls() {
  const [, setSearchParams] = useSearchParams();
  return (
    <div>
      <button
        type="button"
        data-testid="next-page"
        onClick={() =>
          setSearchParams((prev) => {
            // eslint-disable-next-line compat/compat -- jsdom test environment, no need for op_mini compat
            const next = new URLSearchParams(prev);
            next.set('page', String(Number(prev.get('page')) + 1));
            return next;
          })
        }
      >
        NextPage
      </button>
      <button
        type="button"
        data-testid="replace-page"
        onClick={() =>
          setSearchParams(
            // eslint-disable-next-line compat/compat -- jsdom test environment, no need for op_mini compat
            new URLSearchParams('page=9'),
            {replace: true}
          )
        }
      >
        ReplacePage
      </button>
      <button
        type="button"
        data-testid="clear-all"
        onClick={() =>
          // eslint-disable-next-line compat/compat -- jsdom test environment, no need for op_mini compat
          setSearchParams(new URLSearchParams())
        }
      >
        Clear
      </button>
    </div>
  );
}

describe('Integration(real core, real history)', () => {
  it('should restore the previous view on back without re-fetching data', async () => {
    const data = vi.fn(() => 'page-data');
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/page', component: () => Page, data}
    ];
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );

    // Bootstrap: listening lazily resolves the initial entry.
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    expect(data).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('GoPage'));
    });
    await flush();
    expect(screen.getByText('Page')).toBeDefined();
    expect(screen.getByText('page-data')).toBeDefined();
    expect(data).toHaveBeenCalledTimes(1);

    await act(async () => {
      history.back();
    });
    await flush();
    // POP hits the cached entry of viewStack: view restored, data kept at 1.
    expect(screen.getByText('Home')).toBeDefined();
    expect(data).toHaveBeenCalledTimes(1);
  });

  it('should restore the session location stack from history.state and serve back with zero requests', async () => {
    const dataA = vi.fn(() => 'a-data');
    const dataB = vi.fn(() => 'b-data');
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/a', component: () => A, data: dataA},
      {path: '/b', component: () => B, data: dataB}
    ];

    // Session one: plain core navigation over the real browser history.
    const router1 = create(routes, createBrowserHistory(), defaultResolveView);
    await navigate(router1, '/a');
    await navigate(router1, '/b');
    expect(dataA).toHaveBeenCalledTimes(1);
    expect(dataB).toHaveBeenCalledTimes(1);

    // Session two(a "refresh"): a brand new router over the same
    // window.history. locationStack must be rebuilt from the state
    // serialized by the first session; viewStack starts as placeholders.
    const router2 = create(routes, createBrowserHistory(), defaultResolveView);
    expect(
      (router2.locationStack as (Location | undefined)[]).map((l) =>
        l ? l.pathname : undefined
      )
    ).toEqual(['/', '/a', '/b']);
    expect(router2.viewStack.every((view) => view === null)).toBe(true);

    await initHistoryStack(router2);
    // Warming the window re-resolves each reachable data entry once.
    expect(dataA).toHaveBeenCalledTimes(2);
    expect(dataB).toHaveBeenCalledTimes(2);

    render(
      <Router router={router2}>
        <View />
      </Router>
    );
    await flush();
    // The current entry renders from the warmed stack, without a refresh.
    expect(screen.getByText('B')).toBeDefined();
    expect(dataA).toHaveBeenCalledTimes(2);
    expect(dataB).toHaveBeenCalledTimes(2);

    // Back is popstate driven; awaiting the event itself is deterministic
    // (no timer polling). The warmed entry is served: zero new requests.
    await act(async () => {
      const popped = new Promise((settle) => {
        window.addEventListener('popstate', settle, {once: true});
      });
      window.history.back();
      await popped;
    });
    await flush();
    expect(screen.getByText('A')).toBeDefined();
    expect(dataA).toHaveBeenCalledTimes(2);
    expect(dataB).toHaveBeenCalledTimes(2);
  });

  it('should commit the prefetched task on click without a second fetch', async () => {
    const data = vi.fn(() => 'page-data');
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/page', component: () => Page, data}
    ];
    const router = createRouter(
      routes,
      createMemoryHistory({initialEntries: ['/']})
    );
    render(
      <Router router={router}>
        <View />
        <PrefetchLink data-testid="target" to="/page">
          <PrefetchStatus />
        </PrefetchLink>
      </Router>
    );
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    expect(data).not.toHaveBeenCalled();

    // Hover is the default 'intent' prefetch trigger.
    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId('target'));
    });
    await flush();
    expect(data).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('view');
    // Prefetching never navigates by itself.
    expect(screen.getByText('Home')).toBeDefined();

    // Click commits the already stored task: no second resolve/fetch.
    await act(async () => {
      fireEvent.click(screen.getByTestId('target'));
    });
    await flush();
    expect(screen.getByText('Page')).toBeDefined();
    expect(data).toHaveBeenCalledTimes(1);
  });

  it('should render the errorHandler view when data rejects', async () => {
    const data = vi.fn(() => Promise.reject(new Error('boom')));
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/err', component: () => Page, data}
    ];
    const router = createRouter(
      routes,
      createMemoryHistory({initialEntries: ['/']}),
      {errorHandler: (e) => <div role="alert">ErrorView:{e.message}</div>}
    );
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByText('Home')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByText('GoErr'));
    });
    await flush();
    expect(data).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toBe('ErrorView:boom');
  });

  // Cold start: the first resolve fires from the subscribe effect(children
  // first), before the parent Router component's setOptions effect runs.
  // Options passed as props(errorHandler here) must already be in effect by
  // then, or the failure is swallowed by listen's refresh().catch(noop) and
  // the view stays blank forever.
  it('should apply the prop errorHandler to the cold-start resolve', async () => {
    const data = vi.fn(() => Promise.reject(new Error('cold-boom')));
    const routes: Route[] = [{path: '/err', component: () => Page, data}];
    render(
      <MemoryRouter
        initialEntries={['/err']}
        routes={routes}
        errorHandler={(e) => <div role="alert">ErrorView:{e.message}</div>}
      >
        <View />
      </MemoryRouter>
    );
    await flush();
    expect(data).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toBe('ErrorView:cold-boom');
  });

  describe('route guards integration', () => {
    it('should land on the terminal route when clicking a Link to a redirecting path', async () => {
      const dataB = vi.fn(() => 'b-data');
      const routes: Route[] = [
        {path: '/', component: () => Home},
        {path: '/a', redirect: '/b'},
        {path: '/b', component: () => B, data: dataB}
      ];
      const history = createMemoryHistory({initialEntries: ['/']});
      const router = createRouter(routes, history);
      render(
        <Router router={router}>
          <View />
          <Link to="/a">GoA</Link>
        </Router>
      );
      await flush();
      expect(screen.getByText('Home')).toBeDefined();
      expect(dataB).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(screen.getByText('GoA'));
      });
      await flush();
      // The view is of the terminal route and the history landed on /b.
      expect(screen.getByText('B')).toBeDefined();
      expect(router.history.location.pathname).toBe('/b');
      expect(dataB).toHaveBeenCalledTimes(1);
    });

    it('should redirect to /login via an async beforeLoad when not logged in', async () => {
      let loggedIn = false;
      const data = vi.fn(() => 'secret-data');
      const routes: Route[] = [
        {path: '/', component: () => Home},
        {
          path: '/secret',
          component: () => Secret,
          data,
          beforeLoad: async () => (loggedIn ? undefined : '/login')
        },
        {path: '/login', component: () => Login}
      ];
      const history = createMemoryHistory({initialEntries: ['/']});
      const router = createRouter(routes, history);
      render(
        <Router router={router}>
          <View />
          <Link to="/secret">GoSecret</Link>
        </Router>
      );
      await flush();
      expect(screen.getByText('Home')).toBeDefined();

      // Not logged in: the guard redirects, the protected data never runs.
      await act(async () => {
        fireEvent.click(screen.getByText('GoSecret'));
      });
      await flush();
      expect(screen.getByText('Login')).toBeDefined();
      expect(router.history.location.pathname).toBe('/login');
      expect(data).not.toHaveBeenCalled();

      // Logged in: the same link now reaches the guarded route.
      loggedIn = true;
      await act(async () => {
        fireEvent.click(screen.getByText('GoSecret'));
      });
      await flush();
      expect(screen.getByText('Secret')).toBeDefined();
      expect(router.history.location.pathname).toBe('/secret');
      expect(data).toHaveBeenCalledTimes(1);
    });

    it('should prefetch and commit the terminal entry of a redirecting target', async () => {
      const dataB = vi.fn(() => 'b-data');
      const routes: Route[] = [
        {path: '/', component: () => Home},
        {path: '/a', redirect: '/b'},
        {path: '/b', component: () => B, data: dataB}
      ];
      const history = createMemoryHistory({initialEntries: ['/']});
      const router = createRouter(routes, history);
      render(
        <Router router={router}>
          <View />
          <PrefetchLink data-testid="target" to="/a">
            <PrefetchStatus />
          </PrefetchLink>
        </Router>
      );
      await flush();
      expect(dataB).not.toHaveBeenCalled();

      // Hover prefetches through the redirect: the preview view is of the
      // terminal route, and prefetching never navigates by itself.
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
      });
      await flush();
      expect(dataB).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('status').textContent).toBe('view');
      expect(router.history.location.pathname).toBe('/');

      // Click commits the stored terminal entry: no second fetch and the
      // history lands on /b, not on the link target /a.
      await act(async () => {
        fireEvent.click(screen.getByTestId('target'));
      });
      await flush();
      expect(screen.getByText('B')).toBeDefined();
      expect(router.history.location.pathname).toBe('/b');
      expect(dataB).toHaveBeenCalledTimes(1);
    });

    // The loader chain's AbortSignal bridge: navigate A→B while A's
    // loader is still pending → A's ctx.signal flips to `aborted` while
    // B's stays live. A loader passing the signal to fetch(vi.fn spy)
    // must also see fetch subscribing to it — the wire a real request
    // would be cancelled through.
    it('should abort the superseded navigation loader through ctx.signal', async () => {
      const loaderDone = vi.fn();
      let releaseA: (() => void) | undefined;
      const signals: Record<string, AbortSignal> = {};
      const fetchSpy = vi.fn(
        (input: string, {signal}: {signal?: AbortSignal}) => {
          // fetch subscribes to the signal: the observer the native
          // implementation registers to cancel the request.
          signal?.addEventListener('abort', loaderDone, {once: true});
          return new Promise(() => undefined);
        }
      );
      const routes: Route[] = [
        {path: '/', component: () => Home},
        {
          path: '/a',
          component: () => A,
          data: (ctx) => {
            signals.a = ctx.signal;
            fetchSpy('/api/a', {signal: ctx.signal});
            return new Promise<undefined>((resolve) => {
              releaseA = () => resolve(undefined);
            });
          }
        },
        {
          path: '/b',
          component: () => B,
          data: (ctx) => {
            signals.b = ctx.signal;
            return 'b-data';
          }
        }
      ];
      const router = createRouter(
        routes,
        createMemoryHistory({initialEntries: ['/']})
      );
      render(
        <Router router={router}>
          <View />
        </Router>
      );
      await flush();
      expect(screen.getByText('Home')).toBeDefined();

      // Navigate to A, then supersede it with B while A's loader is
      // still parked. The superseding navigate aborts synchronously.
      await act(async () => {
        void navigate(router, '/a');
      });
      await act(async () => {
        void navigate(router, '/b');
      });
      await flush();

      // A's loader saw its signal aborted; its fetch was wired to the
      // same signal(the abort listener fired exactly once, for A only).
      expect(signals.a.aborted).toBe(true);
      expect(signals.b.aborted).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(loaderDone).toHaveBeenCalledTimes(1);

      // The aborted loader's result is discarded: B rendered, A parked.
      expect(screen.getByText('B')).toBeDefined();
      expect(router.history.location.pathname).toBe('/b');
      releaseA?.();
    });
  });
});

describe('useSearchParams', () => {
  function renderSearchApp() {
    const routes: Route[] = [{path: '/list', component: () => List}];
    const history = createMemoryHistory({
      initialEntries: ['/list?page=2&tab=info']
    });
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
        <SearchControls />
      </Router>
    );
    return history;
  }

  it('should read the initial search of the entry', async () => {
    renderSearchApp();
    await flush();
    expect(screen.getByText('List')).toBeDefined();
    expect(screen.getByTestId('view-search').textContent).toBe(
      'page=2&tab=info'
    );
  });

  it('should re-render the view with the new value after a functional update', async () => {
    renderSearchApp();
    await flush();
    expect(screen.getByTestId('view-search').textContent).toBe(
      'page=2&tab=info'
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('next-page'));
    });
    await flush();
    // The pushed entry re-resolves the route: the view reads page=3 and
    // keeps the untouched tab param.
    expect(screen.getByTestId('view-search').textContent).toBe(
      'page=3&tab=info'
    );
  });

  it('should push by default so back() restores the old search', async () => {
    const history = renderSearchApp();
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByTestId('next-page'));
    });
    await flush();
    expect(history.index).toBe(1);
    expect(screen.getByTestId('view-search').textContent).toBe(
      'page=3&tab=info'
    );

    await act(async () => {
      history.back();
    });
    await flush();
    expect(history.index).toBe(0);
    expect(screen.getByTestId('view-search').textContent).toBe(
      'page=2&tab=info'
    );
  });

  it('should rewrite the current entry with {replace: true} so back() does not restore the old search', async () => {
    const history = renderSearchApp();
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByTestId('replace-page'));
    });
    await flush();
    // The stack depth is unchanged: the initial entry was rewritten.
    expect(history.index).toBe(0);
    expect(screen.getByTestId('view-search').textContent).toBe('page=9');

    // back() at the bottom of the stack is a no-op POP: the old search is
    // gone for good.
    await act(async () => {
      history.back();
    });
    await flush();
    expect(history.index).toBe(0);
    expect(screen.getByTestId('view-search').textContent).toBe('page=9');
  });

  it('should drop the search entirely when set to empty params', async () => {
    const history = renderSearchApp();
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-all'));
    });
    await flush();
    // No '?' separator is left behind on a fully cleared search.
    expect(history.location.search).toBe('');
    expect(history.location.pathname).toBe('/list');
    expect(screen.getByTestId('view-search').textContent).toBe('');
  });

  // setSearchParams must navigate through the same guard pipeline as any
  // other navigation, on both the push and the replace branch.
  function renderGuardedSearchApp() {
    function ListError() {
      return <h1>ListError</h1>;
    }
    function ZeroControls({replace}: {replace?: boolean}) {
      const [, setSearchParams] = useSearchParams();
      return (
        <button
          type="button"
          data-testid={replace ? 'replace-zero-page' : 'push-zero-page'}
          onClick={() =>
            setSearchParams(
              // eslint-disable-next-line compat/compat -- jsdom test environment, no need for op_mini compat
              new URLSearchParams('page=0'),
              {replace}
            )
          }
        >
          {replace ? 'ReplaceZero' : 'PushZero'}
        </button>
      );
    }
    const routes: Route[] = [
      {
        path: '/list',
        beforeLoad: ({location}) =>
          location.search.includes('page=0') ? '/list-error' : undefined,
        component: () => List
      },
      {path: '/list-error', component: () => ListError}
    ];
    const history = createMemoryHistory({initialEntries: ['/list?page=2']});
    const router = createRouter(routes, history);
    return function renderApp(replace?: boolean) {
      render(
        <Router router={router}>
          <View />
          <ZeroControls replace={replace} />
        </Router>
      );
      return history;
    };
  }

  it('should run route guards on the replace branch and rewrite the entry with the redirected target', async () => {
    const renderApp = renderGuardedSearchApp();
    const history = renderApp(true);
    await flush();
    expect(screen.getByText('List')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByTestId('replace-zero-page'));
    });
    await flush();
    // The guard redirected the replace: the current entry is rewritten to
    // the terminal location, not the raw search target.
    expect(history.index).toBe(0);
    expect(history.location.pathname).toBe('/list-error');
    expect(screen.getByText('ListError')).toBeDefined();
  });

  it('should run route guards on the push branch and land on the redirected target', async () => {
    const renderApp = renderGuardedSearchApp();
    const history = renderApp();
    await flush();
    expect(history.index).toBe(0);

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-zero-page'));
    });
    await flush();
    expect(history.index).toBe(1);
    expect(history.location.pathname).toBe('/list-error');
    expect(screen.getByText('ListError')).toBeDefined();
  });
});

describe('NavLink', () => {
  function renderNavApp() {
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/users', component: () => A},
      {path: '/users/123', component: () => B}
    ];
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    // The last state received by the className callback of the '/users' link.
    let received: {isActive: boolean; isExactActive: boolean} | undefined;
    render(
      <Router router={router}>
        <nav>
          <NavLink
            to="/users"
            className={({isActive, isExactActive}) => {
              received = {isActive, isExactActive};
              return isActive ? 'nav-link active' : 'nav-link';
            }}
          >
            Users
          </NavLink>
          <NavLink to="/users/123" end>
            Detail
          </NavLink>
          <NavLink to="/Users" caseSensitive>
            CaseUsers
          </NavLink>
        </nav>
        <View />
      </Router>
    );
    return {received: () => received};
  }

  const current = (text: string) =>
    (screen.getByText(text) as HTMLAnchorElement).getAttribute('aria-current');

  it('should mark active/partial-active links with aria-current across navigations', async () => {
    const {received} = renderNavApp();
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    // At '/': nothing is active.
    expect(current('Users')).toBe(null);
    expect(current('Detail')).toBe(null);
    expect(current('CaseUsers')).toBe(null);
    expect(screen.getByText('Users').className).toBe('nav-link');

    // Clicking the NavLink delegates to Link and navigates in-app.
    await act(async () => {
      fireEvent.click(screen.getByText('Users'));
    });
    await flush();
    expect(screen.getByText('A')).toBeDefined();
    expect(current('Users')).toBe('page');
    // The className callback saw the exact match.
    expect(received()).toEqual({isActive: true, isExactActive: true});
    expect(screen.getByText('Users').className).toBe('nav-link active');
    // `end` link only matches its exact pathname.
    expect(current('Detail')).toBe(null);
    // caseSensitive '/Users' does not match '/users'.
    expect(current('CaseUsers')).toBe(null);

    // '/users/123' is partially active for '/users'.
    await act(async () => {
      fireEvent.click(screen.getByText('Detail'));
    });
    await flush();
    expect(screen.getByText('B')).toBeDefined();
    expect(current('Users')).toBe('page');
    expect(received()).toEqual({isActive: true, isExactActive: false});
    expect(screen.getByText('Users').className).toBe('nav-link active');
    expect(current('Detail')).toBe('page');
    expect(current('CaseUsers')).toBe(null);

    // Going back to '/users' deactivates the `end` link.
    await act(async () => {
      fireEvent.click(screen.getByText('Users'));
    });
    await flush();
    expect(screen.getByText('A')).toBeDefined();
    expect(current('Users')).toBe('page');
    expect(current('Detail')).toBe(null);
    expect(screen.getByText('Users').className).toBe('nav-link active');
  });

  it('should render function children and a custom aria-current value', async () => {
    const routes: Route[] = [
      {path: '/users', component: () => A},
      {path: '/', component: () => Home}
    ];
    const router = createRouter(
      routes,
      createMemoryHistory({initialEntries: ['/']})
    );
    render(
      <Router router={router}>
        <NavLink to="/users" ariaCurrent="location">
          {({isActive}) => (isActive ? 'Users*' : 'Users')}
        </NavLink>
        <View />
      </Router>
    );
    await flush();
    expect(current('Users')).toBe(null);
    expect(screen.getByText('Users')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByText('Users'));
    });
    await flush();
    expect(current('Users*')).toBe('location');
  });

  it('should treat a root to="/" link as active everywhere and apply function styles', async () => {
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/users', component: () => A}
    ];
    const router = createRouter(
      routes,
      createMemoryHistory({initialEntries: ['/users']})
    );
    render(
      <Router router={router}>
        <NavLink
          to="/"
          style={({isActive}) => ({top: isActive ? '1px' : '2px'})}
        >
          Root
        </NavLink>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByText('A')).toBeDefined();
    // '/users'.startsWith('/') — the '/' prefix normalizes without an
    // extra trailing slash, so the root link is partially active.
    expect(current('Root')).toBe('page');
    expect((screen.getByText('Root') as HTMLAnchorElement).style.top).toBe(
      '1px'
    );
  });

  it('should render through an as component and inject the active state into it', async () => {
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/users', component: () => A}
    ];
    const router = createRouter(
      routes,
      createMemoryHistory({initialEntries: ['/']})
    );
    render(
      <Router router={router}>
        <NavLink
          as={PillLink}
          to="/users"
          variant="primary"
          className={({isActive}) =>
            isActive ? 'nav-link active' : 'nav-link'
          }
          // The types reject managed keys in asProps; the cast reaches them
          // anyway to prove the runtime backstop — the injected active-state
          // aria-current wins even for untyped callers.
          asProps={{'aria-current': 'step'} as never}
        >
          Users
        </NavLink>
        <View />
      </Router>
    );
    await flush();
    const el = screen.getByText('Users') as HTMLAnchorElement;
    // The flattened `as` prop reached the component; nothing is active at '/'.
    expect(el.getAttribute('data-variant')).toBe('primary');
    expect(el.getAttribute('aria-current')).toBe(null);
    expect(el.className).toBe('nav-link');

    // The click navigates in-app and the injected aria-current lands on the
    // as component's DOM node — the asProps 'step' above did NOT override
    // it(managed key, injected after asProps).
    await act(async () => {
      fireEvent.click(el);
    });
    await flush();
    expect(screen.getByText('A')).toBeDefined();
    expect(el.getAttribute('aria-current')).toBe('page');
    expect(el.className).toBe('nav-link active');
    expect(el.getAttribute('data-variant')).toBe('primary');
  });
});

describe('ScrollRestoration', () => {
  // jsdom has no layout: a spied scrollTo doubles as the scroll driver and
  // syncs scrollX/scrollY by hand, so the component saves and restores
  // exactly what the test "scrolled" to.
  function mockScrollTo() {
    return vi.spyOn(window, 'scrollTo').mockImplementation((x, y) => {
      window.scrollX = typeof x === 'number' ? x : 0;
      window.scrollY = y ?? 0;
    });
  }

  function renderScrollApp(resetOnPush?: boolean) {
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/a', component: () => A},
      {path: '/b', component: () => B}
    ];
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    const view = render(
      <Router router={router}>
        <ScrollRestoration resetOnPush={resetOnPush} />
        <View />
        <nav>
          <Link to="/a">GoA</Link>
          <Link to="/b">GoB</Link>
        </nav>
      </Router>
    );
    return {history, router, unmount: view.unmount};
  }

  afterEach(() => {
    vi.restoreAllMocks();
    window.scrollX = 0;
    window.scrollY = 0;
  });

  it('should reset to the top on push and restore the saved offsets on back/forward', async () => {
    const scrollTo = mockScrollTo();
    const {history} = renderScrollApp();
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    // The user scrolls the home entry.
    scrollTo(0, 500);
    expect(window.scrollY).toBe(500);

    scrollTo.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByText('GoA'));
    });
    await flush();
    expect(screen.getByText('A')).toBeDefined();
    // The pushed entry starts at the top.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    scrollTo.mockClear();
    await act(async () => {
      history.back();
    });
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    // The POP restores the offset home was left with — and only that: the
    // internal POP-sync replace of the core listener must not re-reset.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 500);

    scrollTo.mockClear();
    await act(async () => {
      history.forward();
    });
    await flush();
    expect(screen.getByText('A')).toBeDefined();
    // The forward POP restores the top offset /a was left with.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('should scroll a searchDeps fast-path push back to the top like any push', async () => {
    const scrollTo = mockScrollTo();
    const routes: Route[] = [
      {
        searchDeps: [],
        component: () =>
          Promise.resolve(() => (
            <nav>
              Layout
              <View />
            </nav>
          )),
        children: [
          {path: '/', searchDeps: [], component: () => Home},
          {path: '/a', searchDeps: [], component: () => A}
        ]
      }
    ];
    const history = createMemoryHistory({initialEntries: ['/?x=1']});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <ScrollRestoration />
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    scrollTo(0, 500);
    expect(window.scrollY).toBe(500);

    scrollTo.mockClear();
    await act(async () => {
      // Irrelevant key change: the view is re-served, but the entry is
      // still a fresh push and starts at the top.
      navigate(router, '/?x=2');
    });
    await flush();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('should keep the current offset on push when resetOnPush is false', async () => {
    const scrollTo = mockScrollTo();
    const {history} = renderScrollApp(false);
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    scrollTo(0, 250);

    scrollTo.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByText('GoA'));
    });
    await flush();
    expect(screen.getByText('A')).toBeDefined();
    // The push did not touch the scroll at all.
    expect(scrollTo).not.toHaveBeenCalled();
    expect(window.scrollY).toBe(250);

    scrollTo.mockClear();
    await act(async () => {
      history.back();
    });
    await flush();
    // POP restoration is independent of resetOnPush.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 250);
  });

  it('should reset on a replace to another location but keep the offset on refresh', async () => {
    const scrollTo = mockScrollTo();
    const {history, router} = renderScrollApp();
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    scrollTo(0, 400);

    // A replace navigation rewrites the current entry to another location.
    scrollTo.mockClear();
    await act(async () => {
      const location = toLocation(router, '/b');
      commitReplace(router, resolve(router, location), location);
    });
    await flush();
    expect(screen.getByText('B')).toBeDefined();
    // The rewritten entry starts at the top and the stack depth is kept.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(history.index).toBe(0);

    // refresh() re-commits the very same location: an internal re-commit,
    // not a user navigation — the current offset survives.
    scrollTo(0, 120);
    scrollTo.mockClear();
    await act(async () => {
      await refresh(router);
    });
    await flush();
    expect(screen.getByText('B')).toBeDefined();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(window.scrollY).toBe(120);
  });

  it('should take over history.scrollRestoration as manual when present', async () => {
    // jsdom ships no scrollRestoration, so a plain own property simulates
    // a browser that does expose one.
    (window.history as {scrollRestoration?: string}).scrollRestoration = 'auto';
    try {
      renderScrollApp();
      await flush();
      expect(window.history.scrollRestoration).toBe('manual');
    } finally {
      delete (window.history as {scrollRestoration?: string}).scrollRestoration;
    }
  });

  it('should drop the scheduled scroll reset when unmounted before it runs', async () => {
    const scrollTo = mockScrollTo();
    const {history, unmount} = renderScrollApp();
    await flush();
    expect(screen.getByText('Home')).toBeDefined();

    scrollTo.mockClear();
    await act(async () => {
      // history.push fires the listener synchronously; unmounting before
      // the queued microtask runs flips `active` to false, so the push
      // reset must be dropped instead of scrolling a dead component.
      history.push('/a');
      unmount();
    });
    await flush();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('should restore the top on a POP to an entry never saved in this session', async () => {
    const scrollTo = mockScrollTo();
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/a', component: () => A}
    ];
    const history = createMemoryHistory({initialEntries: ['/']});
    // Session one: navigate without any scroll restoration mounted, so no
    // offset is ever saved for the left-behind entry 0.
    const router1 = createRouter(routes, history);
    const first = render(
      <Router router={router1}>
        <View />
      </Router>
    );
    await flush();
    await act(async () => {
      await navigate(router1, '/a');
    });
    await flush();
    expect(screen.getByText('A')).toBeDefined();
    first.unmount();

    // Session two(a "reload"): a fresh router and a fresh positions map
    // over the same stack. Entry 0 predates the mount, so the POP to it
    // falls back to the default 0,0 offset.
    const router2 = createRouter(routes, history);
    render(
      <Router router={router2}>
        <ScrollRestoration />
        <View />
      </Router>
    );
    await flush();
    scrollTo.mockClear();
    await act(async () => {
      history.back();
    });
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

describe('search schema', () => {
  /** Minimal Standard Schema fixture(zod/valibot/arktype shape): coerces `page`. */
  const pageSearch: StandardSchemaV1<unknown, {page: number}> = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate(value) {
        const {page} = (value ?? {}) as {page?: unknown};
        const parsed = Number(page ?? 1);
        return Number.isInteger(parsed) && parsed >= 1
          ? {value: {page: parsed}}
          : {
              issues: [{message: 'expected a positive integer', path: ['page']}]
            };
      }
    }
  };

  function SearchPage() {
    const search = useSearch(pageSearch);
    const raw = useSearch();
    return (
      <div>
        <h1>SearchPage</h1>
        <span data-testid="parsed-page">{search.page}</span>
        <span data-testid="raw-page">{String(raw.page)}</span>
      </div>
    );
  }

  it('should pass the schema-parsed search to the data loader, typed', async () => {
    const loaded: unknown[] = [];
    const home: Route<'/'> = {path: '/', component: () => Home};
    const list: Route<'/list', {page: number}> = {
      path: '/list',
      search: pageSearch,
      component: () => SearchPage,
      data: ({search}) => {
        // ctx.search is the schema output, no casts needed.
        expectTypeOf(search).toEqualTypeOf<{page: number}>();
        loaded.push(search);
        return `next:${search.page + 1}`;
      }
    };
    // Typed levels stay assignable to plain `Route` arrays/props.
    const routes: Route[] = [home, list];
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
        <Link to="/list?page=2">GoList</Link>
        <Link to="/list?page=3">GoList3</Link>
      </Router>
    );
    await flush();
    expect(loaded).toEqual([]);

    await act(async () => {
      fireEvent.click(screen.getByText('GoList'));
    });
    await flush();
    // The loader saw the coerced number; the component reads both the
    // parsed value and the degraded raw string.
    expect(loaded).toEqual([{page: 2}]);
    expect(screen.getByTestId('parsed-page').textContent).toBe('2');
    expect(screen.getByTestId('raw-page').textContent).toBe('2');

    // A search change while the page is mounted re-renders it through the
    // history subscription (not just the route re-resolve).
    await act(async () => {
      fireEvent.click(screen.getByText('GoList3'));
    });
    await flush();
    expect(loaded).toEqual([{page: 2}, {page: 3}]);
    expect(screen.getByTestId('parsed-page').textContent).toBe('3');
    expect(screen.getByTestId('raw-page').textContent).toBe('3');
  });

  it('should default and coerce absent params through the schema', async () => {
    const routes: Route<'/list', {page: number}>[] = [
      {path: '/list', search: pageSearch, component: () => SearchPage}
    ];
    const history = createMemoryHistory({initialEntries: ['/list']});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();
    // No `page` in the URL: the schema default kicks in.
    expect(screen.getByTestId('parsed-page').textContent).toBe('1');
    expect(screen.getByTestId('raw-page').textContent).toBe('undefined');
  });

  it('should render the route errorComponent for an invalid search', async () => {
    const data = vi.fn(() => 'never');
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {
        path: '/list',
        search: pageSearch,
        component: () => SearchPage,
        data,
        errorComponent: ({error}) => (
          <div role="alert">
            {error instanceof SearchError ? `search:${error.message}` : 'other'}
          </div>
        )
      }
    ];
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
        <Link to="/list?page=abc">GoList</Link>
      </Router>
    );
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText('GoList'));
    });
    await flush();
    expect(screen.getByRole('alert').textContent).toBe(
      'search:Invalid search params "?page=abc": page: expected a positive integer'
    );
    // The loader never ran for the invalid search.
    expect(data).not.toHaveBeenCalled();
  });

  it('should fall back to the global errorHandler when no errorComponent is set', async () => {
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/list', search: pageSearch, component: () => SearchPage}
    ];
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history, {
      errorHandler: (e) => <div role="alert">global:{e.message}</div>
    });
    render(
      <Router router={router}>
        <View />
        <Link to="/list?page=0">GoList</Link>
      </Router>
    );
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByText('GoList'));
    });
    await flush();
    expect(screen.getByRole('alert').textContent).toBe(
      'global:Invalid search params "?page=0": page: expected a positive integer'
    );
  });

  it('should type useData and useNamedData without casts', async () => {
    function ArticlePage() {
      const article = useData<{page: number}>();
      expectTypeOf(article).toEqualTypeOf<{page: number} | undefined>();
      return (
        <span data-testid="article">{article ? article.page + 1 : ''}</span>
      );
    }

    const routes: Route[] = [
      {
        path: '/article',
        component: () => ArticlePage,
        data: () => ({page: 41})
      }
    ];
    const history = createMemoryHistory({initialEntries: ['/article']});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();
    // 41 + 1: number arithmetic on the generic-typed data.
    expect(screen.getByTestId('article').textContent).toBe('42');
  });

  it('should read a named ancestor level through useData(name) and useNamedData', async () => {
    function UserLayout() {
      return (
        <section>
          <h1>UserLayout</h1>
          <View />
        </section>
      );
    }
    function Posts() {
      const user = useData<{id: string}>('user');
      const named = useNamedData<{user: {id: string}}>();
      return (
        <span data-testid="posts">
          {user?.id}:{named.user.id}
        </span>
      );
    }

    const routes: Route[] = [
      {
        path: '/user/:id',
        name: 'user',
        component: () => UserLayout,
        data: ({params}) => ({id: params.id}),
        // Children match the pathname remainder below the parent path
        // ('/user/7' consumed → '/posts' remains).
        children: [{path: '/posts', component: () => Posts}]
      }
    ];
    const history = createMemoryHistory({initialEntries: ['/user/7/posts']});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByText('UserLayout')).toBeDefined();
    // The unnamed child level reads the named ancestor data both ways.
    expect(screen.getByTestId('posts').textContent).toBe('7:7');
  });
});

describe('searchDeps', () => {
  /**
   * The painless Home pattern, compressed: a read schema coercing
   * tag/offset/limit out of the URL, a write schema normalizing the
   * value back into a clean query, a loader consuming the PARSED search,
   * and searchDeps declaring exactly the consumed keys. The unknown-key
   * case (?foo=…) stands in for "any search the route never declared".
   */
  const parseHomeSearch = (input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const value: {tag?: string; offset: number; limit: number} = {
      offset: Number(raw.offset) > 0 ? Math.floor(Number(raw.offset)) : 0,
      limit: Number(raw.limit) > 0 ? Math.floor(Number(raw.limit)) : 10
    };
    if (typeof raw.tag === 'string' && raw.tag !== '') value.tag = raw.tag;
    return value;
  };
  const homeSearchSchema: StandardSchemaV1<
    unknown,
    ReturnType<typeof parseHomeSearch>
  > = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (input) => ({value: parseHomeSearch(input)})
    }
  };

  function renderHomeApp(initial = '/?tag=a') {
    const loaderCalls: string[] = [];
    function Home() {
      const data = useData<string>();
      const search = useSearch(homeSearchSchema);
      return (
        <main>
          <h1>Home</h1>
          <span data-testid="home-data">{data}</span>
          <span data-testid="home-search">
            {`tag=${String(search.tag)};offset=${search.offset};limit=${search.limit}`}
          </span>
        </main>
      );
    }
    const routes = createRoutes({
      // The layout level must declare too — one undeclared level keeps
      // the whole chain on the always-re-resolve path.
      searchDeps: [],
      component: () =>
        Promise.resolve(() => (
          <nav>
            Layout
            <View />
          </nav>
        )),
      children: [
        {
          path: '/',
          search: homeSearchSchema,
          searchDeps: ['tag', 'offset', 'limit'],
          data: ({search}) => {
            loaderCalls.push(
              `tag=${String((search as any).tag)};offset=${(search as any).offset}`
            );
            return `data:${loaderCalls.length}`;
          },
          component: () => Promise.resolve(Home)
        },
        {
          path: '/other',
          component: () => Promise.resolve(() => <h1>Other</h1>)
        }
      ]
    });
    const history = createMemoryHistory({initialEntries: [initial]});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    return {router, history, loaderCalls};
  }

  it('should run the schema once and re-serve the view for unknown keys', async () => {
    const {router, history, loaderCalls} = renderHomeApp();
    await flush();
    // The initial resolve parsed the schema for the loader(coerced).
    expect(loaderCalls).toEqual(['tag=a;offset=0']);
    expect(screen.getByTestId('home-data').textContent).toBe('data:1');

    // An unknown key lands in the URL: zero loader re-runs…
    await act(async () => {
      navigate(router, '/?tag=a&foo=bar');
    });
    await flush();
    expect(loaderCalls).toEqual(['tag=a;offset=0']);
    // …the live useSearch read tracks the new URL(coercion included)…
    expect(screen.getByTestId('home-search').textContent).toBe(
      'tag=a;offset=0;limit=10'
    );
    // …while useData keeps the resolve-time snapshot by design.
    expect(screen.getByTestId('home-data').textContent).toBe('data:1');
    expect(history.location.search).toBe('?tag=a&foo=bar');
    expect(history.index).toBe(1);
  });

  it('should re-run the loader with the coerced search when a declared key changes', async () => {
    const {router, loaderCalls} = renderHomeApp();
    await flush();
    await act(async () => {
      navigate(router, '/?tag=a&offset=20');
    });
    await flush();
    expect(loaderCalls).toEqual(['tag=a;offset=0', 'tag=a;offset=20']);
    expect(screen.getByTestId('home-data').textContent).toBe('data:2');
  });

  it('should replay snapshots on back/forward around a reused entry', async () => {
    const {router, history, loaderCalls} = renderHomeApp();
    await flush();
    await act(async () => {
      navigate(router, '/?tag=a&foo=bar');
    });
    await flush();
    await act(async () => {
      navigate(router, '/?tag=b');
    });
    await flush();
    expect(loaderCalls).toEqual(['tag=a;offset=0', 'tag=b;offset=0']);

    await act(async () => {
      history.back();
    });
    await flush();
    // The reused slot replays its snapshot: the foo entry's data is the
    // tag=a resolve, and no loader ran.
    expect(loaderCalls).toEqual(['tag=a;offset=0', 'tag=b;offset=0']);
    expect(screen.getByTestId('home-data').textContent).toBe('data:1');
    expect(screen.getByTestId('home-search').textContent).toBe(
      'tag=a;offset=0;limit=10'
    );

    await act(async () => {
      history.back();
    });
    await flush();
    expect(screen.getByTestId('home-data').textContent).toBe('data:1');
    expect(loaderCalls).toEqual(['tag=a;offset=0', 'tag=b;offset=0']);
  });

  it('should keep the every-level rule: an undeclared sibling chain never reuses', async () => {
    const loaderCalls: string[] = [];
    function Other() {
      return <h1>Other</h1>;
    }
    const routes: Route[] = [
      // Root level deliberately undeclared.
      {
        component: () =>
          Promise.resolve(() => (
            <nav>
              Layout
              <View />
            </nav>
          )),
        children: [
          {
            path: '/other',
            searchDeps: [],
            data: () => {
              loaderCalls.push('run');
            },
            component: () => Promise.resolve(Other)
          }
        ]
      }
    ];
    const history = createMemoryHistory({initialEntries: ['/other?x=1']});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();
    expect(loaderCalls).toEqual(['run']);
    await act(async () => {
      navigate(router, '/other?x=2');
    });
    await flush();
    // The undeclared root keeps the chain on the re-resolve path.
    expect(loaderCalls).toEqual(['run', 'run']);
  });

  it('should reuse on the setSearchParams {replace: true} branch', async () => {
    const loaderCalls: string[] = [];
    function List() {
      const [, setSearchParams] = useSearchParams();
      const set = (qs: string) => () =>
        // eslint-disable-next-line compat/compat -- jsdom test environment
        setSearchParams(new URLSearchParams(qs), {replace: true});
      return (
        <section>
          <h1>List</h1>
          <span data-testid="list-data">{loaderCalls.length}</span>
          <button
            type="button"
            data-testid="set-panel"
            onClick={set('page=1&panel=open')}
          >
            panel
          </button>
          <button type="button" data-testid="set-page" onClick={set('page=2')}>
            page
          </button>
        </section>
      );
    }
    const routes: Route[] = [
      {
        searchDeps: [],
        component: () =>
          Promise.resolve(() => (
            <nav>
              Layout
              <View />
            </nav>
          )),
        children: [
          {
            path: '/list',
            searchDeps: ['page'],
            data: () => {
              loaderCalls.push('run');
            },
            component: () => Promise.resolve(List)
          }
        ]
      }
    ];
    const history = createMemoryHistory({initialEntries: ['/list?page=1']});
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();
    expect(loaderCalls).toEqual(['run']);

    await act(async () => {
      fireEvent.click(screen.getByTestId('set-panel'));
    });
    await flush();
    // Irrelevant key via the replace branch: snapshot re-served, the
    // entry rewritten in place(index unchanged).
    expect(loaderCalls).toEqual(['run']);
    expect(history.index).toBe(0);
    expect(history.location.search).toBe('?page=1&panel=open');

    // A declared key change through the same branch re-resolves.
    await act(async () => {
      fireEvent.click(screen.getByTestId('set-page'));
    });
    await flush();
    expect(loaderCalls).toEqual(['run', 'run']);
    expect(history.location.search).toBe('?page=2');
    expect(history.index).toBe(0);
  });

  it('should let blockers veto a searchDeps navigation before the fast path', async () => {
    const {router, history} = renderHomeApp();
    await flush();
    const unblock = setBlocker(router, () => false);
    await act(async () => {
      navigate(router, '/?tag=a&foo=bar');
    });
    await flush();
    expect(history.location.search).toBe('?tag=a');
    expect(history.index).toBe(0);
    unblock();
    await act(async () => {
      navigate(router, '/?tag=a&foo=bar');
    });
    await flush();
    expect(history.location.search).toBe('?tag=a&foo=bar');
  });
});

describe('route pendingComponent', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return {promise, resolve};
  }

  function Skeleton() {
    return <div data-testid="skeleton">loading…</div>;
  }

  function ParentSkeleton() {
    return <div data-testid="parent-skeleton">parent loading…</div>;
  }

  it('should render the pendingComponent during a slow cold start', async () => {
    const gate = deferred<string>();
    const routes: Route[] = [
      {
        path: '/slow',
        component: () => Page,
        data: () => gate.promise,
        pendingComponent: Skeleton
      }
    ];
    render(
      <MemoryRouter initialEntries={['/slow']} routes={routes}>
        <View />
      </MemoryRouter>
    );
    // render()'s act already flushed the subscribe effect: the cold-start
    // resolve is pending and there is no previous view to retain.
    expect(screen.getByTestId('skeleton')).toBeDefined();
    expect(screen.queryByText('Page')).toBeNull();

    await act(async () => {
      gate.resolve('slow-data');
    });
    await flush();
    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(screen.getByText('Page')).toBeDefined();
    expect(screen.getByText('slow-data')).toBeDefined();
  });

  it('should swap the retained view for the skeleton after pendingDelayMs of a slow in-app navigation', async () => {
    // One deferred per navigation: the second stays pending past the
    // threshold.
    const gates = [deferred<string>(), deferred<string>()];
    let call = 0;
    const data = vi.fn(() => gates[call++].promise);
    function ListPage() {
      return (
        <div>
          <Page />
          <Link to="/list?page=2" data-testid="next-page">
            Next
          </Link>
        </div>
      );
    }
    const routes: Route[] = [
      {
        path: '/list',
        component: () => ListPage,
        data,
        pendingComponent: Skeleton
      }
    ];
    render(
      <MemoryRouter
        initialEntries={['/list?page=1']}
        routes={routes}
        pendingDelayMs={20}
      >
        <View />
      </MemoryRouter>
    );
    // Cold start renders the skeleton immediately, as always.
    expect(screen.getByTestId('skeleton')).toBeDefined();
    gates[0].resolve('page-1-data');
    await flush();
    expect(screen.getByText('page-1-data')).toBeDefined();

    // In-app navigation stays on the old view inside the threshold…
    fireEvent.click(screen.getByTestId('next-page'));
    await flush();
    expect(data).toHaveBeenCalledTimes(2);
    expect(screen.getByText('page-1-data')).toBeDefined();
    expect(screen.queryByTestId('skeleton')).toBeNull();
    // …and swaps to the skeleton once the delay elapses while still
    // pending.
    await act(async () => {
      await new Promise((done) => setTimeout(done, 60));
    });
    expect(screen.getByTestId('skeleton')).toBeDefined();
    expect(screen.queryByText('page-1-data')).toBeNull();

    gates[1].resolve('page-2-data');
    await flush();
    expect(screen.getByText('page-2-data')).toBeDefined();
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('should not flash the skeleton for a loader that beats pendingDelayMs', async () => {
    // Both navigations resolve instantly — well inside the threshold.
    const gates = [Promise.resolve('fast-1'), Promise.resolve('fast-2')];
    let call = 0;
    const data = vi.fn(() => gates[call++]);
    function ListPage() {
      return (
        <div>
          <Page />
          <Link to="/list?page=2" data-testid="next-page">
            Next
          </Link>
        </div>
      );
    }
    const routes: Route[] = [
      {
        path: '/list',
        component: () => ListPage,
        data,
        pendingComponent: Skeleton
      }
    ];
    render(
      <MemoryRouter
        initialEntries={['/list?page=1']}
        routes={routes}
        pendingDelayMs={20}
      >
        <View />
      </MemoryRouter>
    );
    await flush();
    expect(screen.getByText('fast-1')).toBeDefined();

    // The second navigation resolves well inside the threshold: the view
    // swaps straight to the new data, no skeleton ever flashes.
    fireEvent.click(screen.getByTestId('next-page'));
    await act(async () => {
      await new Promise((done) => setTimeout(done, 60));
    });
    expect(screen.getByText('fast-2')).toBeDefined();
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('should keep the previous view on in-app pagination (no pending flash)', async () => {
    const gates = [deferred<string>(), deferred<string>()];
    let call = 0;
    const data = vi.fn(() => gates[call++].promise);
    const routes: Route[] = [
      {
        path: '/list',
        component: () => Page,
        data,
        pendingComponent: Skeleton
      }
    ];
    render(
      <MemoryRouter initialEntries={['/list?page=1']} routes={routes}>
        <View />
        <SearchControls />
      </MemoryRouter>
    );
    expect(screen.getByTestId('skeleton')).toBeDefined();
    await act(async () => {
      gates[0].resolve('page-1-data');
    });
    await flush();
    expect(screen.getByText('page-1-data')).toBeDefined();
    expect(screen.queryByTestId('skeleton')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('next-page'));
    });
    // The re-resolve of /list?page=2 is pending, but the old view is
    // retained: the skeleton must not flash over it.
    expect(data).toHaveBeenCalledTimes(2);
    expect(screen.getByText('page-1-data')).toBeDefined();
    expect(screen.queryByTestId('skeleton')).toBeNull();

    await act(async () => {
      gates[1].resolve('page-2-data');
    });
    await flush();
    expect(screen.getByText('page-2-data')).toBeDefined();
  });

  it('should prefer the resolving route own pendingComponent over an ancestor one', async () => {
    const gate = deferred<string>();
    function Layout() {
      return (
        <div>
          <h1>Layout</h1>
          <View />
        </div>
      );
    }
    const routes: Route[] = [
      {
        component: () => Layout,
        pendingComponent: ParentSkeleton,
        children: [
          {
            path: '/deep',
            component: () => Page,
            data: () => gate.promise,
            pendingComponent: Skeleton
          }
        ]
      }
    ];
    render(
      <MemoryRouter initialEntries={['/deep']} routes={routes}>
        <View />
      </MemoryRouter>
    );
    expect(screen.getByTestId('skeleton')).toBeDefined();
    expect(screen.queryByTestId('parent-skeleton')).toBeNull();

    await act(async () => {
      gate.resolve('deep-data');
    });
    await flush();
    expect(screen.getByText('Layout')).toBeDefined();
    expect(screen.getByText('deep-data')).toBeDefined();
  });

  it('should fall back to the nearest ancestor without a pendingComponent of its own', async () => {
    const gate = deferred<string>();
    function Layout() {
      return (
        <div>
          <h1>Layout</h1>
          <View />
        </div>
      );
    }
    const routes: Route[] = [
      {
        component: () => Layout,
        pendingComponent: ParentSkeleton,
        children: [
          {
            path: '/deep',
            component: () => Page,
            data: () => gate.promise
          }
        ]
      }
    ];
    render(
      <MemoryRouter initialEntries={['/deep']} routes={routes}>
        <View />
      </MemoryRouter>
    );
    expect(screen.getByTestId('parent-skeleton')).toBeDefined();

    await act(async () => {
      gate.resolve('deep-data');
    });
    await flush();
    expect(screen.queryByTestId('parent-skeleton')).toBeNull();
    expect(screen.getByText('deep-data')).toBeDefined();
  });

  it('should show the skeleton again when re-navigating after a failed cold start', async () => {
    const gate = deferred<string>();
    const routes: Route[] = [
      {
        path: '/err',
        component: () => Page,
        data: () => Promise.reject(new Error('boom'))
      },
      {
        path: '/slow',
        component: () => Page,
        data: () => gate.promise,
        pendingComponent: Skeleton
      }
    ];
    render(
      <MemoryRouter initialEntries={['/err']} routes={routes}>
        <View />
        <Link to="/slow">GoSlow</Link>
      </MemoryRouter>
    );
    await flush();
    // The failed cold start left no view(and no errorHandler view either).
    expect(screen.queryByText('Page')).toBeNull();
    expect(screen.queryByTestId('skeleton')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText('GoSlow'));
    });
    expect(screen.getByTestId('skeleton')).toBeDefined();

    await act(async () => {
      gate.resolve('slow-data');
    });
    await flush();
    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(screen.getByText('slow-data')).toBeDefined();
  });

  it('should expose the load status through useLoading', async () => {
    const gate = deferred<string>();
    function StatusProbe() {
      const loading = useLoading();
      return (
        <span data-testid="loading">{loading ? loading.status : 'idle'}</span>
      );
    }
    const routes: Route[] = [
      {path: '/slow', component: () => Page, data: () => gate.promise}
    ];
    render(
      <MemoryRouter initialEntries={['/slow']} routes={routes}>
        <View />
        <StatusProbe />
      </MemoryRouter>
    );
    expect(screen.getByTestId('loading').textContent).toBe('pending');

    await act(async () => {
      gate.resolve('slow-data');
    });
    await flush();
    expect(screen.getByText('slow-data')).toBeDefined();
    // The commit settles the loading episode on its final status.
    expect(screen.getByTestId('loading').textContent).toBe('resolved');
  });

  it('should render the pending skeleton directly when the Router has no children', async () => {
    const gate = deferred<string>();
    const routes: Route[] = [
      {
        path: '/slow',
        component: () => Page,
        data: () => gate.promise,
        pendingComponent: Skeleton
      }
    ];
    // Without children the Router component renders `view ?? pending`
    // itself: the cold-start pending phase must surface the skeleton.
    render(<MemoryRouter initialEntries={['/slow']} routes={routes} />);
    expect(screen.getByTestId('skeleton')).toBeDefined();
    expect(screen.queryByText('Page')).toBeNull();

    await act(async () => {
      gate.resolve('slow-data');
    });
    await flush();
    expect(screen.queryByTestId('skeleton')).toBeNull();
    expect(screen.getByText('slow-data')).toBeDefined();
  });
});

describe('TypedLink', () => {
  const routes = createRoutes({
    children: [
      {path: '/', component: () => Home},
      {path: '/users/:id', component: () => Page},
      {path: '/files/*rest', component: () => Page}
    ]
  });
  type Paths = RoutePaths<typeof routes>;

  function TypedApp() {
    return (
      <MemoryRouter routes={routes}>
        <nav>
          <TypedLink<Paths> to="/" data-testid="home-link">
            Home
          </TypedLink>
          <TypedLink<Paths>
            to="/users/:id"
            params={{id: '7'}}
            data-testid="user-link"
          >
            User7
          </TypedLink>
          <TypedLink<Paths>
            to="/files/*rest"
            params={{rest: ['a', 'b c']}}
            data-testid="files-link"
          >
            Files
          </TypedLink>
        </nav>
        <View />
      </MemoryRouter>
    );
  }

  it('should interpolate params into the href and navigate to the target', async () => {
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes as Route, history);
    render(
      <Router router={router}>
        <nav>
          <TypedLink<Paths> to="/" data-testid="home-link">
            Home
          </TypedLink>
          <TypedLink<Paths>
            to="/users/:id"
            params={{id: '7'}}
            data-testid="user-link"
          >
            User7
          </TypedLink>
        </nav>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByTestId('user-link').getAttribute('href')).toBe(
      '/users/7'
    );
    fireEvent.click(screen.getByTestId('user-link'));
    await flush();
    expect(screen.getByText('Page')).toBeDefined();
    // the navigated location carries the interpolated param
    expect(history.location.pathname).toBe('/users/7');
  });

  it('should encode param values and join wildcard segments with /', async () => {
    render(<TypedApp />);
    await flush();
    expect(screen.getByTestId('files-link').getAttribute('href')).toBe(
      '/files/a/b%20c'
    );
  });

  it('should keep the plain Link behavior for modified clicks', async () => {
    render(<TypedApp />);
    await flush();
    fireEvent.click(screen.getByTestId('user-link'), {ctrlKey: true});
    await flush();
    // no in-app navigation happened
    expect(screen.queryByText('Page')).toBeNull();
  });

  it('should keep params interpolation and click navigation through an as component', async () => {
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes as Route, history);
    render(
      <Router router={router}>
        <TypedLink<Paths, typeof PillLink>
          to="/users/:id"
          params={{id: '7'}}
          as={PillLink}
          variant="primary"
          tone="strong"
          data-testid="pill-link"
        >
          User7
        </TypedLink>
        <View />
      </Router>
    );
    await flush();
    const el = screen.getByTestId('pill-link') as HTMLAnchorElement;
    // The interpolated href and the flattened `as` props both arrived.
    expect(el.getAttribute('href')).toBe('/users/7');
    expect(el.getAttribute('data-variant')).toBe('primary');
    expect(el.getAttribute('data-tone')).toBe('strong');

    fireEvent.click(el);
    await flush();
    expect(screen.getByText('Page')).toBeDefined();
    expect(history.location.pathname).toBe('/users/7');

    // Modified clicks keep the browser default through the as component too.
    fireEvent.click(el, {ctrlKey: true});
    await flush();
    expect(history.location.pathname).toBe('/users/7');
  });

  it('should throw on click when a required param is missing (runtime backstop)', async () => {
    // The type-level check flags this at compile time; the runtime guard
    // covers untyped callers — plain TypedLink with a cast bypasses the
    // props check entirely.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    // Full-props cast: the untyped-caller shape reaches the runtime
    // exactly as an untyped table would produce it.
    const BadLink = TypedLink as unknown as (props: {
      to: string;
      params?: Record<string, string>;
      'data-testid'?: string;
      children?: React.ReactNode;
    }) => React.ReactElement;
    render(
      <MemoryRouter routes={routes}>
        <BadLink to="/users/:id" params={{}} data-testid="bad-link">
          Bad
        </BadLink>
        <View />
      </MemoryRouter>
    );
    await flush();
    // Rendering with a missing param keeps the raw pattern in the href
    expect(screen.getByTestId('bad-link').getAttribute('href')).toBe(
      '/users/:id'
    );
    // The click-time check throws inside the event handler; jsdom reports
    // handler errors as window errors instead of propagating them to the
    // dispatch caller, so capture through the window error hook.
    const handlerErrors: Error[] = [];
    const onWindowError = (e: ErrorEvent) => handlerErrors.push(e.error);
    window.addEventListener('error', onWindowError);
    try {
      fireEvent.click(screen.getByTestId('bad-link'));
    } finally {
      window.removeEventListener('error', onWindowError);
    }
    expect(handlerErrors[0]?.message).toMatch(/Missing param "id"/);
    // and no navigation happened
    expect(screen.queryByText('Page')).toBeNull();
    consoleError.mockRestore();
  });
});

describe('useSetSearch', () => {
  /** Same shape as the `search schema` suite: coerces `page`, defaults to 1. */
  const pageSearch: StandardSchemaV1<unknown, {page: number}> = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate(value) {
        const {page} = (value ?? {}) as {page?: unknown};
        const parsed = Number(page ?? 1);
        return Number.isInteger(parsed) && parsed >= 1
          ? {value: {page: parsed}}
          : {
              issues: [{message: 'expected a positive integer', path: ['page']}]
            };
      }
    }
  };

  let setSearchError: Error | undefined;

  function SetSearchApp() {
    const search = useSearch(pageSearch);
    // Values are the raw input shape (strings) — the schema coerces.
    const setSearch = useSetSearch(pageSearch);
    return (
      <div>
        <span data-testid="page">{search.page}</span>
        <button
          type="button"
          data-testid="set-page"
          onClick={() => setSearch({page: '3'})}
        >
          Set3
        </button>
        <button
          type="button"
          data-testid="set-bad"
          onClick={() => {
            try {
              setSearch({page: '-1'});
            } catch (e) {
              setSearchError = e as Error;
            }
          }}
        >
          SetBad
        </button>
        <button
          type="button"
          data-testid="set-default"
          onClick={() => setSearch({})}
        >
          SetDefault
        </button>
      </div>
    );
  }

  beforeEach(() => {
    setSearchError = undefined;
  });

  function renderApp(initialSearch = '?page=2') {
    const history = createMemoryHistory({
      initialEntries: [`/list${initialSearch}`]
    });
    const routes: Route[] = [{path: '/list', component: () => SetSearchApp}];
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    return history;
  }

  it('should write a schema-valid value and navigate', async () => {
    const history = renderApp();
    await flush();
    expect(screen.getByTestId('page').textContent).toBe('2');

    fireEvent.click(screen.getByTestId('set-page'));
    await flush();
    expect(screen.getByTestId('page').textContent).toBe('3');
    expect(history.location.search).toBe('?page=3');
  });

  it('should throw SearchError with issues and not navigate on an invalid value', async () => {
    const history = renderApp();
    await flush();

    fireEvent.click(screen.getByTestId('set-bad'));
    await flush();
    expect(setSearchError).toBeInstanceOf(SearchError);
    expect(setSearchError!.message).toContain('page');
    // location untouched
    expect(history.location.search).toBe('?page=2');
    expect(screen.getByTestId('page').textContent).toBe('2');
  });

  it('should write the schema output so defaults apply', async () => {
    const history = renderApp();
    await flush();

    fireEvent.click(screen.getByTestId('set-default'));
    await flush();
    expect(history.location.search).toBe('?page=1');
    expect(screen.getByTestId('page').textContent).toBe('1');
  });

  it('should accept functional updates based on the current search', async () => {
    const history = createMemoryHistory({initialEntries: ['/list?page=4']});
    const routes: Route[] = [{path: '/list', component: () => SetSearchApp}];
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByTestId('page').textContent).toBe('4');
  });

  it('should not surface an unhandled rejection when the replace chain fails, and still reject for await-ers', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    const outcomes: string[] = [];

    function GuardedPage() {
      const setSearch = useSetSearch(pageSearch);
      return (
        <div>
          <button
            type="button"
            data-testid="fire-and-forget"
            // The documented idiom: no await, no catch.
            onClick={() => setSearch({page: '3'}, {replace: true})}
          >
            FireAndForget
          </button>
          <button
            type="button"
            data-testid="awaited"
            onClick={() => {
              const done = setSearch({page: '4'}, {replace: true});
              if (done && typeof done.then === 'function') {
                done.then(
                  () => outcomes.push('resolved'),
                  (e: Error) => outcomes.push(`rejected:${e.message}`)
                );
              }
            }}
          >
            Awaited
          </button>
        </div>
      );
    }

    const history = createMemoryHistory({initialEntries: ['/list?page=2']});
    const routes: Route[] = [
      {
        path: '/list',
        component: () => GuardedPage,
        beforeLoad: ({search}) => {
          // The initial resolve(page 2) passes; any write away from it
          // fails the guard, rejecting the replace chain. No route
          // search schema here, so the guard sees the degraded input.
          if (Number((search as {page: string}).page) !== 2) {
            throw new Error('guard boom');
          }
        }
      }
    ];
    const router = createRouter(routes, history);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();

    try {
      fireEvent.click(screen.getByTestId('fire-and-forget'));
      await act(async () => {
        // A macrotask gives the rejection (and any unhandled-rejection
        // trap) time to surface.
        await new Promise((done) => setTimeout(done, 10));
      });
      expect(history.location.search).toBe('?page=2');
      expect(unhandled).toEqual([]);

      // The returned promise is the real chain: an await-er still
      // observes the failure.
      fireEvent.click(screen.getByTestId('awaited'));
      await flush();
      expect(outcomes).toEqual(['rejected:guard boom']);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('render-phase route error boundary', () => {
  function Boom(): never {
    throw new Error('boom crashed');
  }

  it('should render the route errorComponent with ctx.phase === "render" and recover by navigating away', async () => {
    let phase: string | undefined;
    let seenError: Error | undefined;
    let capturedRouter: ReturnType<typeof createRouter> | undefined;
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {
        path: '/boom',
        component: () => Boom,
        errorComponent: ({error, ctx}) => {
          capturedRouter = ctx.router;
          seenError = error;
          phase = ctx.phase;
          return (
            <div role="alert">
              RenderError:{error.message}
              <button
                type="button"
                data-testid="retry"
                onClick={() => {
                  refresh(ctx.router);
                }}
              >
                Retry
              </button>
            </div>
          );
        }
      }
    ];
    render(<MemoryRouter initialEntries={['/boom']} routes={routes} />);
    await flush();
    // The render error surfaces through the route errorComponent, with
    // the render phase marker — not a crash to the React root.
    expect(screen.getByRole('alert').textContent).toContain(
      'RenderError:boom crashed'
    );
    expect(phase).toBe('render');
    expect(seenError).toBeInstanceOf(Error);

    // Recovery: the retry button triggers a refresh(router); Boom throws
    // again so the errorComponent stays, proving the boundary keeps
    // working after the first catch(the view slot is not wedged).
    fireEvent.click(screen.getByTestId('retry'));
    await flush();
    expect(screen.getByRole('alert').textContent).toContain(
      'RenderError:boom crashed'
    );

    // And a plain navigate() away renders the new view normally.
    await act(async () => {
      navigate(capturedRouter!, '/');
    });
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should fall back to the global errorHandler when no route errorComponent is set', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {path: '/boom', component: () => Boom}
    ];
    render(
      <MemoryRouter
        initialEntries={['/boom']}
        routes={routes}
        errorHandler={(e) => <div role="alert">global:{e.message}</div>}
      />
    );
    await flush();
    expect(screen.getByRole('alert').textContent).toBe('global:boom crashed');
    consoleError.mockRestore();
  });

  it('should keep ancestor levels mounted while the failing leaf renders its errorComponent', async () => {
    function Layout() {
      return (
        <section>
          <h2>Layout</h2>
          <View />
        </section>
      );
    }
    const routes: Route[] = [
      {
        path: '/x',
        component: () => Layout,
        children: [
          {
            path: '/boom',
            component: () => Boom,
            errorComponent: ({error}) => (
              <p role="alert">leaf:{error.message}</p>
            )
          }
        ]
      }
    ];
    render(<MemoryRouter initialEntries={['/x/boom']} routes={routes} />);
    await flush();
    // The layout survives; only the failing leaf is replaced
    expect(screen.getByText('Layout')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('leaf:boom crashed');
  });
});

describe('useBlocker', () => {
  function setup(initialEntries: string[]) {
    const history = createMemoryHistory({initialEntries});
    const router = createRouter(
      {path: '', children: [{path: '/a'}, {path: '/b'}]},
      history,
      {resolveView: (matched) => Promise.resolve(matched.at(-1)!.path)}
    );
    return {history, router};
  }

  it('should block navigation while mounted and release on unmount', async () => {
    const {history, router} = setup(['/a']);
    const asks: Array<[string, string]> = [];
    function Probe() {
      useBlocker((to, from) => {
        asks.push([to, from]);
        return false;
      });
      return null;
    }
    const {unmount} = render(
      <Router router={router}>
        <Probe />
      </Router>
    );

    await act(async () => {
      await navigate(router, '/b');
    });
    expect(asks).toEqual([['/b', '/a']]);
    expect(history.location.pathname).toBe('/a');

    unmount();
    await act(async () => {
      await navigate(router, '/b');
    });
    expect(history.location.pathname).toBe('/b');
  });

  it('should always ask the latest predicate after a re-render', async () => {
    const {history, router} = setup(['/a']);
    function Probe({allow}: {allow: boolean}) {
      useBlocker(() => allow);
      return null;
    }
    const {rerender} = render(
      <Router router={router}>
        <Probe allow={false} />
      </Router>
    );

    // The mount-time closure vetoes everything.
    await act(async () => {
      await navigate(router, '/b');
    });
    expect(history.location.pathname).toBe('/a');

    // A plain re-render — no re-registration — swaps in the new closure.
    rerender(
      <Router router={router}>
        <Probe allow />
      </Router>
    );
    await act(async () => {
      await navigate(router, '/b');
    });
    expect(history.location.pathname).toBe('/b');
  });

  it('should expose the vetoed navigation as state and proceed on demand', async () => {
    const {history, router} = setup(['/a']);
    let blockerRef: ReturnType<typeof useBlocker> | undefined;
    function Probe({dirty}: {dirty: boolean}) {
      // dirty ⇒ veto the navigation (open the ask); clean ⇒ let it pass.
      const blocker = useBlocker(() => !dirty);
      blockerRef = blocker;
      return null;
    }
    render(
      <Router router={router}>
        <Probe dirty />
      </Router>
    );
    expect(blockerRef!.state).toBe(null);

    await act(async () => {
      await navigate(router, '/b');
    });
    // The ask is open, the router stayed.
    expect(blockerRef!.state).toEqual({location: '/b', from: '/a'});
    expect(history.location.pathname).toBe('/a');

    // Confirm: the retry bypasses this blocker only — the navigation
    // lands even though the predicate still vetoes.
    await act(async () => {
      blockerRef!.proceed();
    });
    expect(history.location.pathname).toBe('/b');
    expect(blockerRef!.state).toBe(null);
  });

  it('should reset the ask and stay', async () => {
    const {history, router} = setup(['/a']);
    let blockerRef: ReturnType<typeof useBlocker> | undefined;
    function Probe() {
      blockerRef = useBlocker(() => false);
      return null;
    }
    render(
      <Router router={router}>
        <Probe />
      </Router>
    );

    await act(async () => {
      await navigate(router, '/b');
    });
    expect(blockerRef!.state).toEqual({location: '/b', from: '/a'});

    await act(async () => {
      blockerRef!.reset();
    });
    expect(blockerRef!.state).toBe(null);
    expect(history.location.pathname).toBe('/a');

    // After a reset the guard still stands: the next navigation is
    // asked and vetoed again, with a fresh ask.
    await act(async () => {
      await navigate(router, '/b');
    });
    expect(blockerRef!.state).toEqual({location: '/b', from: '/a'});
    expect(history.location.pathname).toBe('/a');
  });

  it('should open the ask for a vetoed browser POP and proceed as a push', async () => {
    const {history, router} = setup(['/a']);
    let blockerRef: ReturnType<typeof useBlocker> | undefined;
    function Probe() {
      blockerRef = useBlocker((to) => to === '/b');
      return null;
    }
    render(
      <Router router={router}>
        <Probe />
      </Router>
    );

    // In-app navigate to /b — allowed by the predicate, no ask.
    await act(async () => {
      await navigate(router, '/b');
    });
    expect(blockerRef!.state).toBe(null);

    // The user presses BACK (leaving /b): the POP is vetoed and
    // rewound by the core, then the ask opens.
    await act(async () => {
      go(router, -1);
      // The veto's counter-go() is an async browser traversal; settle
      // it before asserting.
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(blockerRef!.state).toEqual({location: '/a', from: '/b'});
    expect(history.location.pathname).toBe('/b');

    // Confirm: a fresh push to the target the user asked for (a vetoed
    // POP is retried as a push — the history entry was never left).
    await act(async () => {
      blockerRef!.proceed();
    });
    expect(history.location.pathname).toBe('/a');
    expect(blockerRef!.state).toBe(null);
  });

  it('should let a later blocker veto the proceed retry into a fresh ask', async () => {
    const {router} = setup(['/a']);
    const otherAsks: string[] = [];
    let blockerRef: ReturnType<typeof useBlocker> | undefined;
    function Probe() {
      blockerRef = useBlocker(() => false);
      return null;
    }
    render(
      <Router router={router}>
        <Probe />
      </Router>
    );
    // A second, unconditionally vetoing blocker registered after this
    // hook's own — the hook's first veto wins, the other is not asked.
    setBlocker(router, () => {
      otherAsks.push('other');
      return false;
    });

    await act(async () => {
      await navigate(router, '/b');
    });
    expect(blockerRef!.state).toEqual({location: '/b', from: '/a'});
    expect(otherAsks).toEqual([]);

    await act(async () => {
      blockerRef!.proceed();
    });
    // The retry bypassed this hook's blocker but still asked the other
    // one, which vetoed — the navigation stays cancelled (URL intact),
    // and since that veto belongs to a different blocker, this hook's
    // ask is not re-opened.
    expect(otherAsks).toEqual(['other']);
    expect(router.history.location.pathname).toBe('/a');
    expect(blockerRef!.state).toBe(null);
  });

  it('should not leak the proceed bypass when an earlier blocker vetoes the retry', async () => {
    const {history, router} = setup(['/a']);
    // Registered BEFORE the hook's own blocker, so it is asked first:
    // a closed gate truncates the asking before the hook is reached.
    let gateClosed = false;
    setBlocker(router, () => !gateClosed);
    let blockerRef: ReturnType<typeof useBlocker> | undefined;
    function Probe() {
      blockerRef = useBlocker(() => false);
      return null;
    }
    render(
      <Router router={router}>
        <Probe />
      </Router>
    );

    // Gate open: the hook is asked, vetoes, the ask opens.
    await act(async () => {
      await navigate(router, '/b');
    });
    expect(blockerRef!.state).toEqual({location: '/b', from: '/a'});
    expect(history.location.pathname).toBe('/a');

    // Close the gate, then confirm: the retry is vetoed by the gate
    // BEFORE this hook's blocker is asked, so the one-shot bypass is
    // never consumed by an ask — it must be extinguished anyway.
    gateClosed = true;
    await act(async () => {
      blockerRef!.proceed();
    });
    expect(history.location.pathname).toBe('/a');
    expect(blockerRef!.state).toBe(null);

    // Reopen the gate: an unrelated navigation must be asked by this
    // hook again. A leaked bypass would let it through silently — the
    // dirty guard would have lost one protection.
    gateClosed = false;
    await act(async () => {
      await navigate(router, '/b?x=1');
    });
    expect(history.location.pathname).toBe('/a');
    expect(blockerRef!.state).toEqual({location: '/b?x=1', from: '/a'});

    // And the retry-success path clears the flag through consumption:
    // proceed lands, and the next navigation is vetoed afresh.
    await act(async () => {
      blockerRef!.proceed();
    });
    expect(history.location.pathname).toBe('/b');
    expect(blockerRef!.state).toBe(null);
    await act(async () => {
      await navigate(router, '/a');
    });
    expect(history.location.pathname).toBe('/b');
    expect(blockerRef!.state).toEqual({location: '/a', from: '/b?x=1'});
  });

  it('should keep blocking after a proceed landed — the bypass is one-shot', async () => {
    const {history, router} = setup(['/a']);
    let blockerRef: ReturnType<typeof useBlocker> | undefined;
    function Probe() {
      blockerRef = useBlocker(() => false);
      return null;
    }
    render(
      <Router router={router}>
        <Probe />
      </Router>
    );

    await act(async () => {
      await navigate(router, '/b');
    });
    expect(blockerRef!.state).toEqual({location: '/b', from: '/a'});
    await act(async () => {
      blockerRef!.proceed();
    });
    expect(history.location.pathname).toBe('/b');
    expect(blockerRef!.state).toBe(null);

    // The bypass died with the retry it was minted for: the guard
    // stands again on the very next navigation.
    await act(async () => {
      await navigate(router, '/a');
    });
    expect(history.location.pathname).toBe('/b');
    expect(blockerRef!.state).toEqual({location: '/a', from: '/b'});
  });

  it('should ask the predicate exactly once under StrictMode double-effects', async () => {
    const {history, router} = setup(['/a']);
    const fn = vi.fn(() => false);
    function Probe() {
      useBlocker(fn);
      return null;
    }
    render(
      <React.StrictMode>
        <Router router={router}>
          <Probe />
        </Router>
      </React.StrictMode>
    );

    await act(async () => {
      await navigate(router, '/b');
    });
    // StrictMode runs the effect register→release→register; exactly one
    // registration must survive, so one navigation asks the predicate
    // once — a double registration would ask twice.
    expect(fn).toHaveBeenCalledTimes(1);
    expect(history.location.pathname).toBe('/a');
  });

  it('should no-op proceed and reset while nothing is pending', async () => {
    const {history, router} = setup(['/a']);
    let blockerRef: ReturnType<typeof useBlocker> | undefined;
    function Probe() {
      blockerRef = useBlocker(() => false);
      return null;
    }
    render(
      <Router router={router}>
        <Probe />
      </Router>
    );

    expect(() => {
      blockerRef!.proceed();
      blockerRef!.reset();
    }).not.toThrow();
    expect(blockerRef!.state).toBe(null);
    // The no-ops are truly inert — not even a bypass leaked, so the
    // guard still vetoes the next navigation.
    await act(async () => {
      await navigate(router, '/b');
    });
    expect(history.location.pathname).toBe('/a');
    expect(blockerRef!.state).toEqual({location: '/b', from: '/a'});
  });

  it('should replace a superseded ask with the newer navigation', async () => {
    const {router} = setup(['/a']);
    let blockerRef: ReturnType<typeof useBlocker> | undefined;
    function Probe() {
      blockerRef = useBlocker(() => false);
      return null;
    }
    render(
      <Router router={router}>
        <Probe />
      </Router>
    );

    await act(async () => {
      await navigate(router, '/b');
    });
    expect(blockerRef!.state).toEqual({location: '/b', from: '/a'});

    // A second navigation while the first ask is open: the ask now
    // tracks the newer target; proceeding to the stale one is gone.
    await act(async () => {
      await navigate(router, '/b?x=1');
    });
    expect(blockerRef!.state).toEqual({location: '/b?x=1', from: '/a'});
    // The vetoed second navigation never started — the URL is untouched.
    expect(router.history.location.pathname).toBe('/a');
  });
});

// 任务：Router context 透传 + TypedNavLink/TypedPrefetchLink 的运行时行为。
// context：createRouter options / Router 组件 props 的值必须到达
// beforeLoad、data loader 的 ctx.context（每实例一份）。
describe('Router context', () => {
  it('should hand the props context to guards and data loaders', async () => {
    const api = {who: () => 'ctx-user'};
    const seen: {guard?: unknown; data?: unknown} = {};
    const routes: Route[] = [
      {
        path: '/ctx',
        beforeLoad: ({context}) => {
          seen.guard = context;
        },
        data: ({context}) => {
          seen.data = context;
          return (context as {who(): string}).who();
        },
        component: () => Page
      }
    ];
    const router = createRouter(routes, createMemoryHistory(), {context: api});
    expect(router.context).toBe(api);
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await act(async () => {
      await navigate(router, '/ctx');
    });
    await flush();
    // The very same object, by reference, on both contexts.
    expect(seen.guard).toBe(api);
    expect(seen.data).toBe(api);
    expect(screen.getByText('ctx-user')).toBeDefined();
  });

  it('should flow the context of the Router components into loaders', async () => {
    const api = {who: () => 'prop-user'};
    const routes: Route[] = [
      {
        path: '/',
        data: ({context}) => (context as {who(): string}).who(),
        component: () => Page
      }
    ];
    render(
      <MemoryRouter routes={routes} context={api}>
        <View />
      </MemoryRouter>
    );
    await flush();
    expect(screen.getByText('prop-user')).toBeDefined();
  });

  it('should keep the context undefined without the option', async () => {
    const seen: unknown[] = [];
    const routes: Route[] = [
      {
        path: '/',
        beforeLoad: ({context}) => void seen.push(context),
        data: ({context}) => void seen.push(context),
        component: () => Page
      }
    ];
    const router = createRouter(routes, createMemoryHistory());
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();
    expect(seen).toEqual([undefined, undefined]);
  });

  describe('route context', () => {
    it('should fold route contexts into guards and per-level data loaders', async () => {
      const seen: Array<[string, unknown]> = [];
      function Leaf() {
        return <h1>Leaf</h1>;
      }
      const routes = createRoutes({
        path: '',
        context: {theme: 'light'},
        children: [
          {
            path: '/admin',
            context: {role: 'admin', theme: 'dark'},
            data: (ctx) => {
              seen.push(['admin-data', ctx.context]);
              return null;
            },
            children: [
              {
                path: '/audit',
                context: {pane: 'audit'},
                beforeLoad: ({context}) => {
                  seen.push(['audit-guard', context]);
                },
                data: (ctx) => {
                  seen.push(['audit-data', ctx.context]);
                  return null;
                },
                component: () => Leaf
              }
            ]
          }
        ]
      });
      const api = {who: () => 'api'};
      render(
        <MemoryRouter
          initialEntries={['/admin/audit']}
          routes={routes}
          context={api}
        >
          <View />
        </MemoryRouter>
      );
      await flush();
      expect(screen.getByText('Leaf')).toBeDefined();
      // The guard sees the fold through its own level; each data loader
      // sees the fold through ITS level — the layout's loader never
      // observes the deeper declarations.
      expect(seen).toEqual([
        [
          'audit-guard',
          {who: api.who, theme: 'dark', role: 'admin', pane: 'audit'}
        ],
        ['admin-data', {who: api.who, theme: 'dark', role: 'admin'}],
        [
          'audit-data',
          {who: api.who, theme: 'dark', role: 'admin', pane: 'audit'}
        ]
      ]);
    });

    it('should keep the exact instance context for tables that declare none', async () => {
      const api = {who: () => 'plain'};
      const seen: unknown[] = [];
      const routes = createRoutes({
        path: '',
        children: [
          {
            path: '/plain',
            data: (ctx) => {
              seen.push(ctx.context);
              return null;
            },
            component: () => Page
          }
        ]
      });
      render(
        <MemoryRouter initialEntries={['/plain']} routes={routes} context={api}>
          <View />
        </MemoryRouter>
      );
      await flush();
      // No declarations anywhere: the loaders see the very instance
      // object, by reference.
      expect(seen).toEqual([api]);
    });
  });
});

describe('notFound', () => {
  function NotFoundPage() {
    return <h1 data-testid="not-found">Nothing here</h1>;
  }

  it('should render the notFound node for an unmatched cold-start URL', async () => {
    render(
      <MemoryRouter
        initialEntries={['/definitely/not/matched']}
        routes={[{path: '/', component: () => Home}]}
        notFound={<NotFoundPage />}
      >
        <View />
      </MemoryRouter>
    );
    await flush();
    expect(screen.getByTestId('not-found')).toBeDefined();
    expect(screen.queryByText('Home')).toBeNull();
  });

  it('should render the notFound component for an unmatched in-app navigation and replay on back', async () => {
    const router = createRouter(
      [
        {path: '/', component: () => Home},
        {path: '/a', component: () => A}
      ],
      createMemoryHistory({initialEntries: ['/']})
    );
    render(
      <Router router={router} notFound={NotFoundPage}>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByText('Home')).toBeDefined();

    await act(async () => {
      await navigate(router, '/missing');
    });
    await flush();
    expect(screen.getByTestId('not-found')).toBeDefined();
    // The 404 view is the entry's committed view: back replays Home
    // with zero resolves.
    await act(async () => {
      go(router, -1);
    });
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.queryByTestId('not-found')).toBeNull();
  });

  it('should keep the errorHandler path for other errors, and skip it for NotFoundError', async () => {
    const handlerErrors: Error[] = [];
    const routes: Route[] = [
      {path: '/', component: () => Home},
      {
        path: '/throw',
        component: () => A,
        // An async rejection rides the errorHandler channel (a
        // synchronous throw escapes it — pre-existing behavior, out of
        // scope here).
        data: () => Promise.reject(new Error('data boom'))
      }
    ];
    const router = createRouter(
      routes,
      createMemoryHistory({initialEntries: ['/']}),
      {
        errorHandler(e) {
          handlerErrors.push(e);
          return <B />;
        }
      }
    );
    render(
      <Router router={router} notFound={<NotFoundPage />}>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByText('Home')).toBeDefined();

    // NotFoundError never reaches errorHandler — notFound rendered.
    await act(async () => {
      await navigate(router, '/missing');
    });
    await flush();
    expect(screen.getByTestId('not-found')).toBeDefined();
    expect(handlerErrors).toEqual([]);

    // Any other error keeps the errorHandler contract untouched.
    await act(async () => {
      await navigate(router, '/throw');
    });
    await flush();
    expect(handlerErrors.map((e) => e.message)).toEqual(['data boom']);
    expect(screen.getByText('B')).toBeDefined();
  });

  it('should keep the errorHandler receiving NotFoundError without the prop', async () => {
    const handlerErrors: Error[] = [];
    const routes: Route[] = [{path: '/', component: () => Home}];
    const router = createRouter(
      routes,
      createMemoryHistory({initialEntries: ['/']}),
      {
        errorHandler(e) {
          handlerErrors.push(e);
          return <B />;
        }
      }
    );
    render(
      <Router router={router}>
        <View />
      </Router>
    );
    await flush();
    await act(async () => {
      await navigate(router, '/missing');
    });
    await flush();
    // The pre-existing channel: errorHandler sees the NotFoundError and
    // its returned view commits.
    expect(handlerErrors.length).toBe(1);
    expect(handlerErrors[0]).toBeInstanceOf(NotFoundError);
    expect(screen.getByText('B')).toBeDefined();
  });
});

describe('TypedNavLink', () => {
  const routes = createRoutes({
    children: [
      {path: '/', component: () => Home},
      {path: '/users', component: () => A},
      {path: '/users/:id', component: () => Page}
    ]
  });
  type Paths = RoutePaths<typeof routes>;

  it('should interpolate params, track active state and navigate', async () => {
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes as Route, history);
    render(
      <Router router={router}>
        <nav>
          <TypedNavLink<Paths> to="/" data-testid="home">
            Home
          </TypedNavLink>
          <TypedNavLink<Paths>
            to="/users/:id"
            params={{id: '7'}}
            data-testid="user"
            className={({isActive}) => (isActive ? 'on' : 'off')}
          >
            User7
          </TypedNavLink>
        </nav>
        <View />
      </Router>
    );
    await flush();
    const user = screen.getByTestId('user') as HTMLAnchorElement;
    // The href carries the interpolated target.
    expect(user.getAttribute('href')).toBe('/users/7');
    // At '/': the root link is active (the '/' prefix matches every
    // path), the user link is not.
    expect(
      (screen.getByTestId('home') as HTMLAnchorElement).getAttribute(
        'aria-current'
      )
    ).toBe('page');
    expect(user.getAttribute('aria-current')).toBe(null);
    expect(user.className).toBe('off');

    fireEvent.click(user);
    await flush();
    expect(screen.getByText('Page')).toBeDefined();
    expect(history.location.pathname).toBe('/users/7');
    // The active state follows the interpolated target.
    expect(user.getAttribute('aria-current')).toBe('page');
    expect(user.className).toBe('on');
    // The root link keeps its prefix match on '/users/7'.
    expect(
      (screen.getByTestId('home') as HTMLAnchorElement).getAttribute(
        'aria-current'
      )
    ).toBe('page');
  });

  it('should respect end and keep NavLink capabilities through an as component', async () => {
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes as Route, history);
    render(
      <Router router={router}>
        <nav>
          <TypedNavLink<Paths>
            to="/"
            end
            as={PillLink}
            variant="primary"
            data-testid="root"
          >
            Root
          </TypedNavLink>
        </nav>
        <View />
      </Router>
    );
    await flush();
    const el = screen.getByTestId('root') as HTMLAnchorElement;
    // The flattened as prop reached the component.
    expect(el.getAttribute('data-variant')).toBe('primary');
    // `end`: at '/' the root link is exactly active...
    expect(el.getAttribute('aria-current')).toBe('page');

    fireEvent.click(screen.getByText('Root'));
    await flush();
    // Still exactly active at '/'.
    expect(el.getAttribute('aria-current')).toBe('page');

    // Navigating away to '/users/7' deactivates it — the '/' prefix
    // would match without `end`.
    await act(async () => {
      await navigate(router, '/users/7');
    });
    await flush();
    expect(el.getAttribute('aria-current')).toBe(null);
  });

  it('should throw on click when a required param is missing (runtime backstop)', async () => {
    // The type-level check flags this at compile time; the runtime guard
    // covers untyped callers — the same cast pattern TypedLink tests use.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const BadLink = TypedNavLink as unknown as (props: {
      to: string;
      params?: Record<string, string>;
      'data-testid'?: string;
      children?: React.ReactNode;
    }) => React.ReactElement;
    render(
      <MemoryRouter routes={routes}>
        <BadLink to="/users/:id" params={{}} data-testid="bad-link">
          Bad
        </BadLink>
        <View />
      </MemoryRouter>
    );
    await flush();
    // Rendering with a missing param keeps the raw pattern in the href.
    expect(screen.getByTestId('bad-link').getAttribute('href')).toBe(
      '/users/:id'
    );
    // The click-time check throws inside the event handler; jsdom reports
    // handler errors as window errors instead of propagating them to the
    // dispatch caller, so capture through the window error hook.
    const handlerErrors: Error[] = [];
    const onWindowError = (e: ErrorEvent) => handlerErrors.push(e.error);
    window.addEventListener('error', onWindowError);
    try {
      fireEvent.click(screen.getByTestId('bad-link'));
    } finally {
      window.removeEventListener('error', onWindowError);
    }
    expect(handlerErrors[0]?.message).toMatch(/Missing param "id"/);
    // and no navigation happened
    expect(screen.queryByText('Page')).toBeNull();
    consoleError.mockRestore();
  });

  it('should not throw when the user onClick already prevented the default', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const handlerErrors: Error[] = [];
    const onWindowError = (e: ErrorEvent) => handlerErrors.push(e.error);
    window.addEventListener('error', onWindowError);
    const BadLink = TypedNavLink as unknown as (props: {
      to: string;
      params?: Record<string, string>;
      onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
      'data-testid'?: string;
      children?: React.ReactNode;
    }) => React.ReactElement;
    render(
      <MemoryRouter routes={routes}>
        <BadLink
          to="/users/:id"
          params={{}}
          data-testid="prevented-link"
          onClick={(e) => e.preventDefault()}
        >
          Bad
        </BadLink>
        <View />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByTestId('prevented-link'));
    await flush();
    // A prevented default means no navigation was going to happen — the
    // missing-param backstop stays quiet instead of throwing.
    expect(handlerErrors).toEqual([]);
    expect(screen.queryByText('Page')).toBeNull();
    window.removeEventListener('error', onWindowError);
    consoleError.mockRestore();
  });
});

describe('TypedPrefetchLink', () => {
  const routes = createRoutes({
    children: [
      {path: '/', component: () => Home},
      {path: '/users/:id', component: () => Page, data: () => 'user-data'}
    ]
  });
  type Paths = RoutePaths<typeof routes>;

  it('should prefetch and commit the interpolated target', async () => {
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes as Route, history);
    render(
      <Router router={router}>
        <View />
        <TypedPrefetchLink<Paths>
          to="/users/:id"
          params={{id: '7'}}
          data-testid="target"
        >
          User7
        </TypedPrefetchLink>
      </Router>
    );
    await flush();
    const el = screen.getByTestId('target') as HTMLAnchorElement;
    expect(el.getAttribute('href')).toBe('/users/7');

    // Hover is the default 'intent' trigger.
    await act(async () => {
      fireEvent.mouseEnter(el);
    });
    await flush();
    // The prefetched view resolved the interpolated target.
    expect(screen.getByText('Home')).toBeDefined();

    fireEvent.click(el);
    await flush();
    expect(screen.getByText('Page')).toBeDefined();
    expect(history.location.pathname).toBe('/users/7');
  });

  it('should keep the raw pattern when a required param is missing', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const BadLink = TypedPrefetchLink as unknown as (props: {
      to: string;
      params?: Record<string, string>;
      'data-testid'?: string;
      children?: React.ReactNode;
    }) => React.ReactElement;
    render(
      <MemoryRouter routes={routes}>
        <BadLink to="/users/:id" params={{}} data-testid="bad-prefetch">
          Bad
        </BadLink>
        <View />
      </MemoryRouter>
    );
    await flush();
    // The href keeps the raw pattern; the runtime surfaces the mismatch
    // as a navigation failure (no route matches ':id' uninterpolated).
    expect(screen.getByTestId('bad-prefetch').getAttribute('href')).toBe(
      '/users/:id'
    );
    expect(screen.getByText('Home')).toBeDefined();
    consoleError.mockRestore();
  });
});

// 任务：TypedLink 家族 search prop——运行时把 search 对象序列化进目标
// （值 String()-化、数组重复键、undefined/null 丢弃），href 预览、预取与
// 点击导航消费同一目标；路由 schema 在 resolve 时像手写 URL 一样校验
// coerce 结果。类型层判别见 test/types.test.tsx 的 search typing describe。
describe('TypedLink search', () => {
  // 与 `search schema` 套件同款的 coerce 夹具，input 侧是 URL 形状
  // （string / string[]），output 侧 coerce 成 number。
  const pageSearch: StandardSchemaV1<
    {page?: string; tag?: string[]},
    {page: number; tag: string[]}
  > = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) => {
        const input = value as {page?: string; tag?: string[]};
        const page = Number(input.page ?? '1');
        return {
          value: {
            page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
            tag: input.tag ?? []
          }
        };
      }
    }
  };

  const seen: {page: number; tag: string[]}[] = [];
  function SearchPage() {
    const search = useData() as {page: number; tag: string[]};
    return <div>page:{search.page}</div>;
  }

  const routes = createRoutes({
    children: [
      {path: '/', component: () => Home},
      {
        path: '/list',
        search: pageSearch,
        component: () => SearchPage,
        data: ({search}) => {
          seen.push(search);
          return search;
        }
      },
      {path: '/users/:id', component: () => Page}
    ]
  });

  beforeEach(() => {
    seen.length = 0;
  });

  it('should serialize search into the href and navigate the same target', async () => {
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes as Route, history);
    render(
      <Router router={router}>
        <TypedLink<typeof routes>
          to="/list"
          search={{page: '2', tag: ['a', 'b']}}
          data-testid="list-link"
        >
          List
        </TypedLink>
        <View />
      </Router>
    );
    await flush();
    // Arrays repeat the key; values percent-encoded on the way out.
    expect(screen.getByTestId('list-link').getAttribute('href')).toBe(
      '/list?page=2&tag=a&tag=b'
    );

    fireEvent.click(screen.getByTestId('list-link'));
    await flush();
    expect(history.location.search).toBe('?page=2&tag=a&tag=b');
    // The route schema coerced the serialized input like a hand-written URL.
    expect(seen.at(-1)).toEqual({page: 2, tag: ['a', 'b']});
    expect(screen.getByText('page:2')).toBeDefined();
  });

  it('should drop undefined/null entries and skip an empty search', async () => {
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes as Route, history);
    render(
      <Router router={router}>
        {/* 数字值照 String() 化（宽松/退化调用的运行时口径） */}
        <TypedLink<typeof routes>
          to="/list"
          search={{page: '3'}}
          data-testid="num-link"
        >
          3
        </TypedLink>
        <TypedLink<typeof routes>
          to="/list"
          search={{}}
          data-testid="empty-link"
        >
          empty
        </TypedLink>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByTestId('num-link').getAttribute('href')).toBe(
      '/list?page=3'
    );
    expect(screen.getByTestId('empty-link').getAttribute('href')).toBe('/list');
  });

  it('should extend an existing query string with & instead of a second ?', async () => {
    // Untyped-caller shape: a `to` already carrying a query string.
    const LooseLink = TypedLink as unknown as (props: {
      to: string;
      search?: Record<string, unknown>;
      'data-testid'?: string;
      children?: React.ReactNode;
    }) => React.ReactElement;
    render(
      <MemoryRouter routes={routes}>
        <LooseLink
          to="/list?keep=1"
          search={{page: '4', gone: undefined}}
          data-testid="joined-link"
        >
          joined
        </LooseLink>
        <View />
      </MemoryRouter>
    );
    await flush();
    expect(screen.getByTestId('joined-link').getAttribute('href')).toBe(
      '/list?keep=1&page=4'
    );
  });

  it('should land search on TypedNavLink alongside params without affecting matching', async () => {
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes as Route, history);
    render(
      <Router router={router}>
        <TypedNavLink<typeof routes>
          to="/users/:id"
          params={{id: '7'}}
          search={{page: '5'}}
          data-testid="user-link"
        >
          User7
        </TypedNavLink>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByTestId('user-link').getAttribute('href')).toBe(
      '/users/7?page=5'
    );

    fireEvent.click(screen.getByTestId('user-link'));
    await flush();
    expect(history.location.pathname).toBe('/users/7');
    expect(history.location.search).toBe('?page=5');
    // Active state follows the interpolated pathname; search never matches.
    expect(screen.getByTestId('user-link').getAttribute('aria-current')).toBe(
      'page'
    );
  });

  it('should prefetch and commit the search-carrying target', async () => {
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes as Route, history);
    render(
      <Router router={router}>
        <View />
        <TypedPrefetchLink<typeof routes>
          to="/list"
          search={{page: '6'}}
          prefetch="render"
          data-testid="prefetch-link"
        >
          List
        </TypedPrefetchLink>
      </Router>
    );
    await flush();
    expect(screen.getByTestId('prefetch-link').getAttribute('href')).toBe(
      '/list?page=6'
    );
    // 'render' prefetched the entry; the loader already saw the search.
    expect(seen.at(-1)).toEqual({page: 6, tag: []});

    fireEvent.click(screen.getByTestId('prefetch-link'));
    await flush();
    expect(history.location.search).toBe('?page=6');
    expect(screen.getByText('page:6')).toBeDefined();
  });
});

describe('View Transitions', () => {
  // jsdom 没有 document.startViewTransition：默认即降级路径。需要动画
  // 断言的用例装上 mock（记录 update/types，不自动执行 update——由测试
  // 显式驱动，才能断言「视图先停在旧帧」与「回调内同步完成渲染」）。
  type RecordedTransition = {update: () => void; types?: string[]};

  const routes: Route[] = [
    {path: '/', component: () => Home},
    {path: '/page', component: () => Page, data: () => 'page-data'}
  ];

  function installStartViewTransition() {
    const calls: RecordedTransition[] = [];
    let first = true;
    document.startViewTransition = ((arg: unknown) => {
      const record =
        typeof arg === 'function'
          ? {update: arg as () => void}
          : {
              update: (arg as RecordedTransition).update,
              types: (arg as RecordedTransition).types
            };
      calls.push(record);
      if (first) {
        // 首个调用是能力探测：真机上 skip 后 ready/finished 以
        // AbortError reject——mock 如实 reject。若探针没有接住，
        // vitest 的 unhandled rejection 检测会直接挂掉本用例，
        // 即泄漏回归。
        first = false;
        const skipped = Promise.reject(new Error('Transition was skipped'));
        return {ready: skipped, finished: skipped, skipTransition() {}};
      }
      // 真实过渡的 update 由测试显式驱动；finished 永不落定，避免
      // 兜底 bail 抢先提交挂起视图（真机上 update 先于 finished）。
      return {
        ready: Promise.resolve(),
        finished: new Promise(() => {}),
        skipTransition() {}
      };
    }) as typeof document.startViewTransition;
    return calls;
  }

  // 卸载 mock 恢复「无 API」基线；同时重置模块级能力探测缓存，让每个
  // 用例的首次动画导航都按本用例的 mock 重新探测（探测调用会混入
  // calls[0]：update 空操作、types []）。
  afterEach(() => {
    delete (document as {startViewTransition?: unknown}).startViewTransition;
    resetViewTransitionCapability();
  });

  it('should animate push navigations with a synchronous in-callback render', async () => {
    const calls = installStartViewTransition();
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    render(
      <Router router={router} viewTransition>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByText('Home')).toBeDefined();
    // 冷启动是 listen 的预热 replace + 惰性重解析落位：默认谓词不做动画。
    expect(calls).toHaveLength(0);

    await act(async () => {
      fireEvent.click(screen.getByText('GoPage'));
    });
    await flush();
    // 首次动画导航先做一次性 types 能力探测（calls[0]），真正的 push
    // 过渡是 calls[1]，types 带方向 'push'。
    expect(calls).toHaveLength(2);
    expect(calls[0].types).toEqual([]);
    expect(calls[1].types).toEqual(['push']);
    // update 还没被「浏览器」执行：视图仍停在旧帧。
    expect(screen.getByText('Home')).toBeDefined();

    // 回调内同步完成渲染（flushSync 生效）：update 返回即已提交新视图，
    // 而非调度态。
    act(() => {
      calls[1].update();
    });
    expect(screen.getByText('Page')).toBeDefined();
    expect(screen.queryByText('Home')).toBeNull();
  });

  it('should not open a transition for a searchDeps fast-path navigation', async () => {
    const calls = installStartViewTransition();
    const searchRoutes: Route[] = [
      {
        searchDeps: [],
        component: () =>
          Promise.resolve(() => (
            <nav>
              Layout
              <View />
            </nav>
          )),
        children: [{path: '/', searchDeps: [], component: () => Home}]
      }
    ];
    const history = createMemoryHistory({initialEntries: ['/?x=1']});
    const router = createRouter(searchRoutes, history);
    render(
      <Router router={router} viewTransition>
        <View />
      </Router>
    );
    await flush();
    expect(screen.getByText('Home')).toBeDefined();

    await act(async () => {
      navigate(router, '/?x=2');
    });
    await flush();
    // The re-served view is the very same reference: no transition opens
    // (there is no DOM swap to animate) — only search-subscribed readers
    // re-render in place.
    expect(calls).toHaveLength(0);
    expect(history.location.search).toBe('?x=2');
    expect(screen.getByText('Home')).toBeDefined();
  });

  it('should not animate pop under the default predicate (MemoryRouter prop threading)', async () => {
    const calls = installStartViewTransition();
    let captured: RouterInstance<Route> | undefined;
    function Capture() {
      captured = useRouter();
      return null;
    }
    render(
      <MemoryRouter routes={routes} viewTransition>
        <Capture />
        <View />
      </MemoryRouter>
    );
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByText('GoPage'));
    });
    await flush();
    // viewTransition prop 穿透了 MemoryRouter：push 走了动画（探测 + 过渡）。
    expect(calls).toHaveLength(2);
    expect(calls[1].types).toEqual(['push']);
    act(() => {
      calls[1].update();
    });
    expect(screen.getByText('Page')).toBeDefined();

    // POP 命中 viewStack 快照：直接通知，不经过 startViewTransition，
    // 视图照常恢复；前进同理。
    await act(async () => {
      captured!.history.back();
    });
    await flush();
    expect(calls).toHaveLength(2);
    expect(screen.getByText('Home')).toBeDefined();

    await act(async () => {
      captured!.history.forward();
    });
    await flush();
    expect(calls).toHaveLength(2);
    expect(screen.getByText('Page')).toBeDefined();
  });

  it('should not animate refresh (replace) under the default predicate', async () => {
    const calls = installStartViewTransition();
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    render(
      <Router router={router} viewTransition>
        <View />
      </Router>
    );
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByText('GoPage'));
    });
    await flush();
    expect(calls).toHaveLength(2);
    act(() => {
      calls[1].update();
    });
    expect(screen.getByText('Page')).toBeDefined();

    // refresh 是 replace：默认谓词保持静默，重解析视图照常落位。
    await act(async () => {
      await refresh(router);
    });
    await flush();
    expect(calls).toHaveLength(2);
    expect(screen.getByText('Page')).toBeDefined();
  });

  it('should animate pop when the predicate opts in, with accurate info', async () => {
    const calls = installStartViewTransition();
    const infos: ViewTransitionInfo[] = [];
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    render(
      <Router
        router={router}
        viewTransition={(info) => {
          infos.push(info);
          return info.action === 'pop';
        }}
      >
        <View />
      </Router>
    );
    await flush();
    // 冷启动的惰性重解析落位是一次有视图变化的 replace 通知：谓词收到
    // info 并拒绝（同视图的预热 replace 不再询问谓词——没有可动画的
    // DOM 变化）。
    expect(infos.map(({action}) => action)).toEqual(['replace']);

    await act(async () => {
      fireEvent.click(screen.getByText('GoPage'));
    });
    await flush();
    // push 被拒绝：直接通知，视图已更新，无动画。
    expect(infos.map(({action}) => action)).toEqual(['replace', 'push']);
    expect(calls).toHaveLength(0);
    expect(screen.getByText('Page')).toBeDefined();

    await act(async () => {
      history.back();
    });
    await flush();
    // pop 通过：探测 + pop 过渡，types 带方向 'pop'。随后的窗口同步
    // replace 通知被截帧保护吞掉（谓词不再被问，视图由过渡回调统一
    // 提交）。
    expect(calls).toHaveLength(2);
    expect(calls[1].types).toEqual(['pop']);
    expect(infos.map(({action}) => action)).toEqual(['replace', 'push', 'pop']);
    // update 未驱动，视图停在旧帧。
    expect(screen.getByText('Page')).toBeDefined();
    act(() => {
      calls[1].update();
    });
    expect(screen.getByText('Home')).toBeDefined();

    // info 三字段准确：push 与 pop 的方向、to/from 各自对应导航两端。
    const push = infos[1]!;
    expect(push.action).toBe('push');
    expect(push.to.pathname).toBe('/page');
    expect(push.from.pathname).toBe('/');
    const pop = infos[2]!;
    expect(pop.action).toBe('pop');
    expect(pop.to.pathname).toBe('/');
    expect(pop.from.pathname).toBe('/page');
  });

  it('should navigate and render normally without the View Transitions API', async () => {
    // jsdom 默认没有 startViewTransition（afterEach 已确保无残留 mock）。
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    render(
      <Router router={router} viewTransition>
        <View />
      </Router>
    );
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByText('GoPage'));
    });
    await flush();
    // 零成本降级：push 照常导航、渲染，无异常。
    expect(screen.getByText('Page')).toBeDefined();
    expect(screen.getByText('page-data')).toBeDefined();

    await act(async () => {
      history.back();
    });
    await flush();
    // POP 快照恢复同样照常。
    expect(screen.getByText('Home')).toBeDefined();
  });

  it('should fall back to the callback signature when types are unsupported', async () => {
    // 模拟旧签名实现（Chrome 111-128 / Safari 18-18.1 / 无 types 的
    // Firefox）：只接受函数参数，options 对象在 WebIDL 参数转换阶段
    // 同步抛出 TypeError。
    const updates: Array<() => void> = [];
    document.startViewTransition = ((arg: unknown) => {
      if (typeof arg !== 'function') throw new TypeError('not a function');
      updates.push(arg as () => void);
      return {skipTransition() {}};
    }) as typeof document.startViewTransition;

    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    render(
      <Router router={router} viewTransition>
        <View />
      </Router>
    );
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByText('GoPage'));
    });
    await flush();
    // 探测调用抛错被吞掉；正式调用降级为 callback 形态（无方向感）。
    expect(updates).toHaveLength(1);
    expect(screen.getByText('Home')).toBeDefined();

    act(() => {
      updates[0]();
    });
    expect(screen.getByText('Page')).toBeDefined();
  });

  describe('× ScrollRestoration', () => {
    function currentView() {
      if (screen.queryByText('Page')) return 'Page';
      if (screen.queryByText('Home')) return 'Home';
      return 'none';
    }

    // 缺陷 A 回归（VT 路径）：pop 动画打开期间 gate 持旧帧，滚动恢复必须
    // 等过渡回调提交落地视图之后——scrollTo 落在旧文档上会被其高度钳制
    // （真机：旧文章页 docHeight=720 钳掉 scrollTo(0,1011)）。
    it('should restore the scroll after the gated view commits (VT path)', async () => {
      const calls = installStartViewTransition();
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(((
        x: number,
        y: number
      ) => {
        window.scrollX = typeof x === 'number' ? x : 0;
        window.scrollY = y ?? 0;
      }) as typeof window.scrollTo);
      const history = createMemoryHistory({initialEntries: ['/']});
      const router = createRouter(routes, history);
      render(
        <Router
          router={router}
          viewTransition={({action}) => action !== 'replace'}
        >
          <ScrollRestoration />
          <View />
        </Router>
      );
      await flush();
      expect(screen.getByText('Home')).toBeDefined();
      // 用户在 '/' 深处滚到 1011（离开时被保存为该条目偏移）。
      window.scrollTo(0, 1011);
      expect(window.scrollY).toBe(1011);

      // push 动画：驱动 update 落帧（push 置顶的 scrollTo 同样发生在
      // 提交之后）。
      await act(async () => {
        fireEvent.click(screen.getByText('GoPage'));
      });
      await flush();
      expect(calls).toHaveLength(2);
      act(() => {
        calls[1].update();
      });
      expect(screen.getByText('Page')).toBeDefined();
      scrollTo.mockClear();

      // 返回：pop 动画打开，update 未驱动 = gate 持旧帧期间。
      await act(async () => {
        history.back();
      });
      await flush();
      expect(calls).toHaveLength(3);
      expect(calls[2].types).toEqual(['pop']);
      // 恢复被挂起：scrollTo 尚未发生。
      expect(scrollTo).not.toHaveBeenCalled();

      // 驱动过渡回调：落地视图提交完成后，恢复才落在真实布局上。
      act(() => {
        calls[2].update();
      });
      expect(screen.getByText('Home')).toBeDefined();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith(0, 1011);
    });

    // 缺陷 B 回归（非 VT 路径的保存侧）：同步提交使文档先收缩，浏览器
    // 自动钳制 scrollY——保存读取必须发生在首个历史事件上（提交之前），
    // 读到的才不是钳制后的坏值。
    it('should read the leaving scroll before the view commits (save side)', async () => {
      const scrollCalls: Array<{x: number; y: number; view: string}> = [];
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(((
        x: number,
        y: number
      ) => {
        scrollCalls.push({x, y, view: currentView()});
        window.scrollX = typeof x === 'number' ? x : 0;
        window.scrollY = y ?? 0;
      }) as typeof window.scrollTo);
      // scrollY 读取探针：记录每次读取瞬间挂载的视图。
      const reads: Array<{y: number; view: string}> = [];
      let scrollY = 0;
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        get: () => {
          const view = currentView();
          reads.push({y: scrollY, view});
          return scrollY;
        },
        set: (v: number) => {
          scrollY = v;
        }
      });
      try {
        const history = createMemoryHistory({initialEntries: ['/']});
        const router = createRouter(routes, history);
        render(
          <Router router={router}>
            <ScrollRestoration />
            <View />
          </Router>
        );
        await flush();
        expect(screen.getByText('Home')).toBeDefined();
        // 用户在 '/' 上滚到 1011。
        window.scrollTo(0, 1011);

        // push：离开 '/' 的保存读取发生在首个历史事件上（提交之前）。
        await act(async () => {
          fireEvent.click(screen.getByText('GoPage'));
        });
        await flush();
        expect(screen.getByText('Page')).toBeDefined();

        // 返回：恢复 1011 必须落在提交后的 Home 布局上。
        await act(async () => {
          history.back();
        });
        await flush();

        // 保存读取发生在提交之前：push 离开 '/' 时读到 1011 的瞬间文档
        // 还是 Home（旧实现把读取推迟到提交后，会看到 Page 且读到被
        // 钳制的坏值）。
        const saveReads = reads.filter((r) => r.y === 1011);
        expect(saveReads.length).toBeGreaterThan(0);
        expect(saveReads.every((r) => r.view === 'Home')).toBe(true);
        // 恢复发生在提交之后：back 的 scrollTo(0,1011) 落在 Home 上，
        // 而非提交前的 Page 旧文档。
        expect(scrollCalls.at(-1)).toMatchObject({x: 0, y: 1011});
        expect(currentView()).toBe('Home');
        expect(scrollTo.mock.calls.at(-1)).toEqual([0, 1011]);
      } finally {
        delete (window as {scrollY?: number}).scrollY;
        scrollTo.mockRestore();
      }
    });
  });

  it('should animate replace with empty types when the predicate opts in', async () => {
    const calls = installStartViewTransition();
    const history = createMemoryHistory({initialEntries: ['/']});
    const router = createRouter(routes, history);
    render(
      <Router router={router} viewTransition={() => true}>
        <View />
      </Router>
    );
    await flush();
    // 冷启动的预热 replace 被放行动画（探测 + 过渡）；其后的惰性重解析
    // replace 通知被截帧保护吞掉，由过渡回调统一提交。replace 的 types
    // 为空数组（默认 root 过渡，不带方向）。
    expect(calls).toHaveLength(2);
    expect(calls[1].types).toEqual([]);
    act(() => {
      calls[1].update();
    });
    expect(screen.getByText('Home')).toBeDefined();
  });
});
