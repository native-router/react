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
import {describe, it, expect, expectTypeOf, vi, afterEach} from 'vitest';
import {render, screen, act, fireEvent} from '@testing-library/react';
import React from 'react';
import {createBrowserHistory, createMemoryHistory} from 'history';
import {
  SearchError,
  commitReplace,
  create,
  initHistoryStack,
  navigate,
  refresh,
  resolve,
  toLocation
} from '@native-router/core';
import type {Location, StandardSchemaV1} from '@native-router/core';
import {
  Link,
  MemoryRouter,
  NavLink,
  PrefetchLink,
  Router,
  ScrollRestoration,
  View,
  createRouter,
  defaultResolveView,
  useData,
  usePrefetch,
  useSearch,
  useSearchParams
} from '../src/index';
import type {Route} from '../src/types';

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
    render(
      <Router router={router}>
        <ScrollRestoration resetOnPush={resetOnPush} />
        <View />
        <nav>
          <Link to="/a">GoA</Link>
          <Link to="/b">GoB</Link>
        </nav>
      </Router>
    );
    return {history, router};
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
});
