import {describe, it, expect, expectTypeOf, vi, beforeEach} from 'vitest';
import {render, screen, act, fireEvent} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import React from 'react';
import {
  commit,
  create,
  navigate,
  preload,
  setOptions
} from '@native-router/core';
import type {Matched, RouterInstance} from '@native-router/core';

import {
  HashRouter,
  HistoryRouter,
  Link,
  MemoryRouter,
  PrefetchLink,
  Router,
  View,
  useData,
  useLoading,
  useMatched,
  usePrefetch,
  useRouter
} from '../src/index';
import {LoadingContext} from '../src/context';
import type {LoadStatus, Context, LinkProps, Route} from '../src/types';
import defaultResolveView, {
  createHydrateResolveView,
  getViewData,
  resolveViewServer
} from '../src/resolve-view';

const {viewListeners} = vi.hoisted(() => ({
  viewListeners: [] as Array<(view: unknown) => void>
}));

// Mock the core module: pure helpers(search parsing, href creation, ...)
// come from the real core, only the history-coupled functions are stubbed.
vi.mock('@native-router/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@native-router/core')>()),
  toLocation: vi.fn(() => ({pathname: '/test'})),
  createHref: vi.fn(() => '/test'),
  resolve: vi.fn(async () => ({default: null})),
  preload: vi.fn(async () => ({
    location: {pathname: '/test'},
    task: Promise.resolve({default: null})
  })),
  commit: vi.fn(),
  commitReplace: vi.fn(),
  navigate: vi.fn(),
  create: vi.fn(
    (
      _routes: unknown,
      history: unknown,
      resolveView: unknown,
      options: any
    ) => ({
      viewStack: [options?.currentView ?? null],
      history,
      resolveView
    })
  ),
  getCurrentView: vi.fn((router: any) => router.viewStack[0]),
  mergeMatchedParams: vi.fn((matched: any[], index?: number) =>
    Object.assign(
      {},
      ...(index === undefined ? matched : matched.slice(0, index + 1)).map(
        (m) => m.params
      )
    )
  ),
  listen: vi.fn((_router: any, onViewChange: (view: unknown) => void) => {
    viewListeners.push(onViewChange);
    return () => undefined;
  }),
  setOptions: vi.fn((router: any, options: any) =>
    Object.assign(router, options)
  )
}));

function createMockRouter(viewStack: unknown[] = [null]) {
  // viewTransition 订阅会读取 router.history.location（from/to 追踪），
  // mock 路由也带一个真实内存 history。
  return {
    viewStack,
    history: createMemoryHistory()
  } as unknown as RouterInstance<Route, React.ReactNode>;
}

