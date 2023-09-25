import ReactDOMServer from 'react-dom/server';
import {resolveServerView} from '@native-router/react/server';
import type {Location} from '@native-router/core';
import {routes} from '../views';

type Options = Parameters<typeof resolveServerView>[2];

export default function render(location: Location | string, options?: Options) {
  return resolveServerView(routes, location, options).then((view) =>
    ReactDOMServer.renderToString(view)
  );
}
