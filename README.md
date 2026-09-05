[![npm](https://img.shields.io/npm/v/@native-router/react.svg)](https://www.npmjs.com/package/@native-router/react)
[![Build Status](https://github.com/native-router/react/actions/workflows/ci.yml/badge.svg)](https://github.com/native-router/react/actions)
[![codecov](https://codecov.io/gh/native-router/react/graph/badge.svg?token=QIXC6HJH6Z)](https://codecov.io/gh/native-router/react)
[![install size](https://packagephobia.now.sh/badge?p=@native-router/react)](https://packagephobia.now.sh/result?p=@native-router/react)

# Native Router React

> A route close to the native experience for react.

English | [简体中文](./README-zh_CN.md)

## Highlights

### Back with zero requests

Every committed navigation stores its resolved view in the router's in-memory view stack. Back/forward lands on the cached view instantly — the route is not re-matched and `data` is not refetched.

```tsx
import {useRouter} from '@native-router/react';
import {back} from '@native-router/core';

function BackButton() {
  const router = useRouter();
  // Renders the cached view of the previous entry instantly
  return <button onClick={() => back(router)}>Back</button>;
}
```

### Survives a refresh

The session stack is serialized into `history.state` as a bounded tail window (`maxStackDepth`, default 100) and restored on startup. Warm the window once after a refresh with `initHistoryStack`, and every in-window back/forward renders from cache with zero requests. Entries outside the window fall back to a single lazy re-resolve.

```tsx
import {useEffect} from 'react';
import {useRouter} from '@native-router/react';
import {initHistoryStack} from '@native-router/core';

function StackWarmer() {
  const router = useRouter();
  useEffect(() => {
    // Warm up the window restored from history.state after a refresh
    initHistoryStack(router);
  }, [router]);
  return null;
}
```

### Prefetch and preview

`PrefetchLink` resolves the target view — through the route guards — before the click, with four strategies: `intent` (default, hover/focus), `render`, `viewport` and `none`. `usePrefetch` exposes `{view, loading, error}`, so a popover can render a live preview of the target view while the user is still hovering. The typed links take the same `prefetch` prop directly — `<TypedLink<typeof routes> to="/users/:id" params={{id: '7'}} prefetch="viewport">` needs no component swap.

```tsx
import {PrefetchLink, usePrefetch} from '@native-router/react';

function Preview({visible}: {visible: boolean}) {
  const {view, loading, error} = usePrefetch();
  if (!visible) return null;
  if (loading) return <div className="popover">Loading…</div>;
  if (error) return <div className="popover">Failed to prefetch</div>;
  return <div className="popover">{view}</div>; // the target view, before any click
}

<PrefetchLink to="/users/1" prefetch="viewport">
  User 1
  <Preview visible={false /* show on hover */} />
</PrefetchLink>
```

## Features

- Three history modes out of the box: `HistoryRouter`, `HashRouter`, `MemoryRouter` (tests, widgets); `Router` renders with an externally created instance, `createRouter` builds one for a custom history
- Route guards: static `redirect` and async `beforeLoad` on every route level, run shallow → deep; more than 10 chained redirects reject with `RedirectLoopError`
- Cancelable async navigation: starting a new navigation supersedes the in-flight one; `cancel(router)` aborts it; a history POP cancels it too — and the chain's `AbortSignal` reaches every `data` loader as `ctx.signal` (`fetch(url, {signal: ctx.signal})`), so superseded navigations stop their requests instead of only having results dropped
- `NavLink` with `isActive`/`isExactActive`, `end`, `caseSensitive` and `aria-current` (defaults to `"page"`); `className`/`style`/`children` accept `({isActive, isExactActive})` callbacks; `to="/"` is active for every path
- Polymorphic links: every link component takes an `as` component — own props flattened and type-checked on the link, colliding props through the `asProps` escape hatch, `href`/`onClick`/`aria-current` injected, `ref` forwarded
- `useSearchParams` reads and writes the query string; writes push by default or replace with `{replace: true}`; `useSetSearch(schema)` is the schema-aware setter twin of `useSearch(schema)` — the next value is validated by the same schema before any navigation, a rejection throws `SearchError` without touching the location, and the written query is the schema's own output(defaults applied); `writeSchema(schema, defaults)` (from the core) derives a write projection that strips default-equal keys for clean URLs; the setters are fire-and-forget safe — navigation failures are already handled, and the returned promise still rejects for callers that await it
- Typed search: an optional Standard Schema validator (zod/valibot/arktype, no hard dependency) on any route `search` field, parsed at resolve time — `data` loaders and `beforeLoad` guards receive a typed `ctx.search` and an invalid search fails the level through the existing error layers; `useSearch(schema?)` reads it in components, degrading to the raw object without a schema
- Search and params type closure: `createRoutes(routes)` re-types the returned table so every level's `data`/`beforeLoad` `ctx.search` derives from the level's own schema and `ctx.params` from the accumulated path patterns of the matched prefix (`beforeLoad` additionally honors a prefix `params` schema's output) — no `Route<P, S>` generics or callback annotations needed; param-less levels keep the loose `Record<string, string>`, and an explicit `Route<P, S>` generic still wins wherever written
- `createRoute(path, search?, config)` factory: build one route at a time with WRITE-TIME typed callbacks — the schema as the second argument types `ctx.search` while you write it, the path argument types `ctx.params`; the two-argument form keeps the schema inside the config and the returned route re-types precisely all the same
- Fine-grained search invalidation via `searchDeps` on every route level (the field passes through `createRoutes` to the core): declare the search keys a level's resolution consumes and a same-path navigation that leaves every declared projection unchanged re-serves the current view snapshot — zero guards, zero loaders, zero lazy imports; `useSearchParams`/`useSetSearch` writes (push and `{replace: true}`) take the same fast path, and `useSetSearch(schema)` still validates the whole value before navigating
- Type-safe links: `createRoutes(routes)` checks the table while keeping every `path` literal, `RoutePaths<typeof routes>` extracts the pattern union(through nesting and param segments), and `<TypedLink<RoutePaths<...>> to params>` narrows `to` to the table and checks `params` against the exact pattern's segments — compile errors for unknown paths and missing/wrong params, click-time interpolation with encoding as the runtime backstop; `TypedNavLink`/`TypedPrefetchLink` bring the same narrowing to the active-state and prefetching links. Give the link the whole table — `<TypedLink<typeof routes>>` — and `search` joins the discrimination too, typed by the pattern's route schema input(Standard Schema `~standard.types`, zod/valibot/arktype), serialized into the href and the navigation target; schema-less patterns keep `search` loose, and the paths-union flavor is untouched. `TypedLink` and `TypedNavLink` also take an optional `prefetch` strategy — declared, the link renders through `PrefetchLink` on the interpolated target(`usePrefetch` preview context included) with the narrowing and the missing-param backstop kept; omitted, it stays the plain link
- Router context: a `context` prop on the Router components (or a `context` option on `createRouter`) bakes in one synchronous value per router instance, handed to every `data` loader and `beforeLoad` guard as `ctx.context` — per-instance deps (API client, config, i18n) without a module singleton; omit it and the context is `undefined`, existing setups unchanged
- Route context: a route may additionally declare its own `context` object, merged OVER the router context (route wins on key conflicts) for the level and its descendants — `beforeLoad` sees the fold accumulated through its own level, each `data` loader the fold through its level; typing closes on the `createRoutes` table and through `Route<P, S, C, RC>`'s fourth generic, and tables that declare none keep the exact instance value
- `ScrollRestoration` restores the scroll offset per history entry on back/forward and resets it on push (`resetOnPush` to opt out)
- `viewTransition` prop on the Router components opts navigation into the browser's View Transitions API: `true` animates push navigations only, a predicate decides per navigation on `{action, to, from}`; the direction rides the transition `types` for `:active-view-transition-type(push|pop)` CSS, and unsupported browsers degrade to plain navigation
- Router-level `preload(router, to)` shares resolved views across links with in-flight dedup and a 30s TTL; `PrefetchLink` prefetch through it
- Hooks: `useRouter`, `useView`, `useData<T>(name?)` (typed data of the current level, or named data of ancestor routes — derive the annotation from the loader with `RouteDataOf` instead of hand-writing it), `useMatched` (matched levels, params, location), `useLoading`, `usePrefetch`, `useSearch(schema?)`, `useSetSearch(schema)`, `useRouteDebug()` (the core's `onDebug`/`getDebugInfo` observability surface as a `useSyncExternalStore` snapshot — current location, window depth, snapshot count and the in-flight navigation chain, re-rendered on every navigation lifecycle event; purely observational), `useBlocker(fn)` (unsaved-changes guard: the core `setBlocker` veto — the predicate allow-lists, return `true` to let the navigation through, `false` to veto it — registered while the component is mounted and always asked through the latest closure; every veto is tracked on the returned `blocker.state` with a `proceed()`/`reset()` channel — `proceed()` retries the vetoed navigation bypassing this hook's blocker only, so the confirm dialog is a three-liner)
- `notFound` prop on the Router components: a `NotFoundError` (unmatched path, or a guard/loader throwing one for missing data) renders the declared node/component as the entry's committed view instead of a blank screen — precedence over `errorHandler` for `NotFoundError` only, every other error keeps the existing channel
- Two error layers, both phases: global `errorHandler` prop on the Router, per-route `errorComponent` receiving `{error, ctx}` — `errorComponent` renders for resolve failures(loader/guard/search, no `ctx.phase`) AND for render errors thrown by the component subtree(`ctx.phase === 'render'`, caught by a route-level error boundary so a rendering crash never escapes past its route, like the browser's error page for any failed load)
- Route-level `pendingComponent` skeleton, shown only when no previous view can be retained (cold start, refresh, re-navigation after an error); the nearest matched ancestor's wins, and in-app navigation keeps the previous view instead — unless the Router opts into `pendingDelayMs`, switching the retained view to the skeleton once a navigation has been pending that long
  - Keeping the previous view during in-app navigation is an intentional design following browser-native semantics — see the Design Principles section of the core repository's README
- SSR: `resolveServerView` (from `@native-router/react/server`) renders the view plus an inline data payload; `hydrate` (from `@native-router/react/ssr`) reuses that payload on the client with zero refetch
- Tree-shakable: `sideEffects: false` — unused components and hooks drop out of the bundle

## Matching semantics

- Every matching chain is collected and the **most specific one wins**: per path segment, static text outranks a dynamic `:param`, which outranks a splat `*wildcard`, and every segment adds to the chain's score — so longer chains (more of the URL pinned down) outrank shorter ones. Equally specific chains fall back to **declaration order**. A parent whose prefix matched but whose children all failed never hides later siblings — e.g. `[{path: '/a', children: [{path: '/b'}]}, {path: '/*rest'}]` serves `/a/q` from the wildcard.
- A route **without `path`** is a layout: it matches the empty prefix and its children are matched against the full remaining path.
- A leaf child with **`path: ''`** matches whatever is left under its parent. It serves as the parent's index route (and as the fallback for paths unmatched under the parent) — siblings that match with real segments outrank it by specificity, so its declaration position no longer decides.
- **Trailing slashes are significant**: `/users/` does not match `/users`.
- Matching is **case-sensitive**.
- Params of nested levels are merged **deep over shallow** (`mergeMatchedParams`): for `/:id` + `/posts/:id`, the deeper `id` wins.

## Link interception

`Link` (and `PrefetchLink`/`NavLink`, which delegate to it) intercepts only plain primary-button clicks. The browser keeps its default behavior for:

- modified clicks (⌘/Ctrl/Shift/Alt) and any non-left button
- `target="_blank"`, `target="_parent"` or `target="_top"`
- `rel` containing `external`
- events already `defaultPrevented`

A user-provided `onClick` runs first with the same event; calling `e.preventDefault()` there suppresses the navigation entirely. While a navigation started by a link is pending, further clicks on that link are ignored.

## Rendering through your own component (`as`)

`Link`, `NavLink`, `PrefetchLink`, `TypedLink`, `TypedNavLink` and `TypedPrefetchLink` accept an `as` component: the link renders through it instead of the plain `<a>`, so a design-system link gets SPA navigation, active state and prefetch in one line:

```tsx
import {NavLink} from '@native-router/react';
import {NavLink as HazeNavLink} from 'haze-ui';

<NavLink as={HazeNavLink} to="/help" variant="primary">
  Help
</NavLink>
```

The contract for the `as` component:

- **Forward its ref and spread the rest props** onto the DOM element it renders — everything below depends on it (`href`, the composed `onClick` and `aria-current` must reach the DOM).
- **Own props land directly on the link** (`variant` above): props that do not collide with the link's own props are flattened and checked by TypeScript — required props stay required, invalid values are compile errors.
- **Colliding props go through `asProps`**: only keys the component shares with the link's base props (anchor attributes such as `title`/`target`) are accepted there, and they are spread last, explicitly overriding the base value. With no shared keys the prop degrades to `{}` — no ambiguity.

The navigation semantics stay owned by the link: `href` is always the computed target of `to`, the click handling is always the composed one (user `onClick` → interception guard → in-app navigation) and `NavLink`'s `aria-current` is always its active-state value — none of them can be overridden, not even through `asProps`. The `ref` is the `as` component's own, so a component that is not wrapped in `forwardRef` rejects `ref` at compile time.

`TypedLink` composes with `as` on top of its pattern narrowing — give both type arguments, since a partial instantiation does not infer the remaining one:

```tsx
<TypedLink<RoutePaths<typeof routes>, typeof HazeNavLink>
  to="/users/:id"
  params={{id: '7'}}
  variant="primary"
>
  User 7
</TypedLink>
```

`TypedNavLink` and `TypedPrefetchLink` are the one exception: with a single type argument they still accept an `as` component (`<TypedNavLink<Paths> to="/" end as={HazeNavLink} />`), with the component's own props passing through unchecked; give both type arguments for the full checking above.

`PrefetchLink`'s strategies keep working through the `as` component; the `viewport` strategy observes the DOM node the component forwards its ref to, so a component that never forwards the ref down to a DOM element simply never triggers a viewport prefetch.

## View Transitions

The `viewTransition` prop opts navigation into the browser's [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) — route views crossfade with zero animation code:

```tsx
import {HistoryRouter as Router, View} from '@native-router/react';

<Router routes={routes} viewTransition>
  <View />
</Router>
```

The library owns only the **timing**: every navigation that passes the check is committed inside `document.startViewTransition(() => flushSync(render))`, so the DOM updates synchronously in the transition callback and the browser captures both frames correctly. While a transition is open, the pending view is committed only inside its callback — anything else that re-renders in between (the loading state, the internal replace that follows a POP) still sees the old view, so nothing leaks a pre-capture commit. The library never assigns a `view-transition-name` and never injects CSS: **what animates is entirely your stylesheet**.

**`true` animates pushes only.** A `pop` lands on a cached `viewStack` snapshot — animating it would only slow the back button down — and `replace` (guard redirects, `refresh`) stays silent. A predicate decides per navigation instead, judged on `{action: 'push' | 'replace' | 'pop', to, from}`:

```tsx
// Pushes slide in from the right, back/forward mirror it:
<Router
  routes={routes}
  viewTransition={({action}) => action === 'push' || action === 'pop'}
>
  <View />
</Router>
```

Each animated navigation carries its direction as a [transition type](https://developer.chrome.com/docs/web-platform/view-transitions/same-document) — `push` or `pop`, none for `replace` — so CSS can tell the two apart:

```css
/* Default crossfade needs no CSS at all; this adds direction */
::view-transition-old(root) {animation: 200ms ease both vt-out;}
::view-transition-new(root) {animation: 200ms ease both vt-in;}
/* pop plays the same pair mirrored */
:root:active-view-transition-type(pop)::view-transition-old(root) {
  animation-name: vt-out-rev;
}
:root:active-view-transition-type(pop)::view-transition-new(root) {
  animation-name: vt-in-rev;
}
@keyframes vt-out    {to   {transform: translateX(-30%); opacity: 0;}}
@keyframes vt-in     {from {transform: translateX(30%);  opacity: 0;}}
@keyframes vt-out-rev {to   {transform: translateX(30%);  opacity: 0;}}
@keyframes vt-in-rev  {from {transform: translateX(-30%); opacity: 0;}}
```

### Recipe 1 — whole-page transition (zero CSS)

With no `view-transition-name` anywhere, the whole document is one `root` snapshot: `viewTransition` alone gives you the browser's default crossfade. Nothing to set up.

### Recipe 2 — animating only the view outlet

Nested layouts, `MemoryRouter` widgets, master-detail panes: circle the animated region and freeze everything else. Give the outlet the document's only `view-transition-name`, then hold the `root` group still:

```tsx
<main className="outlet">
  <View />
</main>
```

```css
.outlet {
  view-transition-name: outlet;
}
/* Freeze the page shell: only the outlet group animates */
::view-transition-group(root) {
  animation: none;
}
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
/* The outlet itself crossfades (or slides — style it like root above) */
::view-transition-group(outlet) {
  animation-duration: 200ms;
}
```

A `view-transition-name` must be **unique across the whole document** — one name, one element. Two elements sharing a name make the transition skip.

### Concurrency: one transition per document

The browser runs a single view transition per document at a time — starting a new one skips the previous. Two routers both animating (nested SPAs, several `MemoryRouter` panes) will constantly skip each other; give the inner routers predicates that keep them quiet, or animate only one of them. This is browser semantics, not something the library intervenes in.

### Accessibility

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

### Support

- Same-document View Transitions: Chrome/Edge 111+, Safari 18+, Firefox 139+
- Transition `types` (the direction tags): Chrome/Edge 129+, Safari 18.2+ — probed once by behavior (a callback-only implementation throws a synchronous `TypeError` on the options form); elsewhere the transition still runs, just without direction types, so `:active-view-transition-type(...)` selectors stop matching
- No View Transitions at all (jsdom, older browsers): plain navigation, nothing happens

## Typing `useData`

`useData<T>()` annotations have no compile-time link to the route's `data` loader — the annotation *is* the contract. That is deliberate. Two closure schemes were evaluated (2026-08) and rejected:

- **A from-argument** (`useData('/articles/:slug')`, indexing a route-table map by path literal — TanStack's `useLoaderData({from})` shape). Rejected: it makes every view aware of the path it happens to be mounted under. Matching data to a view is the route configuration's job; a view should know what it renders, not where it is mounted.
- **A data-props protocol** — constrain `component` to `ComponentType<{data: D}>` and let `createRoutes` check the loader output against it at the config site. The check lands at the right layer, but deep children would then need prop drilling to reach the data.

What stays: path-agnostic views, no prop drilling, one local annotation.

The channel that couples neither paths nor props arrived as a type helper: `RouteDataOf` derives the annotation from the loader itself — the same reference the route table hangs — so it cannot drift from what `route.data` resolves:

```tsx
const loadUser = ({params, signal}) =>
  userService.fetchById(+params.id, {signal}); // → Promise<User>

{path: '/users/:id', data: loadUser, component: () => UserView}

// UserView — still one local annotation, now checked instead of asserted
const user = useData<RouteDataOf<typeof loadUser>>(); // User | undefined
```

Zero runtime, zero new call-site arguments. Each level of a nested chain types through its own loader (the runtime's nearest-provider rule — a view reads the data of its own matched level), a level without `data` reads `undefined`, and anything the helper cannot resolve degrades to `unknown` — the bare `useData()` width — never a compile error. A hand-written `useData<Article>()` keeps priority wherever it is written.

## Data loading recipe

Bare loaders plus `useData<RouteDataOf<...>>()` carry simple tables a long way. When an app grows — entity caches, DevTool mocks, mutations that must address the same data the route loaders produced — the pattern that scales is a per-entity triple: one factory call binds the same fetch to the route table, the view read and the component/mutation channel at once:

```tsx
// [loader, useData, queryFn] — one declaration per entity
const [loadArticle, useArticle, queryArticle] = createDataLoader({
  fetch: (slug: string, signal?: AbortSignal) =>
    api.get(`/articles/${slug}`, {signal}), // the one fetch
  cache: articleCache, // keyed entity cache: [slug] → Article
  keyOf: (ctx) => [ctx.params.slug], // route ctx → cache key, defined once
  staleTime: 30_000
});

// the route table hangs the loader by reference
{path: '/articles/:slug', data: loadArticle, component: () => ArticleView}

// the view reads typed by the same loader, optionality in the return type
const article = useArticle(); // Article — this route declares the loader
const maybe = useArticle({optional: true}); // Article | undefined — a shared
// component may also be mounted under a route without the loader

// reads outside the route lifecycle and mutations address the same entity
const fresh = useQuery(queryArticle, [slug]);
invalidate(queryArticle, [slug]);
```

Why one factory for the three:

- **`loader`** — what the route table hangs, by reference. The reference identity doubles as a DEV source check: in the hook, `route.data === loadArticle` proves the view reads what this loader resolved. Declaration identity, not a result fingerprint — the same loader under different params, optimistic writes and stale-while-revalidate's old-value-first all fake a fingerprint.
- **`useData`** — the view read with the required/optional split carried in the return type: a bare call asserts the route declares this loader, so data is resolved before the view mounts (pending and errors are handled by `pendingComponent`/`errorComponent`); `{optional: true}` covers shared components that may also render under routes without the loader.
- **`queryFn`** — the same fetch × cache bound for reads outside the route lifecycle; mutations write and invalidate through the same key the loader resolves, so the route channel and the component channel cannot drift apart.

The factory itself is application glue — cache library, mock layer, DEV checks — not router API. It is extracted from **painless**, the reference SPA template built on this router (see its `src/util/dataLoader.ts` for the full implementation: double-channel caching, DevTool mocks and the DEV identity check included).

## Deferred data without `<Await>`

TanStack Router ships a deferred-data primitive: a loader returns a promise for secondary data without awaiting it, and the view renders `<Await>` over it so the page streams in as it settles. This router deliberately does not — the answer is a composition of the two channels above plus plain React:

- **First-screen-critical data rides the loader and blocks the resolve.** The view commits whole — `pendingComponent` covers the cold start, in-app navigation keeps the previous view until the new one is ready — so there is no client-side promise plumbing on the critical path, and every committed view is a complete snapshot (which is what back/forward, preload previews and view transitions are built on).
- **Secondary data — comments, sidebars, recommendations — rides the component channel and never blocks.** The component fetches it itself through its `queryFn`, and the loading state lives where the data renders: painless' comment list renders its own `Spinner` while the article above it is already interactive (`src/views/Article/CommentList.tsx`, bound in `src/services/dataloaders.ts`).
- **Want the `<Await>` ergonomics anyway — a declarative fallback instead of a manual loading flag?** That is what React's `<Suspense>` is for, and react-toolroom's `useSuspenseResult` hands it the in-flight result: the reader suspends until the first result exists, the owner drives the fetch from outside the boundary. Same deferred effect, standard pieces, no router API involved:

```tsx
import {Suspense} from 'react';
import {useRun, useSuspenseResult} from 'react-toolroom/async';

function ArticleComments({slug}: {slug: string}) {
  const fetchComments = useInjectable(queryComments);
  useRun(fetchComments, [slug]); // outside the boundary — effects of a
  return (                       // suspended subtree never run
    <Suspense fallback={<Spinner />}>
      <CommentReader fetchComments={fetchComments} />
    </Suspense>
  );
}

function CommentReader({fetchComments}: {fetchComments: typeof queryComments}) {
  const comments = useSuspenseResult(fetchComments); // suspends once
  return comments.map((c) => <Comment key={c.id} {...c} />);
}
```

The trade: `<Await>` gives you promise-typed loader returns and route-managed streaming at the cost of partial commits; this router keeps commits atomic and pushes deferred rendering to the component level, where Suspense, error boundaries and the entity cache already live. **painless** is the living reference for both channels — see `decisions.md` there for the channel-split reasoning.

## Fine-grained search invalidation

A same-path search change — paging, filtering, collapsing a panel — normally re-resolves the whole chain: every level's `beforeLoad`, `data` loader and lazy `component` import re-run, however small the change is. `searchDeps` (a `Route` field inherited from the core) opts a level out of that by declaring which search keys its resolution consumes. The recommended shape is the one painless uses: the root layout declares `[]` (it renders the outlet and consumes nothing), each leaf declares exactly the keys its loader reads:

```tsx
import {createRoutes} from '@native-router/react';
import {z} from 'zod';

const homeSearch = z.object({
  tag: z.string().optional(),
  offset: z.coerce.number().default(0),
  limit: z.coerce.number().default(20)
});

const routes = createRoutes({
  component: () => import('./Layout'),
  searchDeps: [], // the layout consumes nothing from the search
  children: [
    {
      path: '/',
      search: homeSearch,
      searchDeps: ['tag', 'offset', 'limit'], // exactly what the loader reads
      component: () => import('./Home'),
      data: ({search}) => fetchArticles(search)
    }
  ]
});
```

- **Fast path:** the navigation targets the same pathname, **every level of the matched chain declares `searchDeps`**, and each level's projection is unchanged between the current entry and the target → the current view snapshot is committed as the new entry: zero guards, zero loaders, zero lazy loading, the same path a POP hitting the view stack takes. `navigate()` and both `useSearchParams`/`useSetSearch` write branches (push and `{replace: true}`) take it — the check is the core's `reusableEntry`
- **Chain coverage is all-or-nothing:** one undeclared level re-resolves the whole chain on every navigation — the behavior before this feature, byte for byte. That is why the layout declares `[]` too: miss one level and the whole chain falls back to re-resolving on every search change
- **Schema and guard keys count as consumed:** the fast path runs no `beforeLoad`, and a guard reading a search key will not re-run when it changes unless the key is declared. The `search` schemas themselves are NOT skipped: the target's raw search validates against every matched level's schema before the snapshot is re-served, and a rejected value abandons the fast path so the `SearchError` surfaces through the normal error layer (route `errorComponent`, else the global `errorHandler`) instead of landing unchecked in the URL — the same failure a hand-typed invalid URL produces. `useSetSearch(schema)` still validates the whole value against the schema before any navigation, whatever the declared keys
- **The reused view is a snapshot:** it keeps the `data` and matched `ctx` of the resolve that produced it; read live search through `useSearch`/`useSearchParams` — they subscribe to history and are always current — never through the matched context. `hash`/`state` never take part either: on a fully declared chain a hash-only navigation reuses the snapshot too
- **No View Transition, scroll reset as usual:** a reused navigation keeps the same view reference, so nothing animates; `ScrollRestoration`'s `resetOnPush` scrolls each new push entry back to the top exactly as before
- `invalidate()` drops the snapshots and the fast path stays off until the next real resolve; POP replay, `initHistoryStack` warm-up and `refresh()` are untouched

## Observability / debug events

The core ships an opt-in, purely observational navigation event stream — `router.onDebug(listener)` emits `nav-start` / `nav-commit` / `nav-cancel` / `nav-supersede` / `nav-error` (with the action, the target path and timings; `nav-commit.replay` flags a POP served from the `viewStack` snapshot), and `router.getDebugInfo()` snapshots the current location, the session window depth, the held view snapshots and the in-flight chain. See the core README's [Observability / debug events](https://github.com/native-router/core#observability--debug-events) section for the full event table.

`useRouteDebug()` is the React binding over that surface — a `useSyncExternalStore` snapshot re-rendered on every navigation lifecycle event, ready for a DevTool panel:

```tsx
import {useRouteDebug} from '@native-router/react';

function RouteDevPanel() {
  const {to, index, stackDepth, snapshots, resolving} = useRouteDebug();
  return (
    <aside aria-label="router debug">
      <b>{to}</b> (index {index}, stack {stackDepth}, snapshots {snapshots})
      {resolving && <span> navigating to {resolving.to}…</span>}
    </aside>
  );
}
```

Mount the panel anywhere inside the Router (a nav bar beside `<View />` works); subscribing is what enables the stream, and with no consumer mounted the observation is free. For a full event timeline the raw stream is a plain effect away — `useEffect(() => router.onDebug(listener), [router])` — and the snapshot stays consistent with it because every event refreshes the cache the hook reads.

## Structural differences vs TanStack Router

Four capabilities in this README — the view stack, `searchDeps`, `useBlocker` and `viewTransition` — read like features, but each is an architectural commitment that TanStack Router makes differently or not at all. The TanStack statements below are checked against its current docs at [tanstack.com/router](https://tanstack.com/router/latest/docs/framework/react/overview); the native-router side is what the source does. A concept-by-concept migration map lives in [docs/from-tanstack-router.md](./docs/from-tanstack-router.md).

### `viewStack`: back lands on a snapshot, not on a loader cache

Every committed navigation stores its resolved view in the router's in-memory view stack; a POP lands on that snapshot — no re-match, no guards, no loaders, no requests. The session stack survives a refresh as a bounded tail window serialized into `history.state` (`maxStackDepth`, default 100), restored on startup and warmed once by `initHistoryStack` from `@native-router/core` (the `StackWarmer` above is an example component pattern, not a library export).

TanStack Router has no counterpart: back is an ordinary navigation — the route re-matches, and its built-in SWR cache decides what a loader re-runs. The cache is keyed on the parsed pathname plus `loaderDeps`; the `beforeLoad` chain runs on every navigation regardless; and with the default `staleTime: 0`, re-entering a loader key revalidates in the background — so back fires requests by default, tuned away through `staleTime`/`gcTime`/`shouldReload`.

The difference is structural, not a matter of cache tuning: a snapshot retains the *resolved view* — the same element carrying its resolve-time `data` and matched `ctx`, the lazy `component` already imported — so the page back re-mounts has nothing to re-run and nothing to wait for (`ScrollRestoration` restores the entry's scroll offset; React state is not retained — the component mounts fresh). A loader cache re-feeds a re-mounted component, and with default staleness its loaders fire again. "Back never runs user code" is a property of the stack, not a configuration of a cache.

### `searchDeps`: a search change that runs nothing

On a same-path search change where **every level of the matched chain declares `searchDeps`** and no declared projection changed, the current view snapshot is re-committed — zero guards, zero loaders, zero lazy imports, the same path a POP takes. Chain coverage is all-or-nothing: one undeclared level restores the resolve-on-every-navigation behavior byte for byte. The wiring rule from the previous section applies unchanged: guard-read keys must be declared or their guards will not re-run (`search` schemas are not skipped — the target validates before the snapshot is re-served), and `useSetSearch(schema)` still validates the whole value before navigating.

TanStack's nearest knob is `loaderDeps`, and it points the other way: `loaderDeps` is a cache *key* — when the deps change the route reloads, and when they don't, default staleness still revalidates in the background; `beforeLoad` keeps running either way. There is no configuration in which a search change runs literally nothing.

Structurally this is the `viewStack` mechanism applied mid-session — the view never leaves the tree, and re-committing the identical element reference makes React skip the subtree, so component state survives — which is why it cannot be reproduced by making a cache "fresh enough".

### `useBlocker`: the rewind lives in the library

A vetoed browser POP is automatically pushed back — the core rewinds the history itself, leaving no dangling forward entry. The ask surface is `{state, proceed, reset}`: `proceed()` is a one-shot bypass of this hook's own blocker only (other registered blockers and the guard chain are still asked), and the retry is a fresh push navigation. The predicate is a synchronous allow-list — `true` lets the navigation through, `false` vetoes, a throw counts as a veto (fail-closed) — asked at the head of every navigation and before a POP lands; `refresh` and guard redirects are never blocked.

TanStack's `useBlocker({shouldBlockFn, withResolver, enableBeforeUnload})` returns `{status, proceed, reset}` and also intercepts popstate through its history layer. The predicate polarity is reversed (`shouldBlockFn` returning `true` *blocks*; here `true` *allows* — invert your dirtiness check), the decision may be asynchronous (`withResolver` defers it), and `enableBeforeUnload` couples the browser's unload dialog into the hook. Here the decision is made synchronously inside the history event, so the rewind is immediate and the confirm UI is three props wide — the division of labor differs, not just the spelling.

### `viewTransition`: the library owns timing, CSS owns scope

The library wraps the commit in `document.startViewTransition(() => flushSync(render))` behind a commit gate — while a transition is open, the store snapshot keeps serving the old view and only the transition callback commits the new one, so nothing (a loading re-render, the post-POP window sync) can commit before the browser captures the old frame. The direction rides the transition `types` (`:active-view-transition-type(push|pop)`), `true` animates pushes only — a `pop` lands on a `viewStack` snapshot and animating it would only slow the back button — and a predicate decides per navigation on `{action, to, from}`. The library never assigns a `view-transition-name` and never injects CSS; what animates is the caller's stylesheet.

TanStack Router opts in per navigation (`viewTransition` on `Link`/`navigate`) or router-wide (`defaultViewTransition`): `true` wraps navigations in `startViewTransition()` with no direction filter, and `ViewTransitionOptions.types` computes the type tags from `{fromLocation, toLocation, pathChanged, …}` yourself (returning `false` skips the transition). Scope is the caller's CSS there too — that part is the platform's, not the library's. What differs is the default predicate (push-only, because a pop is a snapshot hit), the automatic action→types mapping, and the commit gate as documented behavior rather than an implementation detail.

## Install

```bash
npm i @native-router/react
```

`@native-router/core` comes along as a dependency.

## Usage

```tsx
import {View, HistoryRouter as Router} from '@native-router/react';
import type {Route} from '@native-router/react';
import Loading from '@/components/Loading';
import RouterError from '@/components/RouterError';
import * as userService from '@/services/user';

const routes = {
  component: () => import('./Layout'), // a layout renders <View /> for its child
  children: [
    {
      path: '/',
      component: () => import('./Home')
    },
    {
      path: '/users',
      component: () => import('./UserList'),
      data: userService.fetchList,
      // cold-start/refresh skeleton; in-app navigation keeps the old view
      pendingComponent: () => <UserListSkeleton />
    },
    {
      path: '/users/:id',
      component: () => import('./UserProfile'),
      // guards run before the view resolves; return a path to redirect
      async beforeLoad({params}) {
        if (!await canView(+params.id)) return '/login';
      },
      // data receives {matched, index, router, location, params, search, signal};
      // ctx.signal aborts when this navigation is superseded/cancelled
      data: ({params, signal}) =>
        userService.fetchById(+params.id, {signal}),
      errorComponent: ({error}) => <p>{error.message}</p>
    },
    {
      path: '/help',
      component: () => import('./Help')
    }
  ]
} as Route;

export default function App() {
  return (
    <Router
      routes={routes}
      baseUrl="/demos"
      errorHandler={(e) => <RouterError error={e} />}
    >
      <View />
      <Loading />
    </Router>
  );
}
```

Read the page data and params in a view:

```tsx
import {useData, useMatched} from '@native-router/react';

export default function UserProfile() {
  const user = useData<User>(); // the data of the current level, typed
  const {params} = useMatched(); // params accumulated to this level
  return <h1>{user!.username}(#{params.id})</h1>;
}
```

The progress bar above the view is just `useLoading`:

```tsx
import {useLoading} from '@native-router/react';

export default function Loading() {
  const loading = useLoading();
  return loading?.status === 'pending' ? <div className="bar" /> : null;
}
```

Render something for unmatched paths instead of a blank screen — a `notFound` prop on the Router components (a ReactNode as-is, or a component type rendered with no props):

```tsx
<HistoryRouter routes={routes} notFound={() => < NotFoundPage />}>
  <View />
</HistoryRouter>;
```

A resolution rejecting with the core's `NotFoundError` — an unmatched path, or a guard/loader throwing one for missing data — renders it as the entry's committed view, so a back/forward onto the entry replays it. `notFound` takes precedence over `errorHandler` for `NotFoundError` only; every other error keeps the existing `errorHandler` path, and without the prop nothing changes.

In-app navigations keep the previous view until the new one resolves (the view stack design). Opt into a skeleton for the slow ones with `pendingDelayMs` — once a navigation has been pending that long, the nearest matched `pendingComponent` replaces the retained view until it settles; a loader that resolves inside the threshold never flashes:

```tsx
<HistoryRouter routes={routes} pendingDelayMs={300}>
  <View />
</HistoryRouter>;
```

Read and write the query string:

```tsx
import {useSearchParams} from '@native-router/react';

function Pager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = searchParams.get('page') ?? '1';

  function go(next: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(next));
    setSearchParams(params); // push by default
    // setSearchParams(params, {replace: true}); // or rewrite the current entry
  }

  return <button onClick={() => go(+page + 1)}>Next</button>;
}
```

Restore the scroll offset like a native app (place inside the Router):

```tsx
import {ScrollRestoration} from '@native-router/react';

// in your layout:
<ScrollRestoration /> // back/forward restore, push resets; resetOnPush={false} to keep
```

On mount it also sets `history.scrollRestoration` to `manual`: the browser's own `auto` restoration would race the component's restore and pre-scroll while the left entry's offset is still being read, so the component owns scroll restoration for the session (the setting is not reverted on unmount).

Scroll timing is sequenced around view commits and therefore safe with `viewTransition`: the leaving offset is read at the history event — before the view commits, so a shrinking document cannot clamp the saved value — and the restore runs after the landed view has committed (through the view-transition callback when one is open), so `scrollTo` never lands on the outgoing document's height.

Validate and type the search with a schema — any zod/valibot/arktype schema works, the router only speaks [Standard Schema](https://standardschema.dev). Declare it once on the route and the search is parsed during resolve: the `data` loader and the `beforeLoad` guard receive a typed `ctx.search` (coerced numbers, defaults applied), and an invalid search fails the level through the existing error layers — the route `errorComponent`, else the global `errorHandler`.

Build the table with `createRoutes` and the typing closes by itself: the returned table derives every level's `ctx.search` from the level's own schema, so neither the manual `Route<P, S>` generic nor callback annotations are needed. (Callbacks written inside the literal are checked loosely — `ctx.search: any` — since TypeScript cannot contextually type a member from sibling properties; the precise types hold on the returned table, and a callback annotation that contradicts the schema is rejected at the property.)

`ctx.params` closes the same way, from the matched prefix's path patterns: `data` loaders see the accumulated raw string params, `beforeLoad` guards see them upgraded by any prefix level's `params` schema. A level whose pattern has no params keeps the loose `Record<string, string>` — precision is progressive, existing tables never re-type.

```tsx
import {createRoutes, useData, useSearch} from '@native-router/react';
import {z} from 'zod';

const listSearch = z.object({
  page: z.coerce.number().default(1),
  tag: z.string().optional()
});

const routes = createRoutes({
  component: () => import('./Layout'),
  children: [
    {
      path: '/articles/:slug',
      search: listSearch,
      component: () => import('./ArticleList'),
      // typeof routes → ctx.search: {page: number; tag?: string},
      //                ctx.params: {slug: string} — no annotations
      data: ({search, params}) => fetchArticles(params.slug, search.tag),
      errorComponent: ({error}) => <p>{error.message}</p>
    }
  ]
});

function ArticleList() {
  const articles = useData<Article[]>(); // typed, no casts
  const {page} = useSearch(listSearch); // parsed like ctx.search
  const raw = useSearch(); // degraded raw object: {page: '2'} strings
  // ...
}
```

Hand-annotated route objects keep the explicit generic — it wins wherever written:

```tsx
const listRoute = {
  path: '/articles',
  search: listSearch,
  component: () => import('./ArticleList')
} as Route<'/articles', {page: number; tag?: string}>;
```

Prefer one level at a time? `createRoute` gives the callbacks their types WHILE YOU WRITE THEM — the schema rides the second argument, and TypeScript contextually types a parameter from earlier arguments, so `ctx.search` needs no annotation and no round-trip through the returned table:

```tsx
import {createRoute} from '@native-router/react';

const articleRoute = createRoute('/articles/:slug', listSearch, {
  component: () => import('./ArticleList'),
  // ctx.search: {page: number; tag?: string},
  // ctx.params: {slug: string} — typed right here, in the editor
  data: ({search, params}) => fetchArticles(params.slug, search.tag)
});
```

The two-argument form — `createRoute('/articles/:slug', {search: listSearch, ...})` — accepts the schema inside the config: `ctx.params` is still write-time typed from the path, `ctx.search` degrades to the loose `SearchInput` while writing, and the returned route re-types precisely all the same. The written callbacks carry over untouched (return types included, so `RouteDataOf<typeof route.data>` keeps working), and nesting through `children` accumulates literals for `RoutePaths`/`TypedLink` exactly like a `createRoutes` table.

`useSearch()` without a schema degrades to the raw input object of `parseSearchInput` (strings; repeated keys are arrays) and needs no schema on the route. Both flavors re-render on every location change, and the schema must validate synchronously.

Write the search through the same schema — `useSetSearch(schema)` validates the next value before any navigation, throws `SearchError` (with the schema's issues) without touching the location when it rejects, and writes the schema's own output so defaults apply. The setters' idiom is fire-and-forget: failures down the navigation chain (a throwing guard, ...) are already handled and never surface as an unhandled rejection; await the returned promise when you need to observe the failure — it still rejects:

```tsx
import {useSearch, useSetSearch} from '@native-router/react';

function Pager() {
  const {page} = useSearch(listSearch);
  const setSearch = useSetSearch(listSearch);

  function go(next: number) {
    setSearch({page: String(next)}); // push; {replace: true} rewrites
  }
  // ...
}
```

Writing the schema's own output means defaults land in the query — every page link carries `?page=1`. For clean URLs derive the write side once with `writeSchema(schema, defaults)` from `@native-router/core`: it validates through the same read contract and strips every key equal to its default, so one read schema covers both directions and the hand-written write-side twin disappears:

```tsx
import {writeSchema} from '@native-router/core';

const listWrite = writeSchema(listSearch, {page: 1});
// useSetSearch(listWrite): {page: 1} writes '' (clean), {page: 3} writes '?page=3'
const setSearch = useSetSearch(listWrite);
```

Give the whole router its own context — deps, config, i18n handles — without a module singleton: pass `context` to the Router components (or `createRouter`) and every `data` loader and `beforeLoad` guard receives it as `ctx.context`, one value per router instance. A router per test keeps fixtures from leaking across tests; a router per micro-frontend pane keeps panes from sharing state.

```tsx
import {HistoryRouter, View} from '@native-router/react';

const routerContext = {api, i18n};

<HistoryRouter routes={routes} context={routerContext}>
  <View />
</HistoryRouter>;

// in a route: ctx.context is the very value passed above
{
  path: '/articles',
  data: ({context}) => context.api.fetchArticles()
}
```

- The value is a synchronous snapshot baked in per instance — not a reactive store; changing it does not re-resolve anything
- The type is inferred from the prop into the router instance (`router.context`); omit it and the context is `undefined` — existing setups keep their exact types and behavior
- To type `ctx.context` precisely, give `Route` its third generic — `Route<'/articles', Search, typeof routerContext>` — or annotate the callback's ctx; un-annotated loaders see it `any` (the same loose default `ctx.search` gets, since the route table is declared before the router)
- `createRouter(routes, history, {context})`, `<Router>`, `<HistoryRouter>`, `<HashRouter>` and `<MemoryRouter>` all accept it

A route may additionally declare its own `context` — merged OVER the router context, the route winning on key conflicts, for the level and every deeper level of its chain:

```tsx
const routes = createRoutes({
  component: () => import('./Layout'),
  context: {theme: 'light'}, // layout-level defaults
  children: [
    {
      path: '/admin',
      context: {role: 'admin'}, // inherits theme, adds role
      children: [
        {
          path: '/audit',
          // this guard's ctx.context: {api, i18n, theme: 'light', role: 'admin'}
          beforeLoad: ({context}) => (context.role === 'admin' ? undefined : '/'),
          // each data loader sees the fold through its own level only —
          // a layout's loader never observes deeper declarations
          data: ({context}) => context.api.fetchAuditLog()
        }
      ]
    }
  ]
});
```

Levels without a `context` contribute nothing — tables that never declare route contexts keep the exact instance value. On the returned `createRoutes` table every level's `ctx.context` re-types from its own declaration; the `Route` generic spells the merged shape explicitly — `Route<'/audit', any, AppContext, {role: 'admin'}>` types `ctx.context` as `AppContext & {role: 'admin'}`.

Make `Link` targets type-safe: build the table with `createRoutes` (a `satisfies`-style identity function that keeps every `path` literal), extract the pattern union with `RoutePaths`, and narrow `TypedLink` to it. `params` is checked against the exact pattern's param segments — `:name` wants a string, `*name` a string array:

```tsx
import {TypedLink, createRoutes} from '@native-router/react';
import type {RoutePaths} from '@native-router/react';

const routes = createRoutes({
  component: () => import('./Layout'),
  children: [
    {path: '/', component: () => import('./Home')},
    {path: '/users/:id', component: () => import('./UserProfile')},
    {path: '/files/*rest', component: () => import('./Files')}
  ]
});

type AppPaths = RoutePaths<typeof routes>; // '/' | '/users/:id' | '/files/*rest'

<TypedLink<AppPaths> to="/users/:id" params={{id: '7'}}>User 7</TypedLink>
// @ts-expect-error '/help' is not a pattern of the table
<TypedLink<AppPaths> to="/help">Help</TypedLink>
// @ts-expect-error params are required for '/users/:id'
<TypedLink<AppPaths> to="/users/:id">User ?</TypedLink>
```

At click time the params are interpolated into the pattern (values percent-encoded, wildcard segments joined with `/`); a missing required param throws instead of navigating — the runtime backstop of the type-level check. An `as Route` assertion widens every `path` to `string`, so `RoutePaths` degrades to `string` and `TypedLink` accepts any path, exactly like a plain `Link` — the migration is opt-in.

`search` joins the check when you give the link the whole table instead of the paths union: `TypedLink<typeof routes>` types `search` by each pattern's route schema **input** (the URL-side type, extracted from the Standard Schema `~standard.types` pair that zod/valibot/arktype carry), while `TypedLink<RoutePaths<...>>` keeps working exactly as before with `search` loose:

```tsx
import {TypedLink, createRoutes} from '@native-router/react';

const routes = createRoutes({
  component: () => import('./Layout'),
  children: [
    {
      path: '/articles',
      search: z.object({page: z.coerce.number(), tag: z.string().optional()}),
      component: () => import('./Articles')
    },
    {path: '/users/:id', component: () => import('./UserProfile')}
  ]
});

<TypedLink<typeof routes> to="/articles" search={{page: 2, tag: 'react'}}>
  Page 2
</TypedLink>
// @ts-expect-error 'ppage' is not a field of the schema input
<TypedLink<typeof routes> to="/articles" search={{ppage: 2}} />
// schema-less patterns stay loose: any SearchInput passes
<TypedLink<typeof routes> to="/users/:id" params={{id: '7'}} search={{from: 'list'}} />
```

At click time the search is serialized into the query string (values `String()`-ed, arrays repeating the key, `undefined`/`null` dropped) and the route's schema validates the result on resolve exactly like a hand-written URL — an invalid search fails the level through the existing error layers. Schemas without the input pair (a bare `validate`, older vendors) degrade `search` to the loose `SearchInput` instead of erroring.

`TypedNavLink` and `TypedPrefetchLink` bring the same narrowing to the active-state and prefetching links — `to` narrowed to the table, `params` and `search` checked per pattern, and every `NavLink`/`PrefetchLink` capability (`end`, `caseSensitive`, active-state `className`/`style`/`children` callbacks, `ariaCurrent`, the `prefetch` strategies) kept:

```tsx
import {TypedNavLink} from '@native-router/react';
import type {RoutePaths} from '@native-router/react';

<TypedNavLink<RoutePaths<typeof routes>> to="/" end>Home</TypedNavLink>
<TypedNavLink<RoutePaths<typeof routes>> to="/users/:id" params={{id: '7'}}>
  User 7
</TypedNavLink>
// @ts-expect-error '/help' is not a pattern of the table
<TypedNavLink<RoutePaths<typeof routes>> to="/help">Help</TypedNavLink>
```

The active state is computed on the interpolated target, and a missing required param throws on click instead of navigating (quietly skipped when your own `onClick` already called `preventDefault`). Both compose with an `as` component: with a single type argument — `<TypedNavLink<Paths> to="/" end as={MyLink} variant="primary" />` — the component's own props pass through unchecked (TypeScript cannot infer the second type argument once the first is explicit); give both — `<TypedNavLink<Paths, typeof MyLink> ... />` — to check them like `TypedLink` does.

`TypedLink` and `TypedNavLink` take an optional `prefetch` strategy — the same values `PrefetchLink` takes (`'intent'`/`'render'`/`'viewport'`/`'none'`). Declared, the link upgrades in place to a prefetching one: it renders through `PrefetchLink` on the interpolated target (search included, so the prefetched entry is cached under the exact pathname+search it will commit), the `usePrefetch` preview context is live on its children, and every strategy keeps working — while the pattern narrowing and the click-time missing-param backstop stay exactly as above. Omitted, the link stays the plain `Link`/`NavLink` path byte for byte, so adding `prefetch` to an existing typed link is the whole migration — no component swap:

```tsx
<TypedLink<AppPaths> to="/articles/:slug" params={{slug}} prefetch="viewport">
  <PreviewCard visible={false /* show on hover */} />
</TypedLink>
```

A render error never crashes past its route: the level's resolved view is wrapped in a route-level error boundary, which renders the same route `errorComponent` with `ctx.phase === 'render'` (the resolve-phase fallback passes no `phase`). Without a route `errorComponent` the error goes to the global `errorHandler`; the boundary keeps working across recoveries — a retry button can `refresh(router)`, and navigating away renders the next view normally.

See [demos](./demos) for a complete example.

## Development

`@native-router/react` (this package) and `@native-router/core` live in **two independent repositories**; clone them side by side. The vitest config aliases `@native-router/core` to `../core/src`, so tests exercise the latest core source without any install-level linking (a `@native-router/core` from the npm registry is still installed for types and production builds).

```bash
pnpm install
pnpm start     # demo dev server
pnpm test:run  # react tests
```

React's type check and production build resolve core from the npm registry, so publish core first when this repo needs to consume unpublished core APIs.

## Documentation

[API](https://native-router.github.io/react/modules.html)
