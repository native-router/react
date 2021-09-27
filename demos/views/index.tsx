import { View, Router, Link } from 'native-router-react';
import Layout from './Layout';
import { sleep } from '@/util';
import Loading from '@/components/Loading';

export default function App() {
  return (
    <Router<any>
      routes={{
        path: '',
        async action({ next }) {
          const r = await next();
          if (!r) {
            return null;
          }
          const { default: Child } = r;
          await sleep(3000);

          return (
            Child && (
              <Layout
                navigation={
                  <ul>
                    <li>
                      <Link to="/">Home</Link>
                    </li>
                    <li>
                      <Link to="/about">About</Link>
                    </li>
                  </ul>
                }
              >
                <Child />
              </Layout>
            )
          );
        },
        children: [
          { path: '/', action: () => import('./Home') },
          { path: '/about', action: () => import('./About') },
        ],
      }}
      baseUrl="/demos"
    >
      <View />
      <Loading />
    </Router>
  );
}
