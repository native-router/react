import {createPath} from 'history';
import type {HistoryState} from '@native-router/core';
import {useEffect, useRef} from 'react';
import {useRouter} from './Router';

/** Saved scroll offset of one history stack slot. */
type ScrollPosition = {x: number; y: number};

type ScrollRestorationProps = {
  /**
   * Scroll a freshly pushed(or replaced) entry back to the top, like a full
   * page load. Set to false to keep the current offset across forward
   * navigations(e.g. feed-style "load more" pages). POP always restores the
   * saved offset, regardless of this flag.
   * @default true
   */
  resetOnPush?: boolean;
};

/**
 * Restore the window scroll position across history navigations.
 *
 * The router restores views from the in-memory `viewStack`: on back/forward
 * the view is reused without re-fetching its data, but the browser has
 * already left the old document position and a remounted DOM starts at the
 * top by default. Mount `<ScrollRestoration />` anywhere inside
 * {@link Router}(typically in the root layout) to fill that gap:
 *
 * - the scroll offset of every visited entry is remembered, keyed by the
 *   absolute history index(`history.location.state.index` — the same key
 *   `viewStack` is keyed by). Like `viewStack`, the map is in-memory and
 *   session scoped: after a page reload there is nothing to restore and the
 *   browser's own restoration takes over.
 * - `history.scrollRestoration` is taken over as `manual`(the browser's
 *   own `auto` restoration would race the restore and pre-scroll while the
 *   left entry's offset is still being read), making the component solely
 *   responsible for restoration; the takeover is session scoped and not
 *   reverted on unmount, like `viewStack`.
 * - POP restores the saved offset of the landed entry(`0,0` when none was
 *   saved, e.g. forward-past-the-end or post-reload entries).
 * - PUSH and REPLACE scroll a fresh entry back to the top when
 *   `resetOnPush` is set(default). Internal re-commits of the very same
 *   entry(the core listener's POP sync, `refresh`, listen bootstrap) never
 *   touch the scroll.
 *
 * Renders nothing. SSR safe: it only subscribes in an effect and only when
 * `window` exists.
 * @param props
 * @group Components
 */
export default function ScrollRestoration({
  resetOnPush = true
}: ScrollRestorationProps) {
  const router = useRouter();
  // Positions survive effect re-runs(resetOnPush changes) on purpose.
  const positionsRef = useRef(new Map<number, ScrollPosition>());
  const lastIndexRef = useRef(-1);
  const lastPathRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    // The browser's own `auto` restoration races this component's restore
    // (it can pre-scroll within the microtask window where the left entry's
    // offset is still being read), so take full control for the session.
    if (window.history.scrollRestoration) {
      window.history.scrollRestoration = 'manual';
    }

    const positions = positionsRef.current;
    const readIndex = (state: unknown) =>
      (state as HistoryState | undefined)?.index || 0;

    lastIndexRef.current = readIndex(router.history.location.state);
    lastPathRef.current = createPath(router.history.location);

    let scheduled = false;
    let sawPop = false;
    let active = true;

    const unlisten = router.history.listen(({action}) => {
      // The core listener re-commits a landed POP entry with an internal
      // REPLACE(stack serialization sync), and listener registration order
      // decides whether that REPLACE reaches us before or after the POP
      // itself. Collapse the whole synchronous event storm and decide once,
      // from the final history state, in a microtask — no layout has
      // scrolled yet at that point, so saving the left entry's offset
      // still reads the pre-navigation scroll.
      sawPop ||= action === 'POP';
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (!active) return;
        const popped = sawPop;
        sawPop = false;
        const {location} = router.history;
        const index = readIndex(location.state);
        const path = createPath(location);
        const lastIndex = lastIndexRef.current;

        if (index !== lastIndex) {
          // The entry we just left keeps its scroll offset.
          positions.set(lastIndex, {x: window.scrollX, y: window.scrollY});
        }

        if (popped) {
          const saved = positions.get(index) ?? {x: 0, y: 0};
          window.scrollTo(saved.x, saved.y);
          positions.set(index, saved);
        } else if (
          resetOnPush &&
          (index !== lastIndex || path !== lastPathRef.current)
        ) {
          // A fresh forward entry, or the current entry rewritten to a
          // different location(a replace navigation) — start at the top.
          window.scrollTo(0, 0);
          positions.set(index, {x: 0, y: 0});
        }
        // Anything else is an internal re-commit of the same entry: keep
        // the current scroll.

        lastIndexRef.current = index;
        lastPathRef.current = path;
      });
    });

    return () => {
      active = false;
      unlisten();
    };
  }, [router, resetOnPush]);

  return null;
}
