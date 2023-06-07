# Native Router React

> 接近原生体验的 React 路由库。

[English](./README.md) | 简体中文

## 特性

- 异步导航
- 可取消
- 页面视图和数据并发拉取
- 链接页面预加载及预览
- 轻量小巧，Tree-Shaking 友好

## 安装

```bash
npm i native-router-react
```

## 使用

```tsx
import {View, HistoryRouter as Router} from 'native-router-react';
import Loading from '@/components/Loading';
import RouterError from '@/components/RouterError';
import * as userService from '@/services/user';

export default function App() {
  return (
    <Router
      routes={{
        component: () => import('./Layout'),
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
            data: ({id}) => userService.fetchById(+id)
          },
          {
            path: '/help',
            component: () => import('./Help')
          },
          {
            path: '/about',
            component: () => import('./About')
          }
        ]
      }}
      baseUrl="/demos"
      errorHandler={(e) => <RouterError error={e} />}
    >
      <View />
      <Loading />
    </Router>
  );
}

```

查看 [完整示例](/demos/)。

## 文档 

[API](https://wmzy.github.io/native-router-react/modules.html)
