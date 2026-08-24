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
- 可取消的异步导航：发起下一次导航会取代进行中的导航；`cancel(router)` 主动中止；history POP 也会取消
- `NavLink`：`isActive`/`isExactActive`、`end`、`caseSensitive` 与 `aria-current`（默认 `"page"`）；`className`/`style`/`children` 支持 `({isActive, isExactActive})` 回调；`to="/"` 对所有路径都是激活态
- `useSearchParams` 读写查询串：默认 push，传 `{replace: true}` 则改写当前条目
- 类型化 search：任意路由 `search` 字段可声明 Standard Schema 校验器（zod/valibot/arktype，无硬依赖），resolve 时解析——loader 拿到类型安全的 `ctx.search`，非法 search 经既有错误层失败；组件里用 `useSearch(schema?)` 读取，无 schema 时退化为原始对象
- `ScrollRestoration`：按历史条目恢复滚动位置，back/forward 复原、push 重置（`resetOnPush` 可关闭）
- 路由级 `preload(router, to)` 预解析共享视图：并发去重 + 30 秒 TTL；`PrefetchLink` 的预取即走此通道
- Hooks：`useRouter`、`useView`、`useData<T>(name?)`（当前层级 data 的类型化读取，或祖先路由的具名数据）、`useMatched`（匹配层级、参数、location）、`useLoading`、`usePrefetch`、`useSearch(schema?)`
- 两层错误处理：Router 上的全局 `errorHandler`，路由级 `errorComponent`（接收 `{error, ctx}`）
- 路由级 `pendingComponent` 骨架屏：仅当没有可保留的旧视图时（冷启动、刷新、错误后的重新导航）渲染，取匹配链上最近祖先的；应用内导航依旧保留旧视图，不会闪骨架屏
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

链接发起的导航进行中时，该链接上的后续点击会被忽略。

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
      // data 接收 {matched, index, router, location, params}
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

用 schema 校验并类型化 search——任何 zod/valibot/arktype schema 都可以，路由只讲 [Standard Schema](https://standardschema.dev)。在路由上声明一次，search 就会在 resolve 期间解析：`data` loader 拿到类型化的 `ctx.search`（数字已转换、默认值已应用），非法 search 则经既有错误层失败——先路由级 `errorComponent`，否则全局 `errorHandler`。

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
  // ctx.search: {page: number; tag?: string} —— 已解析、已类型化
  data: ({search}) => fetchArticles(search.page, search.tag),
  errorComponent: ({error}) => <p>{error.message}</p>
} as Route<'/articles', {page: number; tag?: string}>;

function ArticleList() {
  const articles = useData<Article[]>(); // 类型化读取，无需 as
  const {page} = useSearch(listSearch); // 与 ctx.search 一致的解析结果
  const raw = useSearch(); // 退化的原始对象：{page: '2'} 字符串
  // ...
}
```

不带 schema 的 `useSearch()` 退化为 `parseSearchInput` 的原始输入对象（字符串；重复键是数组），路由上无需声明 schema。两种写法都在每次 location 变化时重渲染；schema 需同步校验。

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
