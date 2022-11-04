# native-router-react

> A route close to the native experience for react.

## Features

- Asynchronous navigation
- Cancelable
- Page data concurrent fetch
- Prefetch and preview
- Most unused code can be tree-shaking

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
See [demos](/demos/) for a complete example.

## API 
- Link

```ts
  import {Link} from 'native-router-react';
  <Link to="/">home</Link>
```
- refresh
- useRouter
```ts
import {Link, refresh, useRouter} from 'native-router-react';

type Props = {
  error: Error;
};

export default function RouterError({error}: Props) {
  const router = useRouter();
  return (
    <section>
      <h1>Error</h1>
      <pre>{error.stack}</pre>
      <button type="button" onClick={() => refresh(router)}>
        Refresh
      </button>
    </section>
  );
}


```
- PrefetchLink
```ts
import {PrefetchLink} from 'native-router-react';
import {ComponentProps, useState} from 'react';
import Preview from './Preview';

export default function PreviewLink({
  children,
  ...props
}: ComponentProps<typeof PrefetchLink>) {
  const [visible, setVisible] = useState(false);
  return (
    <PrefetchLink {...props}>
      <span
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </span>
      <Preview visible={visible} />
    </PrefetchLink>
  );
}

```
- usePrefetch
```ts
import {usePrefetch} from 'native-router-react';
import Popover from './Popover';

type Props = {
  visible: boolean;
};

export default function Preview({visible}: Props) {
  const {view, loading, error} = usePrefetch();
  if (!visible) return null;
  if (loading) return <Popover>loading</Popover>;
  if (error) return <Popover>error</Popover>;
  if (view) return <Popover>{view}</Popover>;
  return null;
}

```
- cancel
- useloading
```ts
import {css} from '@linaria/core';
import {CSSProperties, ReactPortal, useMemo, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {cancel, useLoading, useRouter} from 'native-router-react';

export default function Loading(): ReactPortal | null {
  const router = useRouter();
  const [percent, setPercent] = useState<number>(0);
  const el = useMemo(() => document.createElement('div'), []);

  const loading = useLoading();
  const {key, status} = loading || {};

  useEffect(() => {
    setPercent(0);
  }, [key]);

  // eslint-disable-next-line consistent-return
  useEffect(() => {
    const remove = () => {
      if (el.parentElement) document.body.removeChild(el);
    };

    if (status === undefined) {
      remove();
    } else if (status === 'pending') {
      remove();
      document.body.appendChild(el);

      const timer = setInterval(() => {
        setPercent((p) => {
          if (p >= 80) return p;
          return p + 30;
        });
      }, 500);

      return () => clearInterval(timer);
    } else if (status === 'resolved') {
      setPercent(100);
      const timer = setTimeout(remove, 500);
      return () => {
        clearTimeout(timer);
        remove();
      };
    }
  }, [status]);

  return createPortal(
    <button
      data-testid="loading"
      type="button"
      title="Click to cancel!"
      onClick={() => cancel(router)}
    >
    </button>,
    el
  );
}

```
- path regexp  
See [path-to-regexp](https://github.com/pillarjs/path-to-regexp)
