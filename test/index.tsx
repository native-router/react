import {
  render,
  fireEvent,
  waitFor,
  screen,
  waitForElementToBeRemoved,
  prettyDOM,
  cleanup
} from '@testing-library/react';
import {useFakeTimers} from 'sinon';
import App from '@/views';
import 'should';
import 'react-dom';

/** @typedef {import('should')} */

declare const $jsdom: any;

describe('Router', () => {
  before(() => {
    const s = global.setTimeout;
    global.setTimeout = (fn, delay) => {
      console.log(delay);
      return s(fn, delay / 1000);
    };
  });
  beforeEach(function () {
    // this.clock = useFakeTimers({
    //   shouldAdvanceTime: true,
    //   advanceTimeDelta: 1,
    //   toFake: ['Date', 'setTimeout', 'clearTimeout']
    // });
    $jsdom.reconfigure({url: 'http://localhost:3000/demos/'});
    render(<App />);
  });
  afterEach(function () {
    // this.clock.restore();
    cleanup();
  });

  it('should render home page successfully', async () => {
    const loading = screen.getByTestId('loading');
    await waitForElementToBeRemoved(loading);
    screen.getByText('Hello World!').should.not.be.empty();
  });

  it('should navigate to user list page successfully', async function () {
    const userListLink = await waitFor(() => screen.getByText('Users'));
    fireEvent.click(userListLink);
    await waitFor(() => screen.getByTestId('loading'));
    screen.getByText('Hello World!').should.not.be.empty();
    window.location.href.should.be.equal('http://localhost:3000/demos/');

    // this.clock.tick(999999);
    await waitForElementToBeRemoved(screen.getByTestId('loading'));
    window.location.href.should.be.equal('http://localhost:3000/demos/users');
    screen.getByText('User List').should.not.be.empty();
  });

  it.only('should navigate to error page successfully', async () => {
    // console.log(prettyDOM(screen.getByText(/./)), Date.now());
    const userListLink = await waitFor(() => screen.getByText('Users'));
    fireEvent.click(userListLink);

    const lostLink = await waitFor(() => screen.getByTestId('lost'), {
      timeout: 10000
    });
    // fireEvent.click(lostLink);
    // this.clock.tick(999999);
    // console.log(Date.now());

    // const refreshButton = await waitFor(() => screen.getByText('Refresh'));
    // window.location.href.should.be.equal('http://localhost:3000/demos/users/3');
    // screen.getByText('Error').should.not.be.empty();
    // fireEvent.click(refreshButton);
    // await waitFor(() => screen.getByTestId('loading'));
  });
});
