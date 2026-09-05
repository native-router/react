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
- `useSearchParams` 读写查询串：默认 push，传 `{replace: true}` 则改写当前条目；`useSetSearch(schema)` 是 `useSearch(schema)` 的写入侧孪生——写入前用同一 schema 校验，拒绝时抛 `SearchError` 且不导航，写入的是 schema 自身的输出（缺省值已补齐）；`writeSchema(schema, defaults)`（core 导出）派生写侧投影，等于缺省的键被抹去，URL 保持干净
- 类型化 search：任意路由 `search` 字段可声明 Standard Schema 校验器（zod/valibot/arktype，无硬依赖），resolve 时解析——`data` loader 与 `beforeLoad` 守卫都拿到类型安全的 `ctx.search`，非法 search 经既有错误层失败；组件里用 `useSearch(schema?)` 读取，无 schema 时退化为原始对象
- search 与 params 类型闭环：`createRoutes(routes)` 重写返回表的类型，每层的 `data`/`beforeLoad` `ctx.search` 从该层自己的 schema 输出推导，`ctx.params` 从匹配前缀的 path 字面量累积推导（`beforeLoad` 额外尊重前缀 `params` schema 的输出）——不再需要 `Route<P, S>` 泛型或回调注解；无参数的层保持宽松 `Record<string, string>`，显式写出的 `Route<P, S>` 泛型仍优先
- `createRoute(path, search?, config)` 工厂：一次构建一层路由，回调在编写时就拿到类型——schema 作为第二个参数让 `ctx.search` 编写时即类型化，path 参数让 `ctx.params` 同样；两参形式把 schema 留在 config 里，返回路由同样精确重类型
- 基于 `searchDeps` 的 search 精细失效（`Route` 字段，经 `createRoutes` 原样透传给 core）：在每层声明本层解析消费的 search 键，同路径导航若每层投影不变，直接复用当前视图快照——零守卫、零 loader、零懒加载；`useSearchParams`/`useSetSearch` 的写入（push 与 `{replace: true}`）走同一快路径，`useSetSearch(schema)` 写前仍对整体做 schema 校验
- 类型安全的链接：`createRoutes(routes)` 校验路由表同时保留全部 `path` 字面量，`RoutePaths<typeof routes>` 提取模式联合（穿透嵌套、保留参数段），`<TypedLink<RoutePaths<...>> to params>` 把 `to` 收窄到表内、按目标模式检查 `params`——路径不存在、参数缺失/类型错误都是编译错误，点击时插值加编码是运行时兜底；`TypedNavLink`/`TypedPrefetchLink` 把同样的收窄带给激活态链接与预取链接
- Router 上下文：Router 组件的 `context` prop（或 `createRouter` 的 `context` 选项）给每个 router 实例固化一份同步值，每个 `data` loader 与 `beforeLoad` 守卫都从 `ctx.context` 拿到——按实例注入依赖（API client、配置、i18n）而无需模块单例；不传则为 `undefined`，现有接入零改动
- 路由级 context：路由可再声明自己的 `context` 对象，覆盖合并（同名 key 路由优先）在该层及其全部更深层级上——`beforeLoad` 看到累积到自身层级的合并，每个 `data` loader 看到累积到它自己层级的合并；`createRoutes` 返回表与 `Route<P, S, C, RC>` 第四泛型都闭环了类型，从不声明的表拿到的仍是原样的实例值
- `ScrollRestoration`：按历史条目恢复滚动位置，back/forward 复原、push 重置（`resetOnPush` 可关闭）
- `viewTransition` prop 让导航接入浏览器 View Transitions API：`true` 仅对 push 导航做动画，谓词按 `{action, to, from}` 逐次判定；方向感通过过渡 `types` 交给 `:active-view-transition-type(push|pop)` CSS 消费，不支持的浏览器降级为普通导航
- 路由级 `preload(router, to)` 预解析共享视图：并发去重 + 30 秒 TTL；`PrefetchLink` 的预取即走此通道
- Hooks：`useRouter`、`useView`、`useData<T>(name?)`（当前层级 data 的类型化读取，或祖先路由的具名数据——注解可用 `RouteDataOf` 从 loader 推导，不必手写）、`useMatched`（匹配层级、参数、location）、`useLoading`、`usePrefetch`、`useSearch(schema?)`、`useSetSearch(schema)`、`useBlocker(fn)`（未保存变更守卫：core 的 `setBlocker` 否决——谓词是放行语义，返回 `true` 放行导航、`false` 否决导航，不是「返回 true 阻止」；组件挂载期间注册、始终以最新闭包被询问；每次否决都记录在返回值的 `blocker.state` 上，并带 `proceed()`/`reset()` 通道——`proceed()` 重试被否决的导航，仅绕过本 hook 自己的 blocker，确认框场景三行搞定）
- Router 组件的 `notFound` prop：`NotFoundError`（未匹配路径，或守卫/loader 为缺失数据抛出）渲染声明的节点/组件作为该条目的已提交视图，不再白屏——仅对 `NotFoundError` 优先于 `errorHandler`，其他错误保持既有通道
- 两层错误处理、两个阶段：Router 上的全局 `errorHandler`，路由级 `errorComponent`（接收 `{error, ctx}`）——`errorComponent` 既渲染 resolve 期失败（loader/守卫/search，无 `ctx.phase`），也渲染组件子树的渲染期抛错（`ctx.phase === 'render'`，由路由级错误边界捕获，渲染崩溃不会越过路由炸到 React 根，正如浏览器对任何加载失败都有错误页）
- 路由级 `pendingComponent` 骨架屏：仅当没有可保留的旧视图时（冷启动、刷新、错误后的重新导航）渲染，取匹配链上最近祖先的；应用内导航依旧保留旧视图、不会闪骨架屏——除非 Router 通过 `pendingDelayMs` 选择加入：导航挂起超过该时长即把旧视图切为骨架屏
  - 应用内导航保留旧视图是浏览器原生语义的有意设计，见 core 仓库 README 的设计原则章节
