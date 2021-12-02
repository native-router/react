import {
  render,
  fireEvent,
  waitFor,
  screen,
  waitForElementToBeRemoved,
  configure
} from '@testing-library/react';
import App from '@/views';

declare const $jsdom: any;

describe('Router', () => {
  before(() => {
    configure({
      asyncUtilTimeout: 999999
    });

    const s = global.setTimeout;
    // @ts-ignore
    global.setTimeout = (fn, delay) => s(fn, Math.max(delay / 1000, 30));
  });

  beforeEach(() => {
    $jsdom.reconfigure({url: 'http://localhost:3000/demos/'});
    render(<App />);
  });

  it('should render home page successfully', async () => {
    const loading = screen.getByTestId('loading');
    await waitForElementToBeRemoved(loading);
    screen.getByText('Hello World!').should.not.be.empty();
  });

  it('should navigate to user list page successfully', async () => {
    const userListLink = await waitFor(() => screen.getByText('Users'));
    fireEvent.click(userListLink);
    await waitFor(() => screen.getByTestId('loading'));
    screen.getByText('Hello World!').should.not.be.empty();
    window.location.href.should.be.equal('http://localhost:3000/demos/');

    await waitForElementToBeRemoved(screen.getByTestId('loading'));
    window.location.href.should.be.equal('http://localhost:3000/demos/users');
    screen.getByText('User List').should.not.be.empty();
  });

  it('should navigate to error page successfully', async () => {
    const userListLink = await waitFor(() => screen.getByText('Users'));
    fireEvent.click(userListLink);

    const lostLink = await waitFor(() => screen.getByTestId('lost'));
    fireEvent.click(lostLink);
    const refreshButton = await waitFor(() => screen.getByText('Refresh'));

    window.location.href.should.be.equal('http://localhost:3000/demos/users/3');
    screen.getByText('Error').should.not.be.empty();
    fireEvent.click(refreshButton);
    await waitFor(() => screen.getByTestId('loading'));
  });
});
