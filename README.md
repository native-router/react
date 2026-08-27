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

`PrefetchLink` resolves the target view — through the route guards — before the click, with four strategies: `intent` (default, hover/focus), `render`, `viewport` and `none`. `usePrefetch` exposes `{view, loading, error}`, so a popover can render a live preview of the target view while the user is still hovering.

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
- `useSearchParams` reads and writes the query string; writes push by default or replace with `{replace: true}`; `useSetSearch(schema)` is the schema-aware setter twin of `useSearch(schema)` — the next value is validated by the same schema before any navigation, a rejection throws `SearchError` without touching the location, and the written query is the schema's own output(defaults applied)
- Typed search: an optional Standard Schema validator (zod/valibot/arktype, no hard dependency) on any route `search` field, parsed at resolve time — `data` loaders and `beforeLoad` guards receive a typed `ctx.search` and an invalid search fails the level through the existing error layers; `useSearch(schema?)` reads it in components, degrading to the raw object without a schema
- Search type closure: `createRoutes(routes)` re-types the returned table so every level's `data`/`beforeLoad` `ctx.search` derives from the level's own schema — no `Route<P, S>` generics or callback annotations needed; an explicit `Route<P, S>` generic still wins wherever written
- Type-safe links: `createRoutes(routes)` checks the table while keeping every `path` literal, `RoutePaths<typeof routes>` extracts the pattern union(through nesting and param segments), and `<TypedLink<RoutePaths<...>> to params>` narrows `to` to the table and checks `params` against the exact pattern's segments — compile errors for unknown paths and missing/wrong params, click-time interpolation with encoding as the runtime backstop
- `ScrollRestoration` restores the scroll offset per history entry on back/forward and resets it on push (`resetOnPush` to opt out)
- Router-level `preload(router, to)` shares resolved views across links with in-flight dedup and a 30s TTL; `PrefetchLink` prefetch through it
- Hooks: `useRouter`, `useView`, `useData<T>(name?)` (typed data of the current level, or named data of ancestor routes), `useMatched` (matched levels, params, location), `useLoading`, `usePrefetch`, `useSearch(schema?)`, `useSetSearch(schema)`, `useBlocker(fn)` (unsaved-changes guard: the core `setBlocker` veto, registered while the component is mounted and always asked through the latest closure)
- Two error layers, both phases: global `errorHandler` prop on the Router, per-route `errorComponent` receiving `{error, ctx}` — `errorComponent` renders for resolve failures(loader/guard/search, no `ctx.phase`) AND for render errors thrown by the component subtree(`ctx.phase === 'render'`, caught by a route-level error boundary so a rendering crash never escapes past its route, like the browser's error page for any failed load)
- Route-level `pendingComponent` skeleton, shown only when no previous view can be retained (cold start, refresh, re-navigation after an error); the nearest matched ancestor's wins, and in-app navigation keeps the previous view instead
  - Keeping the previous view during in-app navigation is an intentional design following browser-native semantics — see the Design Principles section of the core repository's README
- SSR: `resolveServerView` (from `@native-router/react/server`) renders the view plus an inline data payload; `hydrate` reuses that payload on the client with zero refetch
- Tree-shakable: `sideEffects: false` — unused components and hooks drop out of the bundle

## Matching semantics

- Routes match in **declaration order** and the first match wins — there is no sorting by specificity.
- A route **without `path`** is a layout: it matches the empty prefix and its children are matched against the full remaining path.
- A leaf child with **`path: ''`** matches whatever is left under its parent. Declared after its concrete siblings it serves as the parent's index route (and as the fallback for paths unmatched under the parent).
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

`Link`, `NavLink`, `PrefetchLink` and `TypedLink` accept an `as` component: the link renders through it instead of the plain `<a>`, so a design-system link gets SPA navigation, active state and prefetch in one line:

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

`PrefetchLink`'s strategies keep working through the `as` component; the `viewport` strategy observes the DOM node the component forwards its ref to, so a component that never forwards the ref down to a DOM element simply never triggers a viewport prefetch.

## Why `useData` is typed manually

`useData<T>()` annotations have no compile-time link to the route's `data` loader — the annotation *is* the contract. That is deliberate. Two closure schemes were evaluated (2026-08) and rejected:

- **A from-argument** (`useData('/articles/:slug')`, indexing a route-table map by path literal — TanStack's `useLoaderData({from})` shape). Rejected: it makes every view aware of the path it happens to be mounted under. Matching data to a view is the route configuration's job; a view should know what it renders, not where it is mounted.
- **A data-props protocol** — constrain `component` to `ComponentType<{data: D}>` and let `createRoutes` check the loader output against it at the config site. The check lands at the right layer, but deep children would then need prop drilling to reach the data.

What stays: path-agnostic views, no prop drilling, one local annotation. Revisit only if TypeScript or the library later offers a channel that couples neither paths nor props.

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

Validate and type the search with a schema — any zod/valibot/arktype schema works, the router only speaks [Standard Schema](https://standardschema.dev). Declare it once on the route and the search is parsed during resolve: the `data` loader and the `beforeLoad` guard receive a typed `ctx.search` (coerced numbers, defaults applied), and an invalid search fails the level through the existing error layers — the route `errorComponent`, else the global `errorHandler`.

Build the table with `createRoutes` and the typing closes by itself: the returned table derives every level's `ctx.search` from the level's own schema, so neither the manual `Route<P, S>` generic nor callback annotations are needed. (Callbacks written inside the literal are checked loosely — `ctx.search: any` — since TypeScript cannot contextually type a member from sibling properties; the precise types hold on the returned table, and a callback annotation that contradicts the schema is rejected at the property.)

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
      path: '/articles',
      search: listSearch,
      component: () => import('./ArticleList'),
      // typeof routes → this level's ctx.search: {page: number; tag?: string}
      data: ({search}) => fetchArticles(search.page, search.tag),
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

`useSearch()` without a schema degrades to the raw input object of `parseSearchInput` (strings; repeated keys are arrays) and needs no schema on the route. Both flavors re-render on every location change, and the schema must validate synchronously.

Write the search through the same schema — `useSetSearch(schema)` validates the next value before any navigation, throws `SearchError` (with the schema's issues) without touching the location when it rejects, and writes the schema's own output so defaults apply:

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
