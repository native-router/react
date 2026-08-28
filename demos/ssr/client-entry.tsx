import {hydrateRoot} from 'react-dom/client';
import {routes} from '@/views';
import {Router} from '@native-router/react';
import {hydrate} from '@native-router/react/ssr';
import {StrictMode} from 'react';

hydrate(routes, {baseUrl: import.meta.env.BASE_URL.slice(0, -1)}).then(
  ({router}) =>
    hydrateRoot(
      document.getElementById('root')!,
      <StrictMode>
        {/* no children: the Router renders the store view, whose
            hydration render matches the server HTML and later
            navigations update through the same store */}
        <Router router={router} />
      </StrictMode>
    )
);
