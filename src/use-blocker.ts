import {useCallback, useEffect, useRef, useState} from 'react';
import {navigate, setBlocker} from '@native-router/core';
import type {BlockerFn} from '@native-router/core';
import {useRouter} from './components/Router';

/**
 * A vetoed navigation waiting for a decision, exposed on
 * {@link Blocker.state}: the user was asked, the router stayed on
 * {@link BlockerState.from from}.
 */
export type BlockerState = {
  /** The vetoed navigation's target path (pathname, search, hash). */
  location: string;
  /** The path the vetoed navigation tried to leave. */
  from: string;
};

/**
 * What {@link useBlocker} returns: whether a navigation is waiting for
 * a decision, plus the decision channel. Both actions are no-ops while
 * `state` is `null`.
 */
export type Blocker = {
  /** The pending ask, or `null` while nothing waits — drive your confirm UI off it. */
  state: BlockerState | null;
  /**
   * Retry the vetoed navigation. Only this hook's own blocker is
   * bypassed — the user has answered it — while other registered
   * blockers and the guard chain still get asked on the retry. A
   * blocked-by-another-blocker retry re-enters this hook as a fresh
   * veto and re-opens the ask.
   */
  proceed(): void;
  /** Dismiss the ask; the router stays where it is. */
  reset(): void;
};

/**
 * Block navigations away from the current page while the component is
 * mounted — the unsaved-changes guard.
 *
 * The predicate is the core `setBlocker` veto: `(to, from) => boolean`
 * over path strings(including search and hash), asked synchronously at
 * the head of every navigation and before a history POP lands. Return
 * `false` to veto: a vetoed navigation never starts and a vetoed POP is
 * rewound. `refresh` and guard redirects are never blocked; the effect
 * releases the blocker on unmount, so the guard lives exactly as long
 * as the guarding component.
 *
 * The predicate is stored in a ref and re-synced on every render, so a
 * navigation is always asked the latest closure — a `confirmed` flag it
 * captured works without re-registering anything. SSR-safe: nothing
 * here touches `window`, and the registration itself is an effect that
 * never runs on the server.
 *
 * Every veto is tracked on the returned {@link Blocker}, so the
 * confirm UI is a three-liner instead of a hand-rolled ref/state pair:
 *
 * ```tsx
 * const blocker = useBlocker(() => isDirtyRef.current);
 *
 * return (
 *   <>
 *     <Editor />
 *     <ConfirmDialog
 *       open={blocker.state != null}
 *       onCancel={blocker.reset}
 *       onConfirm={blocker.proceed}
 *     />
 *   </>
 * );
 * ```
 *
 * `proceed()` retries the vetoed navigation bypassing this hook's own
 * blocker only — other registered blockers (and the route guards) are
 * still asked, in registration order. Note the retry is a fresh push
 * navigation: for a vetoed browser POP it appends an entry rather than
 * re-running the history traversal.
 *
 * @group Hooks
 * @param fn blocker predicate; `to` is the target path, `from` the
 * current path. Return `false` to veto (and open the ask), `true` to
 * let the navigation through
 * @returns {@link Blocker} — the pending ask and its proceed/reset
 * channel
 * @see {@link setBlocker}
 */
export function useBlocker(fn: BlockerFn): Blocker {
  const router = useRouter();
  const fnRef = useRef(fn);
  // Always ask the latest closure: re-rendering with new state must not
  // require re-registering the blocker.
  fnRef.current = fn;
  const [ask, setAsk] = useState<BlockerState | null>(null);
  // The pending ask, readable synchronously from proceed/reset — the
  // confirm callbacks must not depend on the render closure's freshness.
  const pendingRef = useRef<BlockerState | null>(null);
  // One-shot bypass for the proceed retry: set right before the retry
  // navigation, cleared once it has been asked. A plain ref — the flag
  // must be visible to the synchronously-asked blocker, not to React.
  const bypassRef = useRef(false);

  useEffect(
    () =>
      setBlocker(router, (to, from) => {
        // The proceed retry: the user already answered this blocker.
        // Still ask the other registered ones (setBlocker iterates the
        // registry in order) and reset the flag once we are asked.
        if (bypassRef.current) {
          bypassRef.current = false;
          return true;
        }
        if (fnRef.current(to, from)) return true;
        // Vetoed: open the ask. A navigation superseding an open ask
        // replaces it — the older target is never proceeded to.
        pendingRef.current = {location: to, from};
        setAsk({location: to, from});
        return false;
      }),
    [router]
  );

  const proceed = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setAsk(null);
    bypassRef.current = true;
    void navigate(router, pending.location).catch(() => undefined);
  }, [router]);

  const reset = useCallback(() => {
    pendingRef.current = null;
    setAsk(null);
  }, []);

  return {state: ask, proceed, reset};
}
