import {useCallback} from 'react';
import {
  commitReplace,
  navigate,
  parseSearchInput,
  parseSearchSync,
  resolveEntry,
  toLocation
} from '@native-router/core';
import type {
  SearchInput,
  SearchOutputOf,
  StandardSchemaV1
} from '@native-router/core';
import {useSyncExternalStore} from 'use-sync-external-store/shim';
import {useRouter} from './components/Router';

type SetSearchParams = (
  next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  opts?: {replace?: boolean}
) => Promise<void> | void;

/**
 * Read and write the search params of the current location.
 *
 * The raw `location.search` string is subscribed via
 * `useSyncExternalStore`(same source as the Router Component), so every
 * location change(push, replace or pop) re-renders the component with the
 * latest params; a fresh `URLSearchParams` view is derived from that string
 * on each render.
 *
 * The setter navigates like any other route change: by default the new
 * search is pushed onto the history stack(mainstream react-router
 * semantics), pass `{replace: true}` to rewrite the current entry instead.
 * Since the search is part of the location, every write re-resolves the
 * matched route, so route `data` fetchers(see {@link useData}) observe the
 * new search on the next {@link useData} read.
 *
 * @group Hooks
 * @returns [searchParams, setSearchParams] - the current search params and
 * the setter(functional updates receive the live previous params); the
 * setter returns a `Promise<void>` that resolves once the navigation
 * commits, so callers may optionally `await` it
 */
export function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const router = useRouter();

  // Subscribe to the raw history(not the core view listener): search must
  // update on ANY location change, including same-view re-resolves.
  const subscribe = useCallback(
    (onStoreChange: () => void) => router.history.listen(() => onStoreChange()),
    [router]
  );
  // Snapshot the raw string(never a URLSearchParams instance) to keep the
  // snapshot reference stable between renders.
  const getSnapshot = useCallback(
    () => router.history.location.search,
    [router]
  );
  // There is no meaningful search during SSR.
  const getServerSnapshot = useCallback(() => '', []);

  // eslint-disable-next-line compat/compat -- URLSearchParams support is the app's polyfill concern, not bundled
  const searchParams = new URLSearchParams(
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  );

  const setSearchParams = useCallback<SetSearchParams>(
    (next, opts) => {
      const {history} = router;
      const params =
        typeof next === 'function'
          ? // eslint-disable-next-line compat/compat -- URLSearchParams support is the app's polyfill concern, not bundled
            next(new URLSearchParams(history.location.search))
          : next;
      const qs = params.toString();
      const {pathname, hash} = history.location;
      const to = pathname + (qs ? `?${qs}` : '') + hash;
      if (opts?.replace) {
        // Route guards run like any other navigation(align with the push
        // branch): the entry carries the terminal location, so a redirect
        // replaces the current entry with its final target.
        return resolveEntry(router, toLocation(router, to)).then((entry) =>
          commitReplace(router, entry.task, entry.location)
        );
      }
      return navigate(router, to);
    },
    [router]
  );

  return [searchParams, setSearchParams];
}

/**
 * Read the parsed search params of the current location.
 *
 * The raw `location.search` string is subscribed via
 * `useSyncExternalStore`(same source as {@link useSearchParams}), so every
 * location change(push, replace or pop) re-renders the component with the
 * latest params; the parse itself runs on each render.
 *
 * Without a schema the hook degrades to the raw input object of
 * `parseSearchInput` — strings, arrays for repeated keys
 * (`{page: '2', tag: ['a', 'b']}`). With a schema — any zod/valibot/
 * arktype schema, see the route {@link Route.search search field} — the
 * returned object is the schema's parsed output, so coercion and defaults
 * apply, e.g. `useSearch(pageSchema).page` is a number.
 *
 * Prefer declaring the schema once on the route: its `data` loader then
 * receives a parsed `ctx.search` during resolve, and an invalid search
 * fails the navigation through the existing error channels instead of
 * throwing during render.
 *
 * @group Hooks
 * @param schema an optional Standard Schema validator of the search; it
 * must validate synchronously
 * @returns the parsed search params of the current location
 * @throws {SearchError} when `schema` rejects the current search
 */
export function useSearch<S extends StandardSchemaV1>(
  schema: S
): SearchOutputOf<S>;
export function useSearch(): SearchInput;
export function useSearch(schema?: StandardSchemaV1): unknown {
  const router = useRouter();

  // Subscribe to the raw history(not the core view listener): search must
  // update on ANY location change, including same-view re-resolves.
  const subscribe = useCallback(
    (onStoreChange: () => void) => router.history.listen(() => onStoreChange()),
    [router]
  );
  // Snapshot the raw string(never a parsed object) to keep the snapshot
  // reference stable between renders.
  const getSnapshot = useCallback(
    () => router.history.location.search,
    [router]
  );
  // There is no meaningful search during SSR.
  const getServerSnapshot = useCallback(() => '', []);

  const search = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return schema ? parseSearchSync(schema, search) : parseSearchInput(search);
}
