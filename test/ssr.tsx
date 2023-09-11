import sinon from 'sinon';
import {resolveClientView, resolveServerView} from '@@/ssr';
import {render} from '@testing-library/react';
import ReactDOMServer from 'react-dom/server';
import {useData} from '@native-router/react';

describe('SSR', () => {
  afterEach(async () => {
    sinon.restore();
  });

  it('should hydrate without error', async () => {
    const route = {path: '/', component: () => Test, data: () => 'data'};
    return resolveServerView(route, '/')
      .then((view) => {
        const html = ReactDOMServer.renderToString(view);
        document.body.innerHTML = `<div id="root">${html}</div>`;

        // eslint-disable-next-line no-eval
        eval(document.body.querySelector('script')!.innerHTML);
      })
      .then(() => resolveClientView(route))
      .then((view) => {
        const warnSpy = sinon.spy(console, 'error');
        render(view, {
          container: document.getElementById('root')!,
          hydrate: true
        });
        // @ts-ignore
        warnSpy.should.not.be.called();
      });
  });
});

function Test() {
  const data = useData();
  return (
    <div>
      test <span>{data}</span>
    </div>
  );
}
