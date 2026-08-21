import {hydrateRoot} from 'react-dom/client';
import {routes} from '@/views';
import {hydrate, Router} from '@native-router/react';
import {StrictMode} from 'react';

hydrate(routes, {baseUrl: process.env.BASE_URL?.slice(0, -1)}).then(
  ({view, router}) =>
    hydrateRoot(
      document.getElementById('root')!,
      <StrictMode>
        <Router router={router}>{view}</Router>
      </StrictMode>
    )
);
