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
import {stringifySearch} from './components/link-behavior';

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
      return setSearch(router, params.toString(), opts);
    },
    [router]
  );

  return [searchParams, setSearchParams];
}

/**
 * Write the search params of the current location through a schema, the
 * setter-side twin of `useSearch(schema)`: the next value is serialized
 * to a query string, degraded with `parseSearchInput` and validated by
 * the SAME schema before any navigation happens. A schema that rejects
 * the value throws its issues(`SearchError`) without touching the
 * location; the value the schema would default or coerce on the read
 * side never gets silently written.
 *
 * Synchronous schemas only(the `useSearch` flavor); an async `validate`
 * rejects without navigating.
 *
 * The navigation semantics follow `useSearchParams`' setter: push by
 * default, `{replace: true}` rewrites the current entry, guards run,
 * and the returned `Promise<void>` resolves once the navigation commits.
 *
 * @group Hooks
 * @param schema a Standard Schema validator of the search — must
 * validate synchronously
 * @returns the schema-aware setter; functional updates receive the live
 * previous params
 * @throws {SearchError} when `schema` rejects the next value, before
 * any navigation
 */
export function useSetSearch<S extends StandardSchemaV1>(
  schema: S
): (
  next: SearchInput | ((prev: SearchInput) => SearchInput),
  opts?: {replace?: boolean}
) => Promise<void> | void {
  const router = useRouter();

  return useCallback(
    (next, opts) => {
      const {history} = router;
      const input =
        typeof next === 'function'
          ? next(parseSearchInput(history.location.search))
          : next;
      // Validate the whole next value — not a diff — the same way a
      // navigation to the resulting URL would: parseSearchSync throws
      // SearchError with the schema's issues, and no navigation happens.
      const validated = parseSearchSync(schema, stringifySearch(input));
      // The schema output is authoritative: defaults applied and values
      // coerced to strings, so a partially-filled input still writes the
      // fully-defaulted query.
      return setSearch(
        router,
        stringifySearch(validated as Record<string, unknown>),
        opts
      );
    },
    [router, schema]
  );
}

function setSearch(
  router: ReturnType<typeof useRouter>,
  qs: string,
  opts?: {replace?: boolean}
): Promise<void> | void {
  const {history} = router;
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
