[![npm](https://img.shields.io/npm/v/native-router-react.svg)](https://www.npmjs.com/package/native-router-react)
[![Build Status](https://github.com/wmzy/native-router-react/actions/workflows/ci.yml/badge.svg)](https://github.com/wmzy/native-router-react/actions)
[![Coverage](https://img.shields.io/codecov/c/github/wmzy/native-router-react.svg)](https://codecov.io/gh/wmzy/native-router-react)
[![install size](https://packagephobia.now.sh/badge?p=native-router-react)](https://packagephobia.now.sh/result?p=native-router-react)

# Native Router React

> 接近原生体验的 React 路由库。

[English](./README.md) | 简体中文

## 特性

- 异步导航
- 可取消
- 页面视图和数据并发拉取
- 链接页面预加载及预览
- 轻量小巧，Tree-Shaking 友好
- 支持 TreeShaking

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
