import {useEffect, useRef} from 'react';
import {setBlocker} from '@native-router/core';
import type {BlockerFn} from '@native-router/core';
import {useRouter} from './components/Router';

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
 * @group Hooks
 * @param fn blocker predicate; `to` is the target path, `from` the
 * current path
 * @see {@link setBlocker}
 */
export function useBlocker(fn: BlockerFn): void {
  const router = useRouter();
  const fnRef = useRef(fn);
  // Always ask the latest closure: re-rendering with new state must not
  // require re-registering the blocker.
  fnRef.current = fn;
  useEffect(
    () => setBlocker(router, (to, from) => fnRef.current(to, from)),
    [router]
  );
}
