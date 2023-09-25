import {
  View,
  MemoryRouter,
  HashRouter,
  HistoryRouter,
  Route
} from '@native-router/react';
import Loading from '@/components/Loading';
import RouterError from '@/components/RouterError';
import * as userService from '@/services/user';
import type {ReactNode} from 'react';

export const routes = {
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
      data: ({params}) => userService.fetchById(+params.id)
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
} as Route;

export default function App({initial}: {initial?: ReactNode}) {
  const mode = window.location.search.slice(1).split('#', 1)[0];

  if (mode === 'hash') {
    return (
      <HashRouter
        routes={routes}
        // eslint-disable-next-line react/no-unstable-nested-components
        errorHandler={(e) => <RouterError error={e} />}
      >
        <View />
        <Loading />
      </HashRouter>
    );
  }

  if (mode === 'memory') {
    return (
      <MemoryRouter
        initialEntries={['/']}
        routes={routes}
        // eslint-disable-next-line react/no-unstable-nested-components
        errorHandler={(e: any) => <RouterError error={e} />}
      >
        <View />
        <Loading />
      </MemoryRouter>
    );
  }

  return (
    <HistoryRouter
      routes={routes}
      // baseUrl={import.meta.env.BASE_URL.slice(0, -1)}
      baseUrl={process.env.BASE_URL?.slice(0, -1)}
      // eslint-disable-next-line react/no-unstable-nested-components
      errorHandler={(e) => <RouterError error={e} />}
      currentView={initial}
    >
      <View />
      <Loading />
    </HistoryRouter>
  );
}
