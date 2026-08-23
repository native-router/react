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
- Cancelable async navigation: starting a new navigation supersedes the in-flight one; `cancel(router)` aborts it; a history POP cancels it too
- `NavLink` with `isActive`/`isExactActive`, `end`, `caseSensitive` and `aria-current` (defaults to `"page"`); `className`/`style`/`children` accept `({isActive, isExactActive})` callbacks; `to="/"` is active for every path
- `useSearchParams` reads and writes the query string; writes push by default or replace with `{replace: true}`
- Typed search: an optional Standard Schema validator (zod/valibot/arktype, no hard dependency) on any route `search` field, parsed at resolve time — loaders receive a typed `ctx.search` and an invalid search fails the level through the existing error layers; `useSearch(schema?)` reads it in components, degrading to the raw object without a schema
- `ScrollRestoration` restores the scroll offset per history entry on back/forward and resets it on push (`resetOnPush` to opt out)
- Router-level `preload(router, to)` shares resolved views across links with in-flight dedup and a 30s TTL; `PrefetchLink` prefetch through it
- Hooks: `useRouter`, `useView`, `useData<T>(name?)` (typed data of the current level, or named data of ancestor routes), `useMatched` (matched levels, params, location), `useLoading`, `usePrefetch`, `useSearch(schema?)`
- Two error layers: global `errorHandler` prop on the Router, per-route `errorComponent` receiving `{error, ctx}`
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

While a navigation started by a link is pending, further clicks on that link are ignored.

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
      data: userService.fetchList
    },
    {
      path: '/users/:id',
      component: () => import('./UserProfile'),
      // guards run before the view resolves; return a path to redirect
      async beforeLoad({params}) {
        if (!await canView(+params.id)) return '/login';
      },
      // data receives {matched, index, router, location, params}
      data: ({params}) => userService.fetchById(+params.id),
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

Validate and type the search with a schema — any zod/valibot/arktype schema works, the router only speaks [Standard Schema](https://standardschema.dev). Declare it once on the route and the search is parsed during resolve: the `data` loader receives a typed `ctx.search` (coerced numbers, defaults applied), and an invalid search fails the level through the existing error layers — the route `errorComponent`, else the global `errorHandler`.

```tsx
import {useData, useSearch} from '@native-router/react';
import type {Route} from '@native-router/react';
import {z} from 'zod';

const listSearch = z.object({
  page: z.coerce.number().default(1),
  tag: z.string().optional()
});

const listRoute = {
  path: '/articles',
  search: listSearch,
  component: () => import('./ArticleList'),
  // ctx.search: {page: number; tag?: string} — parsed and typed
  data: ({search}) => fetchArticles(search.page, search.tag),
  errorComponent: ({error}) => <p>{error.message}</p>
} as Route<'/articles', {page: number; tag?: string}>;

function ArticleList() {
  const articles = useData<Article[]>(); // typed, no casts
  const {page} = useSearch(listSearch); // parsed like ctx.search
  const raw = useSearch(); // degraded raw object: {page: '2'} strings
  // ...
}
```

`useSearch()` without a schema degrades to the raw input object of `parseSearchInput` (strings; repeated keys are arrays) and needs no schema on the route. Both flavors re-render on every location change, and the schema must validate synchronously.

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