describe('Router', () => {
  beforeEach(() => {
    viewListeners.length = 0;
    vi.clearAllMocks();
  });

  describe('exports', () => {
    it('should export Link', async () => {
      const {Link: LinkComponent} = await import('../src/index');
      expect(LinkComponent).toBeDefined();
    });

    it('should export View', () => {
      expect(View).toBeDefined();
    });

    it('should export useData', () => {
      expect(useData).toBeDefined();
    });

    it('should export useSearch', async () => {
      const {useSearch} = await import('../src/index');
      expect(useSearch).toBeDefined();
    });

    it('should export useLoading', () => {
      expect(useLoading).toBeDefined();
    });

    it('should export useMatched', () => {
      expect(useMatched).toBeDefined();
    });
  });

  describe('View', () => {
    it('should be a component', () => {
      expect(typeof View).toBe('function');
    });
  });

  describe('Link', () => {
    it('should Render with children', () => {
      render(
        <Router router={createMockRouter()}>
          <Link to="/test">
            <span>Child</span>
          </Link>
        </Router>
      );
      expect(screen.getByText('Child')).toBeDefined();
    });
  });

  describe('PrefetchLink', () => {
    function PrefetchProbe() {
      const {loading, error, view} = usePrefetch();
      let status = 'idle';
      if (error) status = `error:${error.message}`;
      else if (view !== undefined) status = 'view';
      else if (loading) status = 'loading';
      return <span data-testid="status">{status}</span>;
    }

    function renderLink(initialProps: LinkProps) {
      const router = createMockRouter();
      const renderTree = (props: LinkProps) => (
        <Router router={router}>
          <PrefetchLink data-testid="target" {...props}>
            <PrefetchProbe />
          </PrefetchLink>
        </Router>
      );
      const view = render(renderTree(initialProps));
      return {
        ...view,
        rerenderLink: (props: LinkProps) => view.rerender(renderTree(props))
      };
    }

    function stubIntersectionObserver() {
      const observers: Array<{
        callback: IntersectionObserverCallback;
        el?: Element;
        disconnected: boolean;
      }> = [];
      class FakeIntersectionObserver {
        callback: IntersectionObserverCallback;

        el?: Element;

        disconnected = false;

        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
          observers.push(this);
        }

        observe(el: Element) {
          this.el = el;
        }

        disconnect() {
          this.disconnected = true;
        }
      }
      vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
      return observers;
    }

    beforeEach(() => {
      vi.clearAllMocks();
      // The real commit() returns a promise; the module mock returns undefined.
      vi.mocked(commit).mockResolvedValue(undefined);
    });

    it('should prefetch on hover (intent default) without duplicating tasks', async () => {
      renderLink({to: '/a'});
      expect(preload).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
      });
      expect(preload).toHaveBeenCalledTimes(1);
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
      });
      expect(preload).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should prefetch on focus (intent default)', async () => {
      renderLink({to: '/a'});
      await act(async () => {
        fireEvent.focus(screen.getByTestId('target'));
      });
      expect(preload).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should clear the stale error and view when `to` changes', async () => {
      vi.mocked(preload).mockRejectedValueOnce(new Error('old target failed'));
      const {rerenderLink} = renderLink({to: '/a'});
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
      });
      expect(await screen.findByText('error:old target failed')).toBeDefined();

      rerenderLink({to: '/b'});
      expect(screen.getByTestId('status').textContent).toBe('idle');

      // The new target prefetches from scratch and the stale error is gone.
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
      });
      expect(preload).toHaveBeenCalledTimes(2);
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should not produce an unhandledrejection when a failed prefetch is never clicked', async () => {
      const unhandled: unknown[] = [];
      const onProcessRejection = (reason: unknown) => unhandled.push(reason);
      const onWindowRejection = (e: Event) => unhandled.push(e);
      process.on('unhandledRejection', onProcessRejection);
      window.addEventListener('unhandledrejection', onWindowRejection);
      try {
        vi.mocked(preload).mockRejectedValueOnce(new Error('prefetch boom'));
        renderLink({to: '/a'});
        await act(async () => {
          fireEvent.mouseEnter(screen.getByTestId('target'));
        });
        // The rejection really happened and reached the error state…
        expect(await screen.findByText('error:prefetch boom')).toBeDefined();
        // …but never leaked as a global unhandled rejection.
        await act(async () => {
          await new Promise((done) => {
            setTimeout(done, 20);
          });
        });
        expect(unhandled).toEqual([]);
      } finally {
        process.off('unhandledRejection', onProcessRejection);
        window.removeEventListener('unhandledrejection', onWindowRejection);
      }
    });

    it('should re-resolve and commit when clicking after a failed prefetch', async () => {
      // The entry resolves but its task rejects: the derived chain must
      // still surface the failure and mark the entry as uncommittable.
      vi.mocked(preload).mockResolvedValueOnce({
        location: {pathname: '/a', search: '', hash: ''},
        task: Promise.reject(new Error('first attempt fails'))
      });
      renderLink({to: '/a'});
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
      });
      expect(
        await screen.findByText('error:first attempt fails')
      ).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByTestId('target'));
      });
      expect(preload).toHaveBeenCalledTimes(2);
      expect(commit).toHaveBeenCalledTimes(1);
      const [committedTask, committedLocation] = vi
        .mocked(commit)
        .mock.calls[0]!.slice(1);
      await expect(committedTask).resolves.toEqual({default: null});
      // The terminal location of the re-resolved entry is committed.
      expect(committedLocation).toEqual({pathname: '/test'});
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should prefetch immediately on mount when prefetch="render"', async () => {
      renderLink({to: '/a', prefetch: 'render'});
      expect(preload).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should not prefetch when prefetch="none" until clicked', async () => {
      renderLink({to: '/a', prefetch: 'none'});
      expect(preload).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
        fireEvent.focus(screen.getByTestId('target'));
      });
      expect(preload).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(screen.getByTestId('target'));
      });
      expect(preload).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should prefetch when scrolled into view with prefetch="viewport"', async () => {
      const observers = stubIntersectionObserver();
      try {
        renderLink({to: '/a', prefetch: 'viewport'});
        expect(observers.length).toBe(1);
        expect(observers[0]?.el).toBe(screen.getByTestId('target'));
        // Hover is not an intent signal in viewport mode.
        await act(async () => {
          fireEvent.mouseEnter(screen.getByTestId('target'));
        });
        expect(preload).not.toHaveBeenCalled();

        const observer = observers[0];
        // A non-intersecting report must not trigger anything.
        await act(async () => {
          observer?.callback(
            [{isIntersecting: false} as IntersectionObserverEntry],
            observer as unknown as IntersectionObserver
          );
        });
        expect(preload).not.toHaveBeenCalled();

        await act(async () => {
          observer?.callback(
            [{isIntersecting: true} as IntersectionObserverEntry],
            observer as unknown as IntersectionObserver
          );
        });
        expect(preload).toHaveBeenCalledTimes(1);
        expect(observer?.disconnected).toBe(true);
        expect(await screen.findByText('view')).toBeDefined();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('should disconnect the IntersectionObserver on unmount', () => {
      const observers = stubIntersectionObserver();
      try {
        const {unmount} = renderLink({to: '/a', prefetch: 'viewport'});
        expect(observers[0]?.disconnected).toBe(false);
        unmount();
        expect(observers[0]?.disconnected).toBe(true);
        expect(preload).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('should stay idle on viewport mode when IntersectionObserver is missing', () => {
      // jsdom implements no IntersectionObserver and none is stubbed here,
      // so the viewport effect must bail out instead of throwing.
      renderLink({to: '/a', prefetch: 'viewport'});
      expect(screen.getByTestId('status').textContent).toBe('idle');
      expect(preload).not.toHaveBeenCalled();
    });

    it('should let modified clicks keep the browser default without committing', () => {
      renderLink({to: '/a'});
      expect(
        fireEvent.click(screen.getByTestId('target'), {ctrlKey: true})
      ).toBe(true);
      expect(preload).not.toHaveBeenCalled();
      expect(commit).not.toHaveBeenCalled();
    });

    it('should swallow a commit failure and let the next intent prefetch again', async () => {
      vi.mocked(commit).mockRejectedValueOnce(new Error('commit boom'));
      renderLink({to: '/a'});
      await act(async () => {
        fireEvent.click(screen.getByTestId('target'));
      });
      expect(commit).toHaveBeenCalledTimes(1);
      // The finally block cleared the stored entry, so hover resolves the
      // target again instead of reusing the failed commit's entry.
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
      });
      expect(preload).toHaveBeenCalledTimes(2);
      expect(await screen.findByText('view')).toBeDefined();
    });
  });

  describe('Router component', () => {
    it('should render the current view directly when children is omitted', () => {
      // eslint-disable-next-line @eslint-react/no-missing-key -- single-element mock array, not a rendered list
      render(<Router router={createMockRouter([<b>direct view</b>])} />);
      expect(screen.getByText('direct view')).toBeDefined();
    });

    it('should re-render the view when the router view changes', async () => {
      render(
        <Router router={createMockRouter(['view1'])}>
          <View />
        </Router>
      );
      expect(screen.getByText('view1')).toBeDefined();
      expect(viewListeners.length).toBeGreaterThan(0);
      await act(async () => {
        viewListeners[0]('view2');
      });
      expect(screen.getByText('view2')).toBeDefined();
    });

    it('should render nothing while pending with no resolving match to walk', () => {
      // A pending cold start whose router exposes no `resolving` location
      // (and so no matched chain): the pending view resolves to null.
      const router = createMockRouter([null]);
      const loading: LoadStatus = {key: 1, status: 'pending'};
      const {container} = render(
        <LoadingContext.Provider value={loading}>
          <Router router={router} />
        </LoadingContext.Provider>
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('useNewRouter', () => {
    it('should not call setOptions during render in StrictMode', () => {
      const setOptionsCallsDuringRender: number[] = [];
      function Probe() {
        setOptionsCallsDuringRender.push(
          vi.mocked(setOptions).mock.calls.length
        );
        return null;
      }
      render(
        <React.StrictMode>
          <MemoryRouter routes={[]}>
            <Probe />
          </MemoryRouter>
        </React.StrictMode>
      );
      // The probe renders after its parent router component in every render
      // pass, so any non-zero entry means setOptions mutated during render.
      expect(setOptionsCallsDuringRender.length).toBeGreaterThan(0);
      expect(setOptionsCallsDuringRender.every((calls) => calls === 0)).toBe(
        true
      );
      // Options are still applied, via the effect.
      expect(setOptions).toHaveBeenCalled();
    });

    it('should not recreate the router when only option identities change', () => {
      const routes: Route[] = [];
      const {rerender} = render(
        <MemoryRouter routes={routes} errorHandler={() => null}>
          <span>child</span>
        </MemoryRouter>
      );
      rerender(
        <MemoryRouter routes={routes} errorHandler={() => null}>
          <span>child</span>
        </MemoryRouter>
      );
      expect(create).toHaveBeenCalledTimes(1);

      // `baseUrl` is a tracked option: changing it still recreates the router.
      rerender(
        <MemoryRouter routes={routes} baseUrl="/base">
          <span>child</span>
        </MemoryRouter>
      );
      expect(create).toHaveBeenCalledTimes(2);
    });

    it('should create browser-history and hash-history routers', () => {
      const first = render(
        <HistoryRouter routes={[]}>
          <span>history</span>
        </HistoryRouter>
      );
      expect(screen.getByText('history')).toBeDefined();
      expect(create).toHaveBeenCalledTimes(1);

      first.unmount();
      render(
        <HashRouter routes={[]}>
          <span>hash</span>
        </HashRouter>
      );
      expect(screen.getByText('hash')).toBeDefined();
      expect(create).toHaveBeenCalledTimes(2);
    });
  });

  describe('useRouter', () => {
    it('should throw a helpful error when used outside a Router', () => {
      function Outside() {
        useRouter();
        return null;
      }
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      expect(() => render(<Outside />)).toThrow(
        'useRouter() must be used within a <Router> component'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('resolve-view errorComponent', () => {
    const failure = new Error('child data failure');

    function Layout() {
      return (
        <section>
          layout <View />
        </section>
      );
    }

    function Page() {
      return <span>page:{String(useData())}</span>;
    }

    function GrandChild() {
      return <i>grandchild</i>;
    }

    function RouteError({error, ctx}: {error: Error; ctx: Context<Route>}) {
      return (
        <strong>
          route-error:{error.message}:{ctx.index}
        </strong>
      );
    }

    function createMatched(
      errorComponent?: Route['errorComponent']
    ): Matched<Route>[] {
      return [
        {
          path: '/',
          params: {},
          route: {
            path: '/',
            name: 'root',
            data: () => 'root-data',
            component: () => Layout
          }
        },
        {
          path: '/page',
          params: {},
          route: {
            path: '/page',
            data: () => Promise.reject(failure),
            component: () => Page,
            errorComponent
          }
        },
        {
          path: '/page/child',
          params: {},
          route: {
            path: '/page/child',
            data: () => 'grand-data',
            component: () => GrandChild
          }
        }
      ];
    }

    const resolveCtx = {
      router: createMockRouter(),
      location: {pathname: '/page/child', search: '', hash: ''}
    };

    it('should render the failing level errorComponent while the parent layout stays', async () => {
      const view = await defaultResolveView(
        createMatched(RouteError),
        resolveCtx
      );
      const {container} = render(view);
      expect(container.querySelector('section')).toBeDefined();
      expect(container.textContent).toContain('layout');
      expect(container.textContent).toContain(
        'route-error:child data failure:1'
      );
      // Deeper matched levels are naturally not rendered by the error view.
      expect(container.textContent).not.toContain('grandchild');
    });

    it('should fall back to the errorComponent when the component loader rejects', async () => {
      const matched: Matched<Route>[] = [
        {
          path: '/lazy',
          params: {},
          route: {
            path: '/lazy',
            component: () => Promise.reject(new Error('load failure')),
            errorComponent: RouteError
          }
        }
      ];
      const view = await defaultResolveView(matched, resolveCtx);
      const {container} = render(view);
      expect(container.textContent).toContain('route-error:load failure:0');
    });

    it('should bubble up to the global errorHandler when no errorComponent is configured', async () => {
      const errorHandler = vi.fn((e: Error) => `handled:${e.message}`);
      const result = await defaultResolveView(
        createMatched(undefined),
        resolveCtx
      ).catch(errorHandler);
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(failure);
      expect(result).toBe('handled:child data failure');
    });

    it('should intercept failures in resolveViewServer and keep the view data aligned', async () => {
      const view = await resolveViewServer(
        createMatched(RouteError),
        resolveCtx
      );
      const {container} = render(view);
      expect(container.querySelector('section')).toBeDefined();
      expect(container.textContent).toContain(
        'route-error:child data failure:1'
      );

      const data = getViewData(view)!;
      expect(data).toHaveLength(3);
      expect(data[0]).toBe('root-data');
      expect(data[1]).toBeUndefined();
      expect(data[2]).toBe('grand-data');
    });

    it('should not crash when hydrating a server view that contains a failed level', async () => {
      const serverView = await resolveViewServer(
        createMatched(RouteError),
        resolveCtx
      );
      const hydrateResolveView = createHydrateResolveView(
        getViewData(serverView)!
      );
      const view = await hydrateResolveView(
        createMatched(RouteError),
        resolveCtx
      );
      const {container} = render(view);
      expect(container.querySelector('section')).toBeDefined();
      expect(container.textContent).toContain('layout');
    });

    it('should expose accumulated parent params to nested level components', async () => {
      function Users() {
        const {params} = useMatched();
        return (
          <section>
            users:{params.id} <View />
          </section>
        );
      }
      function Post() {
        const {params} = useMatched();
        return (
          <span>
            post:{params.id}:{params.postId}
          </span>
        );
      }
      const matched: Matched<Route>[] = [
        {
          path: '/users/:id',
          params: {id: '7'},
          route: {path: '/users/:id', name: 'users', component: () => Users}
        },
        {
          path: '/posts/:postId',
          params: {postId: '9'},
          route: {path: '/posts/:postId', component: () => Post}
        }
      ];
      const view = await defaultResolveView(matched, resolveCtx);
      const {container} = render(view);
      expect(container.querySelector('section')).toBeDefined();
      // The child level sees its own params plus the parent's.
      expect(container.textContent).toContain('users:7');
      expect(container.textContent).toContain('post:7:9');
    });

    it('should let deeper levels override same-name params of shallower ones', async () => {
      function Parent() {
        const {params} = useMatched();
        return (
          <p>
            parent:{params.id} <View />
          </p>
        );
      }
      function Child() {
        const {params} = useMatched();
        return <b>child:{params.id}</b>;
      }
      const matched: Matched<Route>[] = [
        {
          path: '/:id',
          params: {id: 'shallow'},
          route: {path: '/:id', component: () => Parent}
        },
        {
          path: '/:id/deep',
          params: {id: 'deep'},
          route: {path: '/:id/deep', component: () => Child}
        }
      ];
      const view = await defaultResolveView(matched, resolveCtx);
      const {container} = render(view);
      expect(container.textContent).toContain('parent:shallow');
      expect(container.textContent).toContain('child:deep');
    });

    it('should render the child view for a level without its own component', async () => {
      const matched: Matched<Route>[] = [
        {path: '/users', params: {}, route: {path: '/users'}},
        {
          path: '/users/posts',
          params: {},
          route: {path: '/users/posts', component: () => GrandChild}
        }
      ];
      const view = await defaultResolveView(matched, resolveCtx);
      const {container} = render(view);
      // The component-less parent level renders <View/>, which resolves to
      // the nested child view.
      expect(container.textContent).toContain('grandchild');
    });

    it('should unwrap a component loader returning a module namespace', async () => {
      const matched: Matched<Route>[] = [
        {
          path: '/lazy',
          params: {},
          route: {
            path: '/lazy',
            // The dynamic-import shape: the module's `default` export is
            // the component, not the module itself.
            component: () => Promise.resolve({default: GrandChild})
          }
        }
      ];
      const view = await defaultResolveView(matched, resolveCtx);
      const {container} = render(view);
      expect(container.textContent).toContain('grandchild');
    });
  });
});

describe('Link navigation guard', () => {
  type ClickInit = {
    button?: number;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  };

  function renderLink(props: LinkProps = {to: '/test'}) {
    render(
      <Router router={createMockRouter()}>
        <Link {...props}>Go</Link>
      </Router>
    );
    return screen.getByText('Go');
  }

  // fireEvent returns the value of dispatchEvent, which is `false` once
  // preventDefault is called. So `true` proves the browser default behavior
  // was left untouched by the guard.
  function expectBrowserDefault(el: Element, init?: ClickInit) {
    expect(fireEvent.click(el, init)).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // The real navigate() returns a promise; the module mock returns undefined.
    vi.mocked(navigate).mockReset().mockResolvedValue(undefined);
  });

  it('should let ctrl+click open in a new tab', () => {
    expectBrowserDefault(renderLink(), {ctrlKey: true});
  });

  it('should let meta+click open in a new tab', () => {
    expectBrowserDefault(renderLink(), {metaKey: true});
  });

  it('should let shift+click open in a new window', () => {
    expectBrowserDefault(renderLink(), {shiftKey: true});
  });

  it('should let alt+click download the target', () => {
    expectBrowserDefault(renderLink(), {altKey: true});
  });

  it('should let middle clicks (button=1) open a new tab', () => {
    expectBrowserDefault(renderLink(), {button: 1});
  });

  it('should not intercept links targeting another browsing context', () => {
    expectBrowserDefault(renderLink({to: '/test', target: '_blank'}));
  });

  it('should not intercept links marked rel="external"', () => {
    expectBrowserDefault(renderLink({to: '/test', rel: 'external'}));
  });

  it('should navigate on a plain left click', () => {
    const el = renderLink();
    // preventDefault is called for in-app navigation.
    expect(fireEvent.click(el)).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(expect.anything(), '/test');
  });

  it('should release the click lock after navigate rejects', async () => {
    vi.mocked(navigate).mockRejectedValueOnce(new Error('navigate boom'));
    const el = renderLink();

    await act(async () => {
      fireEvent.click(el);
    });
    expect(navigate).toHaveBeenCalledTimes(1);

    // The rejection is swallowed (no unhandled rejection) and the lock is
    // released, so a second click navigates again.
    await act(async () => {
      fireEvent.click(el);
    });
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('should ignore a second click while the previous navigate is pending', async () => {
    let release!: () => void;
    vi.mocked(navigate).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    const el = renderLink();

    fireEvent.click(el);
    // The first navigate is still pending: the lock swallows this click.
    fireEvent.click(el);
    expect(navigate).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
    // The lock was released by the finally block, so clicks work again.
    fireEvent.click(el);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});

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

describe('Link as polymorphism', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The real navigate() returns a promise; the module mock returns undefined.
    vi.mocked(navigate).mockReset().mockResolvedValue(undefined);
  });

  function renderAsLink(extra?: Record<string, unknown>) {
    render(
      <Router router={createMockRouter()}>
        {/* The extra props are test-local; cast keeps the helper call sites terse. */}
        <Link as={PillLink} to="/test" variant="primary" {...(extra as any)}>
          Go
        </Link>
      </Router>
    );
    return screen.getByText('Go') as HTMLAnchorElement;
  }

  it('should render through the as component with the injected href and flattened props', () => {
    const el = renderAsLink({tone: 'strong'});
    expect(el.getAttribute('data-variant')).toBe('primary');
    expect(el.getAttribute('data-tone')).toBe('strong');
    // href is injected by Link (the mocked createHref returns '/test').
    expect(el.getAttribute('href')).toBe('/test');
  });

  it('should navigate in-app on a plain click through the as component', () => {
    const el = renderAsLink();
    // preventDefault is called for in-app navigation.
    expect(fireEvent.click(el)).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(expect.anything(), '/test');
  });

  it('should keep the browser default for modified clicks', () => {
    const el = renderAsLink();
    expect(fireEvent.click(el, {ctrlKey: true})).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should run the user onClick first with the same event', () => {
    const plain = vi.fn();
    const el = renderAsLink({onClick: plain});
    fireEvent.click(el);
    // Same event, same args — the user handler strictly before navigate —
    // and the navigation still happens.
    expect(plain).toHaveBeenCalledWith(
      expect.objectContaining({type: 'click'})
    );
    expect(plain.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(navigate).mock.invocationCallOrder[0]
    );
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('should let a preventDefaulted user onClick veto the navigation', () => {
    const veto = vi.fn((e: {preventDefault: () => void}) => {
      e.preventDefault();
    });
    const el = renderAsLink({onClick: veto});
    fireEvent.click(el);
    expect(veto).toHaveBeenCalledTimes(1);
    // A preventDefaulted user onClick suppresses the navigation entirely.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should spread asProps after the base props and keep the injected keys managed', () => {
    const el = renderAsLink({
      title: 'from-base',
      asProps: {title: 'from-asProps', href: '/overridden'}
    });
    // asProps wins over the same base prop(explicit override)...
    expect(el.getAttribute('title')).toBe('from-asProps');
    // ...but href stays managed by the link.
    expect(el.getAttribute('href')).toBe('/test');
  });

  it('should forward the ref to the as component element', () => {
    const nodes: (HTMLAnchorElement | null)[] = [];
    render(
      <Router router={createMockRouter()}>
        <Link
          as={PillLink}
          to="/test"
          variant="primary"
          ref={(node) => {
            nodes.push(node);
          }}
        >
          Go
        </Link>
      </Router>
    );
    expect(nodes.at(-1)).toBeInstanceOf(HTMLAnchorElement);
    expect(nodes.at(-1)!.dataset.variant).toBe('primary');
  });

  it('should keep PrefetchLink strategies working through the as component', async () => {
    vi.mocked(commit).mockResolvedValue(undefined);
    render(
      <Router router={createMockRouter()}>
        <PrefetchLink
          as={PillLink}
          to="/test"
          variant="ghost"
          prefetch="render"
          title="from-base"
          asProps={{title: 'from-asProps'}}
        >
          Go
        </PrefetchLink>
      </Router>
    );
    // 'render' prefetched on mount without any interaction.
    expect(preload).toHaveBeenCalledTimes(1);
    const el = screen.getByText('Go') as HTMLAnchorElement;
    expect(el.getAttribute('data-variant')).toBe('ghost');
    // PrefetchLink has its own spread sequence(rest, intent handlers,
    // asProps, managed keys) — the asProps override wins over the base
    // value while href stays managed by the link.
    expect(el.getAttribute('title')).toBe('from-asProps');
    expect(el.getAttribute('href')).toBe('/test');
    await act(async () => {
      fireEvent.click(el);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe('Route path param types', () => {
  it('should type ctx.params of a required param path', () => {
    const route: Route<'/users/:id'> = {
      path: '/users/:id',
      data: ({params}) => {
        expectTypeOf(params).toEqualTypeOf<{id: string}>();
        expectTypeOf(params.id).toEqualTypeOf<string>();
        return params.id;
      }
    };
    expect(route.path).toBe('/users/:id');
  });

  it('should contribute no params for v6-era optional suffix syntax', () => {
    // core@1.5 locks path-to-regexp 8.4.2, whose matcher rejects `:page?`
    // at runtime; the types deliberately model no params for it either.
    const route: Route<'/list/:page?'> = {
      path: '/list/:page?',
      data: ({params}) => {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- v6 suffixes contribute nothing
        expectTypeOf(params).toEqualTypeOf<{}>();
        return '1';
      }
    };
    expect(route.path).toBe('/list/:page?');
  });

  it('should carry no concrete keys for a static path', () => {
    const route: Route<'/about'> = {
      path: '/about',
      component: ({params}) => {
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- asserts the params type carries no keys
        expectTypeOf(params).toEqualTypeOf<{}>();
        return () => null;
      }
    };
    expect(route.path).toBe('/about');
  });

  it('should stay compatible with non-generic Route usage', () => {
    const routes: Route[] = [
      {
        path: '/users/:id',
        data: ({params}) => String(params.id),
        children: [
          {path: '/users/:id/posts/:postId', data: ({params}) => params}
        ]
      }
    ];
    // A path-typed route stays assignable to the plain Route type...
    const typed: Route<'/users/:id'> = {
      path: '/users/:id',
      data: ({params}) => {
        expectTypeOf(params).toEqualTypeOf<{id: string}>();
        return params.id;
      }
    };
    routes.push(typed);
    // A plain Route keeps the legacy Record<string, string> params.
    const legacy: Route = {
      path: '/anything',
      data: ({params}) => {
        expectTypeOf(params).toEqualTypeOf<Record<string, string>>();
        return params.id;
      }
    };
    routes.push(legacy);
    expect(routes).toHaveLength(3);
  });

  it('should type component and errorComponent contexts too', () => {
    const route: Route<'/posts/:postId'> = {
      path: '/posts/:postId',
      component: ({params}) => {
        expectTypeOf(params).toEqualTypeOf<{postId: string}>();
        return () => null;
      },
      // errorComponent props are strictly contravariant, so its ctx keeps
      // the untyped params shape.
      errorComponent: ({ctx}) => {
        expectTypeOf(ctx.params).toEqualTypeOf<Record<string, string>>();
        return null;
      }
    };
    expect(route.path).toBe('/posts/:postId');
  });
});
