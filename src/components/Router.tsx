import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  History,
  createBrowserHistory,
  createHashHistory,
  createMemoryHistory,
  MemoryHistoryOptions
} from 'history';
import type {LoadStatus, Route} from '@@/types';
import {LoadingContext, PendingContext, ViewProvider} from '@@/context';
import {
  create,
  getCurrentView,
  listen,
  match,
  setOptions
} from '@native-router/core';
import type {Options, ResolveView, RouterInstance} from '@native-router/core';
import {splitProps, uniqId} from '@native-router/core/util';
import {useSyncExternalStore} from 'use-sync-external-store/shim';
import defaultResolve from '@@/resolve-view';
import {
  openViewTransition,
  shouldAnimate,
  syncRender
} from '@@/view-transition';
import type {ViewTransitionInfo, ViewTransitionProp} from '@@/view-transition';
import {emitViewCommit, markViewCommitPending} from '@@/view-commit';

const RouterContext = createContext<RouterInstance<Route, ReactNode> | null>(
  null
);

type Props<C = undefined> = {
  children?: ReactNode;
  routes: Route[] | Route;
  resolveView?: typeof defaultResolve;
  /**
   * Opt in to document [View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API):
   * `true` animates push navigations only — pop restores a `viewStack`
   * snapshot and animating it would only slow the back button down,
   * replace (guard redirects, `refresh`) stays silent; a predicate
   * receives `{action, to, from}` and decides per navigation. The
   * library owns the timing(`startViewTransition` + `flushSync`) and the
   * action→types mapping(`:active-view-transition-type(push|pop)`), the
   * animated scope is the caller's CSS. Unsupported browsers get the
   * plain navigation.
   */
  viewTransition?: ViewTransitionProp;
} & Omit<Options<ReactNode, C>, 'onLoadingChange'>;

/**
 * Base Router Component.
 * @group Components
 */
export function Router({
  router,
  children,
  viewTransition
}: {
  children?: ReactNode;
  router: RouterInstance<Route, ReactNode>;
  viewTransition?: ViewTransitionProp;
}) {
  const viewRef = useRef<ReactNode>(getCurrentView(router));
  // Latest-prop ref: the store subscription stays stable per router, so
  // toggling viewTransition never resubscribes — a resubscribe cycle
  // would cancel in-flight resolutions through listen()'s teardown.
  const viewTransitionRef = useRef(viewTransition);
  viewTransitionRef.current = viewTransition;
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // `from` of the next notification: history swaps `location` before
      // the listener runs, so at notification time it already is `to`.
      let from = router.history.location;
      // 截帧保护：动画打开期间新视图只挂起（pendingView），由过渡回调在
      // 回调内一次性提交。此前任何渲染源读到的仍是已提交的旧视图——
      // loading 状态变化、POP 之后的窗口同步 replace 通知都会抢先在
      // 浏览器截帧之前提交新 DOM，令过渡被判为无变化而跳过。
      let open = false;
      let pendingView: ReactNode;
      const commit = (flush: boolean) => {
        open = false;
        markViewCommitPending(router, false);
        viewRef.current = pendingView;
        if (flush) {
          // 提交即渲染：DOM 在当前调用栈完成更新，emitViewCommit 的订阅
          // 者（滚动恢复等）拿到的才是落地视图的真实布局。
          syncRender(onStoreChange);
          emitViewCommit(router);
        } else {
          // 同视图重宣告（POP 后的窗口同步 replace 等）：无 DOM 变化，
          // 保持原有的调度渲染，不触发提交回调。
          onStoreChange();
        }
      };
      const unlisten = listen(router, (view, action) => {
        const to = router.history.location;
        const info: ViewTransitionInfo = {action, to, from};
        from = to;
        pendingView = view;
        if (open) {
          // 已有过渡打开：只记录最新视图，其回调执行时统一提交。
          return;
        }
        const changed = !Object.is(viewRef.current, view);
        const transition =
          changed && shouldAnimate(viewTransitionRef.current, info)
            ? openViewTransition(
                () => commit(true),
                action === 'replace' ? [] : [action]
              )
            : undefined;
        if (transition) {
          open = true;
          markViewCommitPending(router, true);
          // 保险：规范保证 update 回调恰执行一次，但对极端环境（被新
          // 过渡取代时的跳过路径差异、隐藏页签）兜底——过渡结束时若
          // 仍未提交则补一次，避免视图卡在旧帧。
          const bail = () => {
            if (open) commit(true);
          };
          transition.finished?.then(bail, bail);
        } else {
          // 无动画或不支持 API：同步提交（有 DOM 变化时 flushSync）。
          commit(changed);
        }
      });
      return () => {
        // 退订时清掉挂起标记，别让滚动恢复等 afterViewCommit 订阅者
        // 等一个再也不会来的提交。
        markViewCommitPending(router, false);
        unlisten();
      };
    },
    [router]
  );
  const getSnapshot = useCallback(() => viewRef.current, []);
  // `getServerSnapshot` is required by the native implementation when the
  // Router is rendered inside server-rendered content(e.g. resolveServerView).
  const getServerSnapshot = useCallback(() => getCurrentView(router), [router]);
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Route-level pending skeleton, only when no previous view is retained
  // (cold start, refresh, re-navigation after an error); in-app navigation
  // keeps the old view by design, the global loading signal already
  // covers that phase. Reading LoadingContext here also re-renders the
  // Router on every loading transition.
  const loading = useContext(LoadingContext);
  const pending =
    view == null && loading?.status === 'pending'
      ? resolvePendingView(router, loading.key)
      : null;

  return (
    <RouterContext.Provider value={router}>
      {children === undefined ? (
        (view ?? pending)
      ) : (
        <ViewProvider value={view}>
          <PendingContext.Provider value={pending}>
            {children}
          </PendingContext.Provider>
        </ViewProvider>
      )}
    </RouterContext.Provider>
  );
}

