import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, act, fireEvent} from '@testing-library/react';
import React from 'react';
import {commit, create, resolve, setOptions} from '@native-router/core';
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

// Mock the core module
vi.mock('@native-router/core', () => ({
  toLocation: vi.fn(() => ({pathname: '/test'})),
  createHref: vi.fn(() => '/test'),
  resolve: vi.fn(async () => ({default: null})),
  commit: vi.fn(),
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
      expect(resolve).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
      });
      expect(resolve).toHaveBeenCalledTimes(1);
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
      });
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should prefetch on focus (intent default)', async () => {
      renderLink({to: '/a'});
      await act(async () => {
        fireEvent.focus(screen.getByTestId('target'));
      });
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should clear the stale error and view when `to` changes', async () => {
      vi.mocked(resolve).mockRejectedValueOnce(new Error('old target failed'));
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
      expect(resolve).toHaveBeenCalledTimes(2);
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should not produce an unhandledrejection when a failed prefetch is never clicked', async () => {
      const unhandled: unknown[] = [];
      const onProcessRejection = (reason: unknown) => unhandled.push(reason);
      const onWindowRejection = (e: Event) => unhandled.push(e);
      process.on('unhandledRejection', onProcessRejection);
      window.addEventListener('unhandledrejection', onWindowRejection);
      try {
        vi.mocked(resolve).mockRejectedValueOnce(new Error('prefetch boom'));
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
      vi.mocked(resolve).mockRejectedValueOnce(
        new Error('first attempt fails')
      );
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
      expect(resolve).toHaveBeenCalledTimes(2);
      expect(commit).toHaveBeenCalledTimes(1);
      const committedTask = vi.mocked(commit).mock.calls[0]?.[1];
      await expect(committedTask).resolves.toEqual({default: null});
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should prefetch immediately on mount when prefetch="render"', async () => {
      renderLink({to: '/a', prefetch: 'render'});
      expect(resolve).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('view')).toBeDefined();
    });

    it('should not prefetch when prefetch="none" until clicked', async () => {
      renderLink({to: '/a', prefetch: 'none'});
      expect(resolve).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.mouseEnter(screen.getByTestId('target'));
        fireEvent.focus(screen.getByTestId('target'));
      });
      expect(resolve).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(screen.getByTestId('target'));
      });
      expect(resolve).toHaveBeenCalledTimes(1);
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
        expect(resolve).not.toHaveBeenCalled();

        const observer = observers[0];
        await act(async () => {
          observer?.callback(
            [{isIntersecting: true} as IntersectionObserverEntry],
            observer as unknown as IntersectionObserver
          );
        });
        expect(resolve).toHaveBeenCalledTimes(1);
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
        expect(resolve).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('Router component', () => {
    it('should render the current view directly when children is omitted', () => {
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
          index: 0,
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
          index: 1,
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
          index: 2,
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
      location: {pathname: '/page/child'}
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
          index: 0,
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
          index: 0,
          params: {id: '7'},
          route: {path: '/users/:id', name: 'users', component: () => Users}
        },
        {
          path: '/posts/:postId',
          index: 1,
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
          index: 0,
          params: {id: 'shallow'},
          route: {path: '/:id', component: () => Parent}
        },
        {
          path: '/:id/deep',
          index: 1,
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
