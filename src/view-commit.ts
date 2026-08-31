import type {RouterInstance} from '@native-router/core';

type Listener = () => void;

// 一次性视图提交回调，以 router 实例为键。
const commitListeners = new WeakMap<RouterInstance<any>, Set<Listener>>();
// 「一个过渡已打开、提交被挂起」的 router 集合。
const pendingCommits = new WeakSet<RouterInstance<any>>();

/**
 * @internal Router 的订阅在每次真实视图提交（flushSync 完成、DOM 已
 * 更新）后调用。回调一次性：触发即注销。
 */
export function emitViewCommit(router: RouterInstance<any>) {
  const set = commitListeners.get(router);
  if (!set) return;
  for (const listener of [...set]) {
    set.delete(listener);
    listener();
  }
}

/**
 * @internal 注册一次性视图提交回调，返回注销函数。
 */
export function onViewCommit(router: RouterInstance<any>, listener: Listener) {
  let set = commitListeners.get(router);
  if (!set) {
    set = new Set();
    commitListeners.set(router, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/**
 * @internal 标记/清除「过渡已打开，提交挂起」。仅 VT 路径会置位。
 */
export function markViewCommitPending(
  router: RouterInstance<any>,
  pending: boolean
) {
  if (pending) pendingCommits.add(router);
  else pendingCommits.delete(router);
}

/**
 * @internal 视图提交后执行 `fn`：过渡挂起中则等一次性提交回调（VT 的
 * update 回调提交落地视图时触发）；否则立即执行——同步提交路径在历史
 * 事件监听器内已 flushSync 完成 DOM 更新，此刻就是「提交之后」。
 */
export function afterViewCommit(router: RouterInstance<any>, fn: () => void) {
  if (pendingCommits.has(router)) {
    onViewCommit(router, fn);
  } else {
    fn();
  }
}
