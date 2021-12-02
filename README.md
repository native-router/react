# native-router-react

> A route close to the native experience for react.

## Features

- Asynchronous navigation
- Cancelable

## Install

```bash
npm i native-router-react
```

## Usage

```tsx
import {View, Router} from 'native-router-react';
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
