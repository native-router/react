import {hydrateRoot} from 'react-dom/client';
import App, {routes} from '@/views';
import {resolveClientView} from 'native-router-react';

resolveClientView(routes, {baseUrl: process.env.BASE_URL?.slice(0, -1)}).then(
  (view) => {
    hydrateRoot(document.getElementById('root')!, <App initial={view} />);
  }
);
