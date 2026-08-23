import {describe, it, expect, expectTypeOf, vi, beforeEach} from 'vitest';
import {render, screen, act, fireEvent} from '@testing-library/react';
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
import defaultResolveView, {
  createHydrateResolveView,
  getViewData,
  resolveViewServer
} from '../src/resolve-view';
import type {Context, LinkProps, Route} from '../src/types';

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
  return {viewStack} as unknown as RouterInstance<Route, React.ReactNode>;
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

  it('should type ctx.params of an optional param path', () => {
    const route: Route<'/list/:page?'> = {
      path: '/list/:page?',
      data: ({params}) => {
        expectTypeOf(params).toEqualTypeOf<{page?: string}>();
        return params.page ?? '1';
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
