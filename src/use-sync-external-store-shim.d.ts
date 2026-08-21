declare module 'use-sync-external-store/shim' {
  // eslint-disable-next-line import/prefer-default-export
  export function useSyncExternalStore<Snapshot>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => Snapshot,
    getServerSnapshot?: () => Snapshot
  ): Snapshot;
}
