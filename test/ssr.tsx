import {afterEach, describe, expect, it, vi} from 'vitest';
import {hydrate, resolveServerView} from '@@/ssr';
import {act, render} from '@testing-library/react';
import ReactDOMServer from 'react-dom/server';
import {navigate} from '@native-router/core';
import {Router, useData} from '@native-router/react';

describe('SSR', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
    delete (window as any)._nativeRouterReactSSRData;
    document.body.innerHTML = '';
  });

  it('should hydrate without error', async () => {
    const route = {path: '/', component: () => Test, data: () => 'data'};
    const view = await resolveServerView(route, '/');
    const html = ReactDOMServer.renderToString(view);
    document.body.innerHTML = `<div id="root">${html}</div>`;
    eval(document.body.querySelector('script')!.innerHTML);

    const errorSpy = vi.spyOn(console, 'error');
    const {view: clientView, router} = await hydrate(route);
    render(<Router router={router}>{clientView}</Router>, {
      container: document.getElementById('root')!,
      hydrate: true
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should escape </script> in serialized data', async () => {
    const injection = `</script><script>alert("xss")</script>\u2028`;
    const route = {
      path: '/',
      component: () => Test,
      data: () => injection
    };
    const view = await resolveServerView(route, '/');
    const html = ReactDOMServer.renderToString(view);
    document.body.innerHTML = `<div id="root">${html}</div>`;

    const script = document.body.querySelector('script')!;
    expect(script.innerHTML).toContain('\\u003c');
    expect(script.innerHTML).not.toContain('</script>');

    // The escaped payload is still valid JavaScript and keeps the data intact.
    eval(script.innerHTML);
    expect((window as any)._nativeRouterReactSSRData.data[0]).toBe(injection);
  });

  it('should navigate with browser history after hydrate', async () => {
    const routes = [
      {path: '/', component: () => Test, data: () => 'data'},
      {path: '/other', component: () => Other}
    ];
    const view = await resolveServerView(routes, '/');
    const html = ReactDOMServer.renderToString(view);
    document.body.innerHTML = `<div id="root">${html}</div>`;
    eval(document.body.querySelector('script')!.innerHTML);

    const {view: clientView, router} = await hydrate(routes);
    render(<Router router={router}>{clientView}</Router>, {
      container: document.getElementById('root')!,
      hydrate: true
    });
    expect(router.history.createHref('/x')).toBe('/x');
    await act(() => navigate(router, '/other'));
    expect(window.location.pathname).toBe('/other');
  });
});

function Test() {
  const data = useData<string>();
  return (
    <div>
      test <span>{data}</span>
    </div>
  );
}

function Other() {
  return <div>other</div>;
}