- SSR：`resolveServerView`（来自 `@native-router/react/server`）渲染视图并内联数据载荷；客户端 `hydrate` 复用载荷，零重复请求
- Tree-Shaking 友好：`sideEffects: false`，未用到的组件与 hooks 会被摇掉

## 匹配语义

- 收集所有匹配链，**最特异者胜出**：逐段比较，静态文本优于动态 `:param`，动态优于 splat `*wildcard`，且每个段都累加进链的得分——更长的链（钉住更多 URL）胜过更短的链。得分相同的链退回**声明顺序**决胜。前缀匹配到但子路由全部失败的父路由不会遮蔽后续兄弟路由——例如 `[{path: '/a', children: [{path: '/b'}]}, {path: '/*rest'}]` 中 `/a/q` 由通配路由兜底。
- **没有 `path`** 的路由是布局路由：匹配空前缀，子路由对完整剩余路径继续匹配。
- 叶子子路由声明 **`path: ''`** 时匹配父路由之下的任意剩余路径，充当父路由的索引路由（并兜底父路径下未匹配的路径）——以真实段匹配的兄弟路由按特异性胜过它，声明位置不再起决定作用。
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

## View Transitions（视图过渡）

`viewTransition` prop 让导航接入浏览器的 [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)——零动画代码即可让路由视图交叉淡入淡出：

```tsx
import {HistoryRouter as Router, View} from '@native-router/react';

<Router routes={routes} viewTransition>
  <View />
</Router>
```

库只负责**时序**：每个通过判定的导航都提交在 `document.startViewTransition(() => flushSync(render))` 内，DOM 在过渡回调中同步更新，浏览器才能正确截取前后两帧。过渡打开期间，挂起的新视图只在回调内提交——期间其它渲染源（loading 状态、POP 之后紧跟的内部 replace）读到的仍是旧视图，不会有任何抢先于截帧的提交。库**不给任何元素挂 `view-transition-name`、不注入 CSS**：动画范围完全由你的样式表决定。

**`true` 只对 push 做动画。** `pop` 命中的是 `viewStack` 快照——动画只会拖慢返回；`replace`（守卫重定向、`refresh`）保持静默。谓词则按 `{action: 'push' | 'replace' | 'pop', to, from}` 逐次判定：

