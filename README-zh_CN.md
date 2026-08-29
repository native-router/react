[![npm](https://img.shields.io/npm/v/@native-router/react.svg)](https://www.npmjs.com/package/@native-router/react)
[![Build Status](https://github.com/native-router/react/actions/workflows/ci.yml/badge.svg)](https://github.com/native-router/react/actions)
[![codecov](https://codecov.io/gh/native-router/react/graph/badge.svg?token=QIXC6HJH6Z)](https://codecov.io/gh/native-router/react)
[![install size](https://packagephobia.now.sh/badge?p=@native-router/react)](https://packagephobia.now.sh/result?p=@native-router/react)

# Native Router React

> 接近原生体验的 React 路由库。

[English](./README.md) | 简体中文

## 亮点

### 后退零请求

每次提交的导航都会把已解析的视图存进路由器的内存视图栈。前进/后退直接命中缓存视图——不重新匹配路由，也不重新拉取 `data`。

```tsx
import {useRouter} from '@native-router/react';
import {back} from '@native-router/core';

function BackButton() {
  const router = useRouter();
  // 瞬间渲染上一条目的缓存视图
  return <button onClick={() => back(router)}>Back</button>;
}
```

### 刷新后会话恢复

会话栈以有界尾部窗口的形式序列化进 `history.state`（`maxStackDepth`，默认 100），启动时自动恢复。刷新后用 `initHistoryStack` 预热一次，窗口内的前进/后退全部从缓存渲染、零请求。窗口外的条目退化为单次惰性重解析。

```tsx
import {useEffect} from 'react';
import {useRouter} from '@native-router/react';
import {initHistoryStack} from '@native-router/core';

function StackWarmer() {
  const router = useRouter();
  useEffect(() => {
    // 刷新后预热从 history.state 恢复的窗口
    initHistoryStack(router);
  }, [router]);
  return null;
}
```

### 预取与预览

`PrefetchLink` 在点击之前——经过路由守卫——解析目标视图，提供四种策略：`intent`（默认，hover/focus）、`render`、`viewport` 与 `none`。`usePrefetch` 暴露 `{view, loading, error}`，用户悬停时就能在气泡里渲染目标视图的实时预览。

```tsx
import {PrefetchLink, usePrefetch} from '@native-router/react';

function Preview({visible}: {visible: boolean}) {
  const {view, loading, error} = usePrefetch();
  if (!visible) return null;
  if (loading) return <div className="popover">加载中…</div>;
  if (error) return <div className="popover">预取失败</div>;
  return <div className="popover">{view}</div>; // 点击之前的目标视图
}

<PrefetchLink to="/users/1" prefetch="viewport">
  User 1
  <Preview visible={false /* hover 时展示 */} />
</PrefetchLink>
```

## 功能

- 开箱即用的三种 history 模式：`HistoryRouter`、`HashRouter`、`MemoryRouter`（测试、小组件）；`Router` 接收外部创建的实例渲染，`createRouter` 用自定义 history 构建实例
- 路由守卫：每层路由支持静态 `redirect` 与异步 `beforeLoad`，按浅层到深层执行；连续重定向超过 10 次以 `RedirectLoopError` 拒绝
- 可取消的异步导航：发起下一次导航会取代进行中的导航；`cancel(router)` 主动中止；history POP 也会取消——同时导航链的 `AbortSignal` 以 `ctx.signal` 传入每个 `data` loader（`fetch(url, {signal: ctx.signal})`），被取代的导航真正停止请求而非仅丢弃结果
- `NavLink`：`isActive`/`isExactActive`、`end`、`caseSensitive` 与 `aria-current`（默认 `"page"`）；`className`/`style`/`children` 支持 `({isActive, isExactActive})` 回调；`to="/"` 对所有路径都是激活态
- 多态链接：四个 Link 组件都接受 `as` 组件——组件自有 props 摊平到链接上并做类型检查，冲突 props 走 `asProps` 逃生舱，`href`/`onClick`/`aria-current` 由链接注入，`ref` 透传
- `useSearchParams` 读写查询串：默认 push，传 `{replace: true}` 则改写当前条目；`useSetSearch(schema)` 是 `useSearch(schema)` 的写入侧孪生——写入前用同一 schema 校验，拒绝时抛 `SearchError` 且不导航，写入的是 schema 自身的输出（缺省值已补齐）
- 类型化 search：任意路由 `search` 字段可声明 Standard Schema 校验器（zod/valibot/arktype，无硬依赖），resolve 时解析——`data` loader 与 `beforeLoad` 守卫都拿到类型安全的 `ctx.search`，非法 search 经既有错误层失败；组件里用 `useSearch(schema?)` 读取，无 schema 时退化为原始对象
- search 类型闭环：`createRoutes(routes)` 重写返回表的类型，每层的 `data`/`beforeLoad` `ctx.search` 从该层自己的 schema 输出推导——不再需要 `Route<P, S>` 泛型或回调注解；显式写出的 `Route<P, S>` 泛型仍优先
- 类型安全的链接：`createRoutes(routes)` 校验路由表同时保留全部 `path` 字面量，`RoutePaths<typeof routes>` 提取模式联合（穿透嵌套、保留参数段），`<TypedLink<RoutePaths<...>> to params>` 把 `to` 收窄到表内、按目标模式检查 `params`——路径不存在、参数缺失/类型错误都是编译错误，点击时插值加编码是运行时兜底；`TypedNavLink`/`TypedPrefetchLink` 把同样的收窄带给激活态链接与预取链接
- Router 上下文：Router 组件的 `context` prop（或 `createRouter` 的 `context` 选项）给每个 router 实例固化一份同步值，每个 `data` loader 与 `beforeLoad` 守卫都从 `ctx.context` 拿到——按实例注入依赖（API client、配置、i18n）而无需模块单例；不传则为 `undefined`，现有接入零改动
- `ScrollRestoration`：按历史条目恢复滚动位置，back/forward 复原、push 重置（`resetOnPush` 可关闭）
- 路由级 `preload(router, to)` 预解析共享视图：并发去重 + 30 秒 TTL；`PrefetchLink` 的预取即走此通道
- Hooks：`useRouter`、`useView`、`useData<T>(name?)`（当前层级 data 的类型化读取，或祖先路由的具名数据）、`useMatched`（匹配层级、参数、location）、`useLoading`、`usePrefetch`、`useSearch(schema?)`、`useSetSearch(schema)`、`useBlocker(fn)`（未保存变更守卫：core 的 `setBlocker` 否决——谓词是放行语义，返回 `true` 放行导航、`false` 否决导航，不是「返回 true 阻止」；组件挂载期间注册、始终以最新闭包被询问；每次否决都记录在返回值的 `blocker.state` 上，并带 `proceed()`/`reset()` 通道——`proceed()` 重试被否决的导航，仅绕过本 hook 自己的 blocker，确认框场景三行搞定）
- 两层错误处理、两个阶段：Router 上的全局 `errorHandler`，路由级 `errorComponent`（接收 `{error, ctx}`）——`errorComponent` 既渲染 resolve 期失败（loader/守卫/search，无 `ctx.phase`），也渲染组件子树的渲染期抛错（`ctx.phase === 'render'`，由路由级错误边界捕获，渲染崩溃不会越过路由炸到 React 根，正如浏览器对任何加载失败都有错误页）
- 路由级 `pendingComponent` 骨架屏：仅当没有可保留的旧视图时（冷启动、刷新、错误后的重新导航）渲染，取匹配链上最近祖先的；应用内导航依旧保留旧视图，不会闪骨架屏
  - 应用内导航保留旧视图是浏览器原生语义的有意设计，见 core 仓库 README 的设计原则章节
- SSR：`resolveServerView`（来自 `@native-router/react/server`）渲染视图并内联数据载荷；客户端 `hydrate` 复用载荷，零重复请求
- Tree-Shaking 友好：`sideEffects: false`，未用到的组件与 hooks 会被摇掉

## 匹配语义

- 路由按**声明顺序**匹配，先匹配者优先——不按特异性排序。
- **没有 `path`** 的路由是布局路由：匹配空前缀，子路由对完整剩余路径继续匹配。
- 叶子子路由声明 **`path: ''`** 时匹配父路由之下的任意剩余路径。声明在具体兄弟之后时，它充当父路由的索引路由（并兜底父路径下未匹配的路径）。
- **尾部斜杠敏感**：`/users/` 不会匹配 `/users`。
- 匹配**区分大小写**。
- 嵌套层级的参数**深层覆盖浅层**合并（`mergeMatchedParams`）：`/:id` + `/posts/:id` 时深层的 `id` 生效。

## Link 拦截

`Link`（以及委托给它的 `PrefetchLink`/`NavLink`）只拦截普通的鼠标左键点击。以下情况放行浏览器默认行为：

- 修饰键点击（⌘/Ctrl/Shift/Alt）与非左键
- `target="_blank"`、`target="_parent"` 或 `target="_top"`
- `rel` 含 `external`
- 已被 `defaultPrevented` 的事件

用户传入的 `onClick` 先行执行（收到同一事件），在其中调用 `e.preventDefault()` 即完全取消导航。链接发起的导航进行中时，该链接上的后续点击会被忽略。

## 用自己的组件渲染（`as`）

`Link`、`NavLink`、`PrefetchLink`、`TypedLink`、`TypedNavLink` 与 `TypedPrefetchLink` 都接受 `as` 组件：链接改用它渲染而不是裸 `<a>`，设计系统的链接组件一行即可获得 SPA 导航、激活态与预取：

```tsx
import {NavLink} from '@native-router/react';
import {NavLink as HazeNavLink} from 'haze-ui';

<NavLink as={HazeNavLink} to="/help" variant="primary">
  Help
</NavLink>
```

对 `as` 组件的契约：

- **转发 ref 并把 rest props 透传**到它渲染的 DOM 元素上——下面的一切都依赖它（`href`、组合后的 `onClick` 与 `aria-current` 必须到达 DOM）。
- **组件自有 props 直接写在链接上**（如上面的 `variant`）：与链接自身 props 不冲突的 props 会被摊平进来并做 TypeScript 检查——必填 props 保持必填，非法取值是编译错误。
- **冲突 props 走 `asProps`**：只接受组件与链接基础 props 共有的键（如 `title`/`target` 这类锚点属性），且在运行时最后展开、显式覆盖基础值。没有共有键时该 prop 退化为 `{}`——没有歧义。

导航语义始终由链接掌管：`href` 永远是 `to` 计算出的目标，点击处理永远是组合后的那套（用户 `onClick` → 拦截守卫 → 应用内导航），`NavLink` 的 `aria-current` 永远是其激活态值——它们不可被覆盖，`asProps` 也不行。`ref` 是 `as` 组件自己的：未用 `forwardRef` 包裹的组件在编译期就会拒绝 `ref`。

`TypedLink` 在模式收窄之上叠加 `as`——两个类型参数都要显式给出，部分实例化不会推断剩下的那个：

```tsx
<TypedLink<RoutePaths<typeof routes>, typeof HazeNavLink>
  to="/users/:id"
  params={{id: '7'}}
  variant="primary"
>
  User 7
</TypedLink>
```

`TypedNavLink` 与 `TypedPrefetchLink` 是唯一的例外：单类型实参下也能接 `as` 组件（`<TypedNavLink<Paths> to="/" end as={HazeNavLink} />`），此时组件自有 props 不做检查；两个类型实参都给才有上面的完整检查。

`PrefetchLink` 的预取策略在 `as` 组件下全部可用；`viewport` 策略观察的是组件转发 ref 的那个 DOM 节点，若组件从不把 ref 透传到 DOM 元素，viewport 预取自然不会触发。

## 为什么 `useData` 手动标注类型

`useData<T>()` 的注解与路由 `data` loader 的返回类型没有编译期关联——注解本身就是契约。这是刻意为之。评估过两种闭环方案（2026-08），均被否决：

- **from 参数**（`useData('/articles/:slug')`，按路径字面量索引路由表映射——TanStack `useLoaderData({from})` 的形态）：否决。它迫使每个视图感知自己恰好被挂载到哪个路径下。数据与视图的匹配是路由配置层的职责；视图应该知道「我渲染什么」，而不是「我被挂载在哪」。
- **data-props 协议**：把 `component` 约束为 `ComponentType<{data: D}>`，由 `createRoutes` 在配置处检查 loader 输出与之匹配。检查点落在了正确的层，但深层子组件此后需要 props 逐层透传才能拿到数据。

保留现状：视图不感知路径、无 props 透传、仅一处局部注解。仅当 TypeScript 或本库日后出现既不耦合路径也不透传 props 的通道时再议。

## 安装

```bash
npm i @native-router/react
```

`@native-router/core` 会作为依赖一起安装。

## 使用

```tsx
import {View, HistoryRouter as Router} from '@native-router/react';
import type {Route} from '@native-router/react';
import Loading from '@/components/Loading';
import RouterError from '@/components/RouterError';
import * as userService from '@/services/user';

const routes = {
  component: () => import('./Layout'), // 布局组件里渲染 <View /> 输出子路由
  children: [
    {
      path: '/',
      component: () => import('./Home')
    },
    {
      path: '/users',
      component: () => import('./UserList'),
      data: userService.fetchList,
      // 冷启动/刷新时的骨架屏；应用内导航保留旧视图，不会渲染它
      pendingComponent: () => <UserListSkeleton />
    },
    {
      path: '/users/:id',
      component: () => import('./UserProfile'),
      // 守卫在视图解析前执行；返回路径字符串即重定向
      async beforeLoad({params}) {
        if (!await canView(+params.id)) return '/login';
      },
      // data 接收 {matched, index, router, location, params, search, signal}；
      // 导航被取代/取消时 ctx.signal 会 abort
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

在视图里读取页面数据与参数：

```tsx
import {useData, useMatched} from '@native-router/react';

export default function UserProfile() {
  const user = useData<User>(); // 当前层级的 data，类型化读取
  const {params} = useMatched(); // 累积到当前层级的参数
  return <h1>{user!.username}(#{params.id})</h1>;
}
```

视图顶部的进度条只是 `useLoading`：

```tsx
import {useLoading} from '@native-router/react';

export default function Loading() {
  const loading = useLoading();
  return loading?.status === 'pending' ? <div className="bar" /> : null;
}
```

读写查询串：

```tsx
import {useSearchParams} from '@native-router/react';

function Pager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = searchParams.get('page') ?? '1';

  function go(next: number) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(next));
    setSearchParams(params); // 默认 push
    // setSearchParams(params, {replace: true}); // 或改写当前条目
  }

  return <button onClick={() => go(+page + 1)}>下一页</button>;
}
```

像原生应用一样恢复滚动位置（放在 Router 内）：

```tsx
import {ScrollRestoration} from '@native-router/react';

// 在布局组件中：
<ScrollRestoration /> // back/forward 复原、push 重置；resetOnPush={false} 可关闭
```

挂载时它还会把 `history.scrollRestoration` 设为 `manual`：浏览器自身的 `auto` 恢复会与组件的恢复竞争、在离开条目的偏移尚未读完时就抢先滚动，因此整个会话期间滚动恢复由组件全权负责（卸载时不回写 `auto`）。

用 schema 校验并类型化 search——任何 zod/valibot/arktype schema 都可以，路由只讲 [Standard Schema](https://standardschema.dev)。在路由上声明一次，search 就会在 resolve 期间解析：`data` loader 与 `beforeLoad` 守卫都拿到类型化的 `ctx.search`（数字已转换、默认值已应用），非法 search 则经既有错误层失败——先路由级 `errorComponent`，否则全局 `errorHandler`。

用 `createRoutes` 构建路由表，类型自动闭环：返回表上每层的 `ctx.search` 从该层自己的 schema 推导，`Route<P, S>` 泛型与回调注解都不再需要。（字面量内直接写的回调按宽松 `Route` 检查——`ctx.search: any`——TypeScript 无法用同级属性做上下文类型；精确类型在返回表上成立，与 schema 矛盾的回调注解会在属性处被拒。）

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
      // typeof routes → 本层 ctx.search: {page: number; tag?: string}
      data: ({search}) => fetchArticles(search.page, search.tag),
      errorComponent: ({error}) => <p>{error.message}</p>
    }
  ]
});

function ArticleList() {
  const articles = useData<Article[]>(); // 类型化读取，无需 as
  const {page} = useSearch(listSearch); // 与 ctx.search 一致的解析结果
  const raw = useSearch(); // 退化的原始对象：{page: '2'} 字符串
  // ...
}
```

手工注解的路由对象仍可用显式泛型——写了就优先：

```tsx
const listRoute = {
  path: '/articles',
  search: listSearch,
  component: () => import('./ArticleList')
} as Route<'/articles', {page: number; tag?: string}>;
```

不带 schema 的 `useSearch()` 退化为 `parseSearchInput` 的原始输入对象（字符串；重复键是数组），路由上无需声明 schema。两种写法都在每次 location 变化时重渲染；schema 需同步校验。

用同一 schema 写 search——`useSetSearch(schema)` 在任何导航前校验下一个值，拒绝时抛 `SearchError`（带 schema 的 issues）且不触碰 location，写入的是 schema 自身的输出，缺省值已补齐：

```tsx
import {useSearch, useSetSearch} from '@native-router/react';

function Pager() {
  const {page} = useSearch(listSearch);
  const setSearch = useSetSearch(listSearch);

  function go(next: number) {
    setSearch({page: String(next)}); // push；{replace: true} 改写当前条目
  }
  // ...
}
```

给整个 router 一份自己的上下文——依赖、配置、i18n 句柄——不用模块单例：给 Router 组件（或 `createRouter`）传 `context`，每个 `data` loader 与 `beforeLoad` 守卫都从 `ctx.context` 拿到它，每实例一份。每个测试一个 router，fixture 不串；每个微前端面板一个 router，面板之间不共享状态。

```tsx
import {HistoryRouter, View} from '@native-router/react';

const routerContext = {api, i18n};

<HistoryRouter routes={routes} context={routerContext}>
  <View />
</HistoryRouter>;

// 路由里：ctx.context 就是上面传入的那个值
{
  path: '/articles',
  data: ({context}) => context.api.fetchArticles()
}
```

- 值是创建时固化的同步快照——不是响应式 store，变更不会触发任何重新解析
- 类型由 prop 推导进 router 实例（`router.context`）；不传则为 `undefined`——现有接入的类型与行为零改动
- 要给 `ctx.context` 精确类型，给 `Route` 第三个泛型——`Route<'/articles', Search, typeof routerContext>`——或注解回调的 ctx；未注解的 loader 看到的是 `any`（与 `ctx.search` 的宽松默认同一处理——路由表声明在 router 之前）
- `createRouter(routes, history, {context})`、`<Router>`、`<HistoryRouter>`、`<HashRouter>`、`<MemoryRouter>` 都可传

让 `Link` 目标类型安全：用 `createRoutes` 构建路由表（`satisfies` 语义的 identity 函数，保留全部 `path` 字面量），用 `RoutePaths` 提取模式联合，再把 `TypedLink` 收窄到该联合。`params` 按目标模式的参数段检查——`:name` 要 string，`*name` 要 string 数组：

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
// @ts-expect-error '/help' 不在表内
<TypedLink<AppPaths> to="/help">Help</TypedLink>
// @ts-expect-error '/users/:id' 必须带 params
<TypedLink<AppPaths> to="/users/:id">User ?</TypedLink>
```

点击时把 params 插值进模式（值做百分号编码，wildcard 段以 `/` 连接）；缺必填参数会抛错而不导航——类型层校验的运行时兜底。`as Route` 断言会把所有 `path` 拓宽成 `string`，`RoutePaths` 退化为 `string`，`TypedLink` 退化为普通 `Link`——迁移是可选的。

`TypedNavLink` 与 `TypedPrefetchLink` 把同样的收窄带给激活态链接与预取链接——`to` 收窄到表内、`params` 按模式判别，`NavLink`/`PrefetchLink` 的全部能力（`end`、`caseSensitive`、激活态 `className`/`style`/`children` 回调、`ariaCurrent`、`prefetch` 策略）原样保留：

```tsx
import {TypedNavLink} from '@native-router/react';
import type {RoutePaths} from '@native-router/react';

<TypedNavLink<RoutePaths<typeof routes>> to="/" end>Home</TypedNavLink>
<TypedNavLink<RoutePaths<typeof routes>> to="/users/:id" params={{id: '7'}}>
  User 7
</TypedNavLink>
// @ts-expect-error '/help' 不在表内
<TypedNavLink<RoutePaths<typeof routes>> to="/help">Help</TypedNavLink>
```

激活态按插值后的目标计算；缺必填参数点击时抛错而不导航（你自己的 `onClick` 已 `preventDefault` 时则静默跳过）。两者都支持 `as` 组合：单类型实参——`<TypedNavLink<Paths> to="/" end as={MyLink} variant="primary" />`——`as` 组件自身的 props 不做检查（第一个类型实参给出后 TypeScript 无法推断第二个）；两个都给——`<TypedNavLink<Paths, typeof MyLink> ... />`——则与 `TypedLink` 同等的完整检查。

渲染错误不会越过路由崩溃：该层解析出的视图外包了路由级错误边界，它用同一路由的 `errorComponent` 渲染并带 `ctx.phase === 'render'`（resolve 期的兜底不带 `phase`）。无路由 `errorComponent` 时错误交给全局 `errorHandler`；边界在恢复后继续工作——重试按钮可 `refresh(router)`，导航离开则正常渲染下一个视图。

查看 [完整示例](./demos)。

## 开发

`@native-router/react`（本包）与 `@native-router/core` 是**两个独立仓库**，并肩 clone 即可。vitest 配置把 `@native-router/core` 别名到 `../core/src`，测试无需任何安装层链接即可吃到最新 core 源码（npm 安装的 `@native-router/core` 仍保留，供类型与生产构建使用）。

```bash
pnpm install
pnpm start     # 示例开发服务器
pnpm test:run  # react 测试
```

react 的类型检查与生产构建从 npm registry 解析 core，本仓库需要消费未发布的 core API 时先发布 core。

## 文档

[API](https://native-router.github.io/react/modules.html)
