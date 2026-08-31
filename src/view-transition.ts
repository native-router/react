import {flushSync} from 'react-dom';
import type {Location, NavAction} from '@native-router/core';

/**
 * What a view-transition decision is judged against: the direction the
 * navigation committed and its two endpoints.
 * 判定一次导航是否需要视图过渡的信息：落位方向与起止位置。
 * @group Types
 */
export type ViewTransitionInfo = {
  /**
   * How the navigation committed, straight from the core `listen`
   * callback: `'push'`(`navigate`/`commit`), `'replace'`
   * (`refresh`/`commitReplace`, guard redirects, the initial warm-up) or
   * `'pop'`(back/forward landing on a snapshot, including a vetoed
   * POP's rewind landing).
   */
  action: NavAction;
  /** The landed location. */
  to: Location;
  /** The location the router left. */
  from: Location;
};

/**
 * The `viewTransition` prop shape: `true` animates push navigations only;
 * a predicate decides per navigation.
 * @group Types
 */
export type ViewTransitionProp =
  boolean | ((info: ViewTransitionInfo) => boolean);

// react-dom owns flushSync(17/18/19 uniformly); the transition callback
// must render synchronously for the browser to capture both frames
// correctly. Exported for the Router wiring, which owns the commit.
export const syncRender: (render: () => void) => void = flushSync;

const noop = () => {};

// `types` 支持的一次性行为探测缓存：undefined 未探测，其余为结论。
let supportsTypes: boolean | undefined;

/**
 * @internal 仅供测试在用例间重置能力探测缓存。
 */
export function resetViewTransitionCapability() {
  supportsTypes = undefined;
}

/**
 * The default `viewTransition: true` semantics plus the predicate form:
 * only push animates — pop lands on a `viewStack` snapshot and animating
 * it would only slow the back button down, replace(guard redirects,
 * `refresh`) stays silent. A predicate sees the whole info and decides
 * per navigation.
 */
export function shouldAnimate(
  viewTransition: ViewTransitionProp | undefined,
  info: ViewTransitionInfo
) {
  return typeof viewTransition === 'function'
    ? viewTransition(info)
    : viewTransition === true && info.action === 'push';
}

// SSR（无 document）、旧浏览器与 jsdom 没有 startViewTransition：返回
// undefined，调用方直接提交，零成本降级。
function getStarter(): Document['startViewTransition'] | undefined {
  if (typeof document === 'undefined') return undefined;
  const {startViewTransition} = document;
  return typeof startViewTransition === 'function'
    ? startViewTransition.bind(document)
    : undefined;
}

// 行为探测：旧签名（只接受 callback）会在 WebIDL 参数转换阶段对
// options 对象同步抛出 TypeError——不会留下半开的过渡；新签名创建后
// 立即 skipTransition，update 为空操作，不产生可见帧。探测一次性，
// 结果缓存于 supportsTypes。
function typesSupported(): boolean {
  if (supportsTypes === undefined) {
    supportsTypes = false;
    const start = getStarter();
    if (start) {
      try {
        const probe = start({update() {}, types: []});
        // skip 会让 ready/finished 以 AbortError reject——接住，否则每次
        // 页面首次动画导航都泄漏一条 unhandled rejection。
        probe.ready?.catch(noop);
        probe.finished?.catch(noop);
        probe.skipTransition();
        supportsTypes = true;
      } catch {
        // 旧实现：降级为不带 types 的 callback 调用形态（无方向感）。
      }
    }
  }
  return supportsTypes;
}

/**
 * Start a document view transition around `update`. The library owns the
 * timing only; the animated scope stays entirely the caller's CSS
 * (`view-transition-name` / `::view-transition-*`), never touched here.
 * @param update the transition callback — MUST render the pending view
 * synchronously(flushSync) so the browser captures both frames correctly;
 * the caller owns the commit it performs
 * @param types direction tags: `['push']`/`['pop']` for CSS
 * `:active-view-transition-type(...)`, `[]` for the default root
 * transition — dropped when the browser predates `types`(probed once by
 * behavior: old signatures throw a synchronous TypeError on the options
 * form)
 * @returns the started transition, or `undefined` when the API is
 * unavailable(SSR/old browsers/jsdom) — degrade to a plain commit
 */
export function openViewTransition(
  update: () => void,
  types: string[]
): ViewTransition | undefined {
  const start = getStarter();
  if (!start) return undefined;
  const transition = typesSupported() ? start({update, types}) : start(update);
  // 被更新的过渡取代（同文档并发）时 ready 会 reject——接住，同样为了
  // 不泄漏 unhandled rejection。
  transition.ready?.catch(noop);
  return transition;
}