/**
 * Render the `pendingComponent` of the nearest matched ancestor of the
 * resolving location, walked deepest first(the resolving route's own
 * included). Keyed by the loading episode so a new pending phase remounts
 * the skeleton(stateful shimmer animations restart). Guards may still
 * redirect the resolution away; until then the initially matched chain
 * is the best — and only — answer available.
 */
function resolvePendingView(
  router: RouterInstance<Route, ReactNode>,
  key: number
) {
  const {resolving} = router;
  const matched = resolving ? match(router, resolving.pathname) : undefined;
  if (!matched) return null;
  for (let i = matched.length - 1; i >= 0; i--) {
    const Pending = matched[i].route.pendingComponent;
    if (Pending) return <Pending key={key} />;
  }
  return null;
}

export function createRouter<C = undefined>(
  routes: Route | Route[],
  history: History,
  {
    resolveView = defaultResolve,
    ...options
  }: Options<ReactNode, C> & {
    resolveView?: ResolveView<Route, ReactNode>;
  } = {}
): RouterInstance<Route, ReactNode, C> {
  return create(routes, history, resolveView, options);
}

function useNewRouter<C = undefined>(
  {routes, children, viewTransition, ...options}: Props<C>,
  createHistory: () => History
) {
  const [tracked, rest] = splitProps(options, ['baseUrl', 'currentView']);
  const {baseUrl, currentView} = tracked;
  const [loading, setLoading] = useState<LoadStatus>();
  // Initial options are baked in at creation: the cold-start resolve fires
  // from the subscribe effect(children effects run first) before the
  // setOptions effect below runs, and the default errorHandler would let
  // listen's refresh().catch(noop) swallow a first failure, leaving the
  // view blank forever.
  const router = useMemo(
    () =>
      createRouter(routes, createHistory(), {
        ...options,
        onLoadingChange(status) {
          setLoading(status && {key: uniqId(), status});
        }
      }),
    // Only the tracked options belong to the deps: option updates flow
    // through the setOptions effect below instead of recreating the router.
    [routes, createHistory, baseUrl, currentView]
  );

  // Options are refreshed on every commit, so `onLoadingChange` and the
  // callback options always see the latest closure.
  useEffect(() => {
    setOptions(router, {
      ...rest,
      onLoadingChange(status) {
        setLoading(status && {key: uniqId(), status});
      }
    });
  }, [router, rest]);

  const r = useMemo(
    () => (
      <Router router={router} viewTransition={viewTransition}>
        {children}
      </Router>
    ),
    [router, children, viewTransition]
  );

  return <LoadingContext.Provider value={loading}>{r}</LoadingContext.Provider>;
}

/**
 * History mode Router Component.
 * @group Components
 */
export function HistoryRouter<C = undefined>(props: Props<C>) {
  return useNewRouter(props, createBrowserHistory);
}

/**
 * Hash mode Router Component.
 * @group Components
 */
export function HashRouter<C = undefined>(props: Props<C>) {
  return useNewRouter(props, createHashHistory);
}

/**
 * Memory mode Router Component.
 * @group Components
 */
export function MemoryRouter<C = undefined>({
  initialEntries,
  initialIndex,
  ...props
}: Props<C> & MemoryHistoryOptions) {
  const createHistory = useMemo(
    () => () => createMemoryHistory({initialEntries, initialIndex}),
    [initialEntries, initialIndex]
  );
  return useNewRouter(props, createHistory);
}

/**
 * Get Router instance.
 * @group Hooks
 * @returns Router Instance
 */
export function useRouter() {
  const router = useContext(RouterContext);
  if (!router) {
    throw new Error('useRouter() must be used within a <Router> component');
  }
  return router;
}
