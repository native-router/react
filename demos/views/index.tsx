import {View, Router, Link} from 'native-router-react';
import {ReactNode} from 'react';
import Layout from './Layout';
import Loading from '@/components/Loading';
import RouterError from '@/components/RouterError';

export default function App() {
  return (
    <Router<ReactNode>
      routes={{
        path: '',
        async action({next}) {
          const children = await next();

          return (
            children && (
              <Layout
                navigation={
                  <ul>
                    <li>
                      <Link to="/">Home</Link>
                    </li>
                    <li>
                      <Link to="/users">Users</Link>
                    </li>
                    <li>
                      <Link to="/help">Help</Link>
                    </li>
                    <li>
                      <Link to="/about">About</Link>
                    </li>
                  </ul>
                }
              >
                {children}
              </Layout>
            )
          );
        },
        children: [
          {
            path: '/',
            action: () => import('./Home').then(({default: Home}) => <Home />)
          },
          {
            path: '/users',
            action: () =>
              Promise.all([
                import('./UserList'),
                import('@/services/user').then((p) => p.fetchList())
              ]).then(([{default: UserList}, users]) => (
                <UserList users={users} />
              ))
          },
          {
            path: '/users/:id',
            action: (ctx, {id}) =>
              Promise.all([
                import('./UserProfile'),
                import('@/services/user').then((p) => p.fetchById(+id))
              ]).then(([{default: UserProfile}, user]) => (
                <UserProfile {...user!} />
              ))
          },
          {
            path: '/help',
            action: () => import('./Help').then(({default: Help}) => <Help />)
          },
          {
            path: '/about',
            action: () =>
              import('./About').then(({default: About}) => <About />)
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