```tsx
// push 从右侧滑入，back/forward 镜像滑出：
<Router
  routes={routes}
  viewTransition={({action}) => action === 'push' || action === 'pop'}
>
  <View />
</Router>
```

每个做动画的导航都会带上方向作为[过渡 type](https://developer.chrome.com/docs/web-platform/view-transitions/same-document)——`push` 或 `pop`，replace 不带——CSS 侧据此区分方向：

```css
/* 默认交叉淡入淡出无需任何 CSS；这里加方向感 */
::view-transition-old(root) {animation: 200ms ease both vt-out;}
::view-transition-new(root) {animation: 200ms ease both vt-in;}
/* pop 反向播放同一组动画 */
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

### 配方一 —— 整页过渡（零 CSS）

只要页面里没有任何 `view-transition-name`，整个文档就是单一的 `root` 快照：仅 `viewTransition` 一项即得到浏览器默认的交叉淡入淡出，无需任何配置。

### 配方二 —— 只动画视图出口

嵌套布局、`MemoryRouter` 小部件、master-detail 分栏：圈出要动画的区域，冻结其余部分。给视图出口挂上全文档唯一的 `view-transition-name`，再让 `root` 组保持静止：

```tsx
<main className="outlet">
  <View />
</main>
```

```css
.outlet {
  view-transition-name: outlet;
}
/* 冻结页面外壳：只有 outlet 组在动画 */
::view-transition-group(root) {
  animation: none;
}
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
/* outlet 自身交叉淡入淡出（或按上面 root 的写法做滑动） */
::view-transition-group(outlet) {
  animation-duration: 200ms;
}
```

`view-transition-name` 必须**全文档唯一**——一个名字只挂一个元素，两个元素同名会让过渡被跳过。

### 并发：每文档同时只有一个过渡

浏览器语义：同一文档同时只跑一个 view transition，新开一个会 skip 前一个。两个 router 同时开动画（嵌套 SPA、多个 `MemoryRouter` 面板）会互相 skip；给内层 router 用谓词收敛，或只让其中一个做动画。库不做运行时干预。

### 无障碍

尊重 `prefers-reduced-motion`：

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

### 支持面

- 同文档 View Transitions：Chrome/Edge 111+、Safari 18+、Firefox 139+
- 过渡 `types`（方向标签）：Chrome/Edge 129+、Safari 18.2+——通过一次性行为探测识别（只接受 callback 的旧实现对 options 形态同步抛 `TypeError`）；其余环境过渡照常运行，只是没有方向 type，`:active-view-transition-type(...)` 选择器不再命中
- 完全没有 View Transitions（jsdom、旧浏览器）：普通导航，什么也不发生

## `useData` 的类型标注

`useData<T>()` 的注解与路由 `data` loader 的返回类型没有编译期关联——注解本身就是契约。这是刻意为之。评估过两种闭环方案（2026-08），均被否决：

- **from 参数**（`useData('/articles/:slug')`，按路径字面量索引路由表映射——TanStack `useLoaderData({from})` 的形态）：否决。它迫使每个视图感知自己恰好被挂载到哪个路径下。数据与视图的匹配是路由配置层的职责；视图应该知道「我渲染什么」，而不是「我被挂载在哪」。
- **data-props 协议**：把 `component` 约束为 `ComponentType<{data: D}>`，由 `createRoutes` 在配置处检查 loader 输出与之匹配。检查点落在了正确的层，但深层子组件此后需要 props 逐层透传才能拿到数据。

保留现状：视图不感知路径、无 props 透传、仅一处局部注解。

既不耦合路径也不透传 props 的通道后来以类型工具的形态落地：`RouteDataOf` 从 loader 本身推导注解——路由表挂的就是同一个引用——注解因此不可能偏离 `route.data` 实际 resolve 的类型：

```tsx
const loadUser = ({params, signal}) =>
  userService.fetchById(+params.id, {signal}); // → Promise<User>

{path: '/users/:id', data: loadUser, component: () => UserView}

// UserView —— 仍是一处局部注解，但从「断言」变成「校验」
const user = useData<RouteDataOf<typeof loadUser>>(); // User | undefined
```

零运行时、零新增调用点参数。嵌套链上每层经自己的 loader 取型（与运行时最近 Provider 规则对齐——视图读到的是自己所在层的数据），无 `data` 的层读作 `undefined`，工具解析不了的一切输入退化为 `unknown`——裸 `useData()` 的宽度——绝不变成编译错误。手写 `useData<Article>()` 在写出的地方始终优先。

## 数据加载配方

裸 loader 加 `useData<RouteDataOf<...>>()` 足以支撑简单路由表。当应用长大——实体缓存、DevTool 造数、mutation 要寻址路由 loader 产出的同一份数据——可扩展的形态是按实体收敛的三元组：一次工厂调用把同一个 fetch 同时绑定到路由表、视图读取和组件/mutation 通道：

```tsx
// [loader, useData, queryFn] —— 每实体一次声明
const [loadArticle, useArticle, queryArticle] = createDataLoader({
  fetch: (slug: string, signal?: AbortSignal) =>
    api.get(`/articles/${slug}`, {signal}), // 唯一的 fetch
  cache: articleCache, // 按 key 的实体缓存：[slug] → Article
  keyOf: (ctx) => [ctx.params.slug], // 路由 ctx → 缓存 key，只此一处定义
  staleTime: 30_000
});

// 路由表按引用挂 loader
{path: '/articles/:slug', data: loadArticle, component: () => ArticleView}

// 视图读取与同一 loader 同型，optionality 体现在返回类型上
const article = useArticle(); // Article —— 本路由声明了该 loader
const maybe = useArticle({optional: true}); // Article | undefined —— 共用
// 组件也可能被挂在没挂该 loader 的路由下

// 路由生命周期之外的读取与 mutation 寻址同一实体
const fresh = useQuery(queryArticle, [slug]);
invalidate(queryArticle, [slug]);
```

为什么一个工厂收拢三者：

- **`loader`** —— 路由表按引用挂载的东西。引用身份兼任 DEV 来源校验：hook 内 `route.data === loadArticle` 证明视图读到的就是本 loader resolve 的值。声明身份而非结果指纹——同 loader 不同参数、乐观写穿、SWR 旧值先行三个场景都会伪造指纹。
- **`useData`** —— 视图读取，必有/可选语义收进返回类型：裸调用断言本路由声明了该 loader，数据在视图挂载前必已 resolve（pending 与错误由 `pendingComponent`/`errorComponent` 接管）；`{optional: true}` 覆盖共用组件也可能渲染在无该 loader 路由下的场景。
- **`queryFn`** —— 同一 fetch × 缓存的绑定，供路由生命周期之外的读取；mutation 经 loader resolve 的同一 key 写入与失效，路由通道与组件通道因此不会漂移。

工厂本身是应用层胶水——缓存库、mock 层、DEV 校验——不是路由库 API。提炼自基于本路由构建的参考 SPA 模板 **painless**（完整实现见其 `src/util/dataLoader.ts`：双通道缓存、DevTool 造数、DEV 身份校验俱在）。

## 无 `<Await>` 的延迟数据

TanStack Router 内置了延迟数据原语：loader 对次要数据不 await、直接返回 promise，视图用 `<Await>` 包住它，页面随 settle 流式补齐。本路由刻意不做——答案是上面两条通道加原生 React 的组合：

- **首屏必需数据走 loader，阻塞式 resolve。** 视图整体提交——冷启动由 `pendingComponent` 兜底，应用内导航保留旧视图直到新视图就绪——关键路径上没有任何客户端 promise 管道，且每个已提交的视图都是完整快照（后退/前进、预取预览、视图过渡全部建立在它上面）。
- **次要数据——评论、侧栏、推荐——走组件通道，从不阻塞。** 组件自己经 `queryFn` 取数，loading 态长在数据渲染的地方：painless 的评论列表在上方文章已可交互时渲染自己的 `Spinner`（`src/views/Article/CommentList.tsx`，绑定见 `src/services/dataloaders.ts`）。
- **想要 `<Await>` 的人体工学——声明式 fallback 而非手写 loading 标记？** 这正是 React `<Suspense>` 的本职，react-toolroom 的 `useSuspenseResult` 把在途结果递给它：读取者挂起直到首个结果存在，驱动方在边界外发起取数。同样的延迟效果，标准件组合，零路由 API 介入：

```tsx
import {Suspense} from 'react';
import {useRun, useSuspenseResult} from 'react-toolroom/async';

function ArticleComments({slug}: {slug: string}) {
  const fetchComments = useInjectable(queryComments);
  useRun(fetchComments, [slug]); // 在边界外——被挂起子树的 effect 不会跑
  return (
    <Suspense fallback={<Spinner />}>
      <CommentReader fetchComments={fetchComments} />
    </Suspense>
  );
}

function CommentReader({fetchComments}: {fetchComments: typeof queryComments}) {
  const comments = useSuspenseResult(fetchComments); // 只挂起一次
  return comments.map((c) => <Comment key={c.id} {...c} />);
}
```

取舍：`<Await>` 给你 promise 类型的 loader 返回与路由管流的流式提交，代价是部分提交；本路由保持提交原子性，把延迟渲染下放到组件层——Suspense、错误边界与实体缓存本就住在那里。**painless** 是两条通道的活参考，通道切分的论证见其 `decisions.md`。

## Search 精细失效

同路径的 search 变化——翻页、筛选、收起面板——默认重解析整条链：每层的 `beforeLoad`、`data` loader 与懒加载 `component` 全部重跑，无论变化多小。`searchDeps`（`Route` 字段，随 core 继承）让每层声明自己解析消费哪些 search 键。推荐形态即 painless 的真实用法：根布局声明 `[]`（只渲染出口、不消费 search），叶子路由声明自己 loader 消费的键：

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
  searchDeps: [], // 布局层完全不消费 search
  children: [
    {
      path: '/',
      search: homeSearch,
      searchDeps: ['tag', 'offset', 'limit'], // loader 读哪些键就声明哪些
      component: () => import('./Home'),
      data: ({search}) => fetchArticles(search)
    }
  ]
});
```

- **快路径**：导航目标为同 pathname、匹配链上**每层都声明了 `searchDeps`**、每层投影在当前条目与目标之间不变 → 当前视图快照直接作为新条目提交：零守卫、零 loader、零懒加载，与 POP 命中视图栈是同一条路径。`navigate()` 与 `useSearchParams`/`useSetSearch` 的两个写入分支（push 与 `{replace: true}`）都走它——判定即 core 的 `reusableEntry`
- **链上覆盖是全有或全无**：任一层未声明 → 每次导航整链重解析——本特性之前的行为，逐字节一致。所以布局层也要声明 `[]`：漏一层，整链退回每次 search 变化都重解析
- **schema 与守卫消费的键也算消费**：快路径不跑 `beforeLoad`，守卫读取的 search 键不声明，键变化时守卫就不会重跑。但 `search` schema 本身不会被跳过：复用快照前目标的原始 search 会过匹配链上每层的 schema，被拒即放弃快路径，`SearchError` 经既有错误层（路由 `errorComponent`，否则全局 `errorHandler`）呈现，非法值不会免校验落进 URL——与手写非法 URL 的失败完全一致。`useSetSearch(schema)` 无论声明了哪些键，写前仍对整体做 schema 校验
- **复用的视图是快照**：保留产生该视图那次 resolve 的 `data` 与 matched `ctx`；活 search 用 `useSearch`/`useSearchParams` 读——它们订阅 history、恒最新——不要从 matched 上下文读。`hash`/`state` 同样永不参与比较：全声明链上纯 hash 导航也复用快照
- **无 View Transition、滚动照常**：复用导航的视图引用未变，不会触发动画；`ScrollRestoration` 的 `resetOnPush` 照常把新 push 条目滚回顶部
- `invalidate()` 清掉快照后快路径失效直到下一次真实 resolve；POP 回放、`initHistoryStack` 预热与 `refresh()` 不受影响

## 与 TanStack Router 的结构性差异

本 README 里的四项能力——视图栈、`searchDeps`、`useBlocker` 与 `viewTransition`——看起来像功能点，实际上每一项都是一种架构承诺，TanStack Router 对它们要么做法不同、要么没有对应物。下文关于 TanStack 的表述均核对自其当前文档（[tanstack.com/router](https://tanstack.com/router/latest/docs/framework/react/overview)）；native-router 侧的表述即源码行为。逐概念的迁移映射见 [docs/from-tanstack-router.md](./docs/from-tanstack-router.md)。

### `viewStack`：后退落在快照上，不是落在 loader 缓存上

每次提交的导航都会把已解析的视图存进路由器的内存视图栈；POP 直接命中该快照——不重新匹配路由、不跑守卫、不跑 loader、零请求。会话栈以有界尾部窗口的形式序列化进 `history.state`（`maxStackDepth`，默认 100）从而在刷新后幸存，启动时自动恢复，再用 `@native-router/core` 的 `initHistoryStack` 预热一次（上文的 `StackWarmer` 是示例组件模式，不是库的导出）。

TanStack Router 没有对应物：后退就是一次普通导航——路由重新匹配，由其内置 SWR 缓存决定 loader 重跑什么。缓存以解析后的 pathname 加 `loaderDeps` 为键；`beforeLoad` 链无论如何每次导航都跑；默认 `staleTime: 0` 下，重新进入同一 loader key 会在后台 revalidate——即默认情况下后退会重新发请求，再靠 `staleTime`/`gcTime`/`shouldReload` 调优收敛。

这个差异是结构性的，不是缓存调参问题：快照保留的是*解析产物视图*——同一个元素，连同它 resolve 期的 `data` 与匹配 `ctx`、已导入的懒 `component`——后退重新挂载的页面无需重跑任何东西、也无需等待（条目滚动偏移由 `ScrollRestoration` 复原；React 状态并不保留——组件是重新挂载的）。而 loader 缓存把数据重新喂给重新挂载的组件，默认过期策略下 loader 还会再跑一遍。「后退绝不运行用户代码」是视图栈的属性，不是缓存的一种配置。

### `searchDeps`：一次什么也不跑的 search 变化

同路径的 search 变化，若**匹配链上每层都声明了 `searchDeps`** 且所有声明的投影都没变，当前视图快照直接重新提交——零守卫、零 loader、零懒加载，与 POP 走的是同一条路径。链上覆盖是全有或全无：任一层未声明即恢复此前「每次导航都重解析」的行为，逐字节一致。上一节的接线规则原样适用：守卫读取的 search 键必须声明，否则键变化时守卫不会重跑（`search` schema 不会被跳过——复用快照前目标会先过校验）；`useSetSearch(schema)` 导航前仍对整体做校验。

TanStack 最接近的旋钮是 `loaderDeps`，方向恰好相反：`loaderDeps` 是缓存*键*——deps 变了该路由就 reload，没变时默认的过期策略仍会在后台 revalidate；`beforeLoad` 两种情况都照跑。不存在哪种配置能让一次 search 变化真的什么也不跑。

结构上这是 `viewStack` 机制在会话中途的应用——视图从未离开组件树，重新提交同一个元素引用会让 React 跳过该子树，组件状态得以保留——这也是为什么它无法靠把缓存调得「足够新鲜」来复现。

### `useBlocker`：回摆在库内完成

被否决的浏览器 POP 会被自动推回——core 自己回摆 history，不留下悬空的前进条目。询问面是 `{state, proceed, reset}`：`proceed()` 是一次性放行，且只绕过本 hook 自己的 blocker（其余已注册 blocker 与守卫链仍会被询问），重试是一次全新的 push 导航。谓词是同步的允许列表——返回 `true` 放行、`false` 否决、抛错视同否决（fail-closed）——在每次导航开头、POP 落位前被同步询问；`refresh` 与守卫重定向永不被拦。

TanStack 的 `useBlocker({shouldBlockFn, withResolver, enableBeforeUnload})` 返回 `{status, proceed, reset}`，同样经由其 history 层拦截 popstate。谓词极性相反（`shouldBlockFn` 返回 `true` 是*拦截*，这里返回 `true` 是*放行*——脏检查要反过来写），决策可以是异步的（`withResolver` 延迟决断），`enableBeforeUnload` 还把浏览器的 unload 对话框耦合进 hook。这里决策在 history 事件内同步完成，回摆因此是即时的，确认 UI 三个 prop 就能接上——差异在分工，而不只是拼写。

### `viewTransition`：库管时序，CSS 管范围

库把提交包进 `document.startViewTransition(() => flushSync(render))`，并置于提交闸门之后——过渡打开期间，store 快照持续返回旧视图，只有过渡回调提交新视图，因此任何东西（loading 重渲染、POP 之后的窗口同步）都无法抢在浏览器截旧帧之前提交。方向挂在过渡 `types` 上（`:active-view-transition-type(push|pop)`），`true` 只动画 push——`pop` 落在 `viewStack` 快照上，动画只会拖慢后退——谓词按 `{action, to, from}` 逐导航决断。库从不挂 `view-transition-name`、从不注入 CSS；动画什么完全由调用方的样式表决定。

TanStack Router 按导航（`Link`/`navigate` 上的 `viewTransition`）或全路由器（`defaultViewTransition`）开启：`true` 把导航包进 `startViewTransition()`，没有方向过滤；`ViewTransitionOptions.types` 由你自己从 `{fromLocation, toLocation, pathChanged, …}` 计算类型标签（返回 `false` 则跳过过渡）。那边动画范围同样是调用方的 CSS——这一半属于平台而非某个库。差异在默认谓词（push-only，因为 pop 是快照命中）、action→types 的自动映射，以及提交闸门是文档化行为而非实现细节。

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

未匹配路径渲染点什么，别白屏——Router 组件的 `notFound` prop（ReactNode 原样渲染，或组件类型无 props 挂载）：

```tsx
<HistoryRouter routes={routes} notFound={() => <NotFoundPage />}>
  <View />
</HistoryRouter>;
```

解析以 core 的 `NotFoundError` 拒绝时——未匹配路径，或守卫/loader 为缺失数据抛出——声明的节点成为该条目的已提交视图，后退/前进回到该条目会重放它。`notFound` 仅对 `NotFoundError` 优先于 `errorHandler`；其他错误保持既有 `errorHandler` 通道，不传该 prop 一切不变。

应用内导航保留旧视图直到新视图就绪（视图栈设计）。慢导航想要骨架屏，用 `pendingDelayMs` 选择加入——导航挂起超过该时长，最近的 `pendingComponent` 顶替旧视图直到导航落定；阈值内就 resolve 的 loader 永远不闪：

```tsx
<HistoryRouter routes={routes} pendingDelayMs={300}>
  <View />
</HistoryRouter>;
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

滚动时序围绕视图提交编排，与 `viewTransition` 组合安全：离开偏移在历史事件上读取——早于视图提交，文档收缩钳制不了保存值；恢复在落地视图提交之后执行（过渡打开时经 view-transition 回调），`scrollTo` 不会落在离开文档的高度上被钳制。

用 schema 校验并类型化 search——任何 zod/valibot/arktype schema 都可以，路由只讲 [Standard Schema](https://standardschema.dev)。在路由上声明一次，search 就会在 resolve 期间解析：`data` loader 与 `beforeLoad` 守卫都拿到类型化的 `ctx.search`（数字已转换、默认值已应用），非法 search 则经既有错误层失败——先路由级 `errorComponent`，否则全局 `errorHandler`。

用 `createRoutes` 构建路由表，类型自动闭环：返回表上每层的 `ctx.search` 从该层自己的 schema 推导，`Route<P, S>` 泛型与回调注解都不再需要。（字面量内直接写的回调按宽松 `Route` 检查——`ctx.search: any`——TypeScript 无法用同级属性做上下文类型；精确类型在返回表上成立，与 schema 矛盾的回调注解会在属性处被拒。）

`ctx.params` 走同一闭环，从匹配前缀的 path 字面量累积推导：`data` loader 拿到累积的原始字符串 params，`beforeLoad` 守卫拿到经前缀 `params` schema 升级后的值。模式里没有参数的层保持宽松 `Record<string, string>`——精度是渐进的，既有路由表不会被重定型：

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
      // typeof routes → 本层 ctx.search: {page: number; tag?: string}，
      //                ctx.params: {slug: string}——零注解
      data: ({search, params}) => fetchArticles(params.slug, search.tag),
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

想一次写一层？`createRoute` 让回调在编写时就拿到类型——schema 走第二个参数，TypeScript 会从更早的参数做上下文推导，`ctx.search` 无需注解、无需经由返回表绕一圈：

```tsx
import {createRoute} from '@native-router/react';

const articleRoute = createRoute('/articles/:slug', listSearch, {
  component: () => import('./ArticleList'),
  // ctx.search: {page: number; tag?: string}，
  // ctx.params: {slug: string}——就在这里，编写时类型化
  data: ({search, params}) => fetchArticles(params.slug, search.tag)
});
```

两参形式——`createRoute('/articles/:slug', {search: listSearch, ...})`——把 schema 留在 config 里：`ctx.params` 仍从 path 编写时类型化，`ctx.search` 编写时退化为宽松 `SearchInput`，返回路由同样精确重类型。编写下的回调原样保留（返回类型也在，`RouteDataOf<typeof route.data>` 照常可用），经 `children` 嵌套的字面量累积与 `createRoutes` 表完全一致（`RoutePaths`/`TypedLink` 照常闭合）。

不带 schema 的 `useSearch()` 退化为 `parseSearchInput` 的原始输入对象（字符串；重复键是数组），路由上无需声明 schema。两种写法都在每次 location 变化时重渲染；schema 需同步校验。

用同一 schema 写 search——`useSetSearch(schema)` 在任何导航前校验下一个值，拒绝时抛 `SearchError`（带 schema 的 issues）且不触碰 location，写入的是 schema 自身的输出，缺省值已补齐。setter 的惯用法是 fire-and-forget：导航链上的失败（守卫抛错等）已被兜底，不会冒出 unhandled rejection；需要感知失败时 await 返回的 promise，它照常 reject：

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

写入 schema 自身的输出意味着缺省值会落进 query——每个链接都挂着 `?page=1`。要干净的 URL，用 `@native-router/core` 的 `writeSchema(schema, defaults)` 一次性派生写侧：它经同一读契约校验并抹去等于缺省的键，一份读 schema 管住双向，手写的写侧孪生不再需要：

```tsx
import {writeSchema} from '@native-router/core';

const listWrite = writeSchema(listSearch, {page: 1});
// useSetSearch(listWrite)：{page: 1} 写出 ''（干净），{page: 3} 写出 '?page=3'
const setSearch = useSetSearch(listWrite);
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

路由还可再声明自己的 `context`——覆盖合并（同名 key 路由优先）在该层及其全部更深层级上：

```tsx
const routes = createRoutes({
  component: () => import('./Layout'),
  context: {theme: 'light'}, // 布局级默认值
  children: [
    {
      path: '/admin',
      context: {role: 'admin'}, // 继承 theme，追加 role
      children: [
        {
          path: '/audit',
          // 该守卫的 ctx.context：{api, i18n, theme: 'light', role: 'admin'}
          beforeLoad: ({context}) => (context.role === 'admin' ? undefined : '/'),
          // 每个 data loader 只看到累积到自己层级的合并——
          // 布局的 loader 永远看不到更深层的声明
          data: ({context}) => context.api.fetchAuditLog()
        }
      ]
    }
  ]
});
```

不声明 `context` 的层级不贡献任何东西——从不声明路由 context 的表拿到的仍是原样的实例值。`createRoutes` 返回表上每层的 `ctx.context` 从自己的声明重类型；`Route` 泛型显式拼出合并形状——`Route<'/audit', any, AppContext, {role: 'admin'}>` 把 `ctx.context` 类型化为 `AppContext & {role: 'admin'}`。

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
