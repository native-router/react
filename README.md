[![npm](https://img.shields.io/npm/v/@native-router/react.svg)](https://www.npmjs.com/package/@native-router/react)
[![Build Status](https://github.com/native-router/react/actions/workflows/ci.yml/badge.svg)](https://github.com/native-router/react/actions)
[![codecov](https://codecov.io/gh/native-router/react/graph/badge.svg?token=QIXC6HJH6Z)](https://codecov.io/gh/native-router/react)
[![install size](https://packagephobia.now.sh/badge?p=@native-router/react)](https://packagephobia.now.sh/result?p=@native-router/react)

# Native Router React

> A route close to the native experience for react.

English | [简体中文](./README-zh_CN.md)

## Features

- Asynchronous navigation
- Cancelable
- Page data concurrent fetch
- Link prefetch and preview
- Most unused features can be tree-shaking
- SSR support

## Install

```bash
npm i @native-router/react
```

## Usage

```tsx
import {View, HistoryRouter as Router} from '@native-router/react';
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
See [demos](/demos/) for a complete example.

## Documentation 

[API](https://native-router.github.io/react/modules.html)
