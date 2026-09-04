import {getDebugInfo, onDebug} from '@native-router/core';
import type {DebugInfo, RouterInstance} from '@native-router/core';
import {useCallback} from 'react';
import {useSyncExternalStore} from 'use-sync-external-store/shim';
import {useRouter} from './components/Router';

// Snapshot cache per router: `useSyncExternalStore` requires the same
// object reference between events, while `getDebugInfo` builds a fresh
// one per call. Every debug event refreshes the cached entry, so all
// mounted consumers of a router share one re-render trigger.
const snapshots = new WeakMap<RouterInstance<any>, DebugInfo>();

function snapshotOf(router: RouterInstance<any>): DebugInfo {
  let snapshot = snapshots.get(router);
  if (!snapshot) {
    snapshot = getDebugInfo(router);
    snapshots.set(router, snapshot);
  }
  return snapshot;
}

/**
 * The router's observability snapshot, re-rendered on every navigation
 * lifecycle event — the React binding over the core's `onDebug`/
 * `getDebugInfo` surface, for DevTool-style panels:
 *
 * ```tsx
 * function RouteDevPanel() {
 *   const info = useRouteDebug();
 *   // info.to / info.index / info.stackDepth / info.snapshots
 *   // info.resolving — the in-flight navigation chain, or null
 * }
 * ```
 *
 * The snapshot refreshes when a debug event fires(nav-start/commit/
 * cancel/supersede/error), so it tracks every navigation transition;
 * subscribing is what enables the event stream in the first place, and
 * the underlying observation is free when no `useRouteDebug` consumer
 * is mounted. Purely observational — the hook never influences the
 * navigations it reports.
 * @group Hooks
 */
export function useRouteDebug(): DebugInfo {
  const router = useRouter();
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      onDebug(router, () => {
        snapshots.set(router, getDebugInfo(router));
        onStoreChange();
      }),
    [router]
  );
  const getSnapshot = useCallback(() => snapshotOf(router), [router]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
