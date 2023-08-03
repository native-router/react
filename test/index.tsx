import {
  render,
  fireEvent,
  waitFor,
  screen,
  waitForElementToBeRemoved,
  configure
} from '@testing-library/react';
import App from '@/views';
import {useFakeTimers} from './util';

declare const $jsdom: any;

describe('Router', () => {
  before(() => {
    process.env.BASE_URL = '/demos/';

    configure({
      asyncUtilTimeout: 999999
    });
  });

  beforeEach(function () {
    this.clock = useFakeTimers();
    $jsdom.reconfigure({url: 'http://localhost:3000/demos/'});
    render(<App />);
  });

  afterEach(async function () {
    const {history} = window;
    if (history.state.idx) history.go(-history.state.idx);
    await this.clock.runAllAsync();
    this.clock.restore();
  });

  it('should render home page successfully', async function () {
    this.clock.next();
    const loading = screen.getByTestId('loading');
    this.clock.runAllAsync();
    await waitForElementToBeRemoved(loading);
    screen.getByText('Hello World!').should.not.be.empty();
  });

  it('should navigate to user list page successfully', async function () {
    this.clock.runAllAsync();
    const userListLink = await waitFor(() => screen.getByText('Users'));
    fireEvent.click(userListLink);
    this.clock.tick(1000);
    const loading = await screen.findByTestId('loading');
    screen.getByText('Hello World!').should.not.be.empty();
    window.location.href.should.be.equal('http://localhost:3000/demos/');
    this.clock.tickAsync(10000);
    await waitForElementToBeRemoved(loading);
    window.location.href.should.be.equal('http://localhost:3000/demos/users');
    screen.getByText('User List').should.not.be.empty();
  });

  it('should navigate to error page successfully', async function () {
    this.clock.runAllAsync();
    const userListLink = await waitFor(() => screen.getByText('Users'));
    fireEvent.click(userListLink);
    await this.clock.runAllAsync();
    const lostLink = await waitFor(() => screen.getByTestId('lost'));
    fireEvent.click(lostLink);
    this.clock.tickAsync(1000);
    const refreshButton = await waitFor(() => screen.getByText('Refresh'));

    window.location.href.should.be.equal('http://localhost:3000/demos/users/3');
    screen.getByText('Error').should.not.be.empty();
    fireEvent.click(refreshButton);
    this.clock.nextAsync();
    await waitFor(() => screen.getByTestId('loading'));
  });

  it('should cancel navigate successfully', async function () {
    this.clock.runAllAsync();
    const userListLink = await waitFor(() => screen.getByText('Users'));
    fireEvent.click(userListLink);
    this.clock.tick(1000);
    const loading = await screen.findByTestId('loading');
    fireEvent.click(loading);
    loading.isConnected.should.be.false();
    window.location.href.should.be.equal('http://localhost:3000/demos/');
  });

  it('should cancel and navigate to another page successfully', async function () {
    this.clock.runAllAsync();
    const userListLink = await waitFor(() => screen.getByText('Users'));
    const aboutLink = screen.getByText('About');
    fireEvent.click(userListLink);
    this.clock.tick(1000);
    const loading = await screen.findByTestId('loading');
    fireEvent.click(aboutLink);
    await this.clock.tickAsync(10000);
    loading.isConnected.should.be.false();
    window.location.href.should.be.equal('http://localhost:3000/demos/about');
  });
});

describe('HashRouter', () => {
  before(() => {
    process.env.BASE_URL = '/demos/';

    configure({
      asyncUtilTimeout: 999999
    });
  });

  beforeEach(function () {
    this.clock = useFakeTimers();
    $jsdom.reconfigure({url: 'http://localhost:3000/demos/?hash#/'});
    const {history} = window;
    const {usr, ...s} = history.state;
    history.replaceState(s, '');
    render(<App />);
  });

  afterEach(async function () {
    await this.clock.runAllAsync();
    this.clock.restore();
  });

  it('should navigate to user list page successfully', async function () {
    await this.clock.tickAsync(100000);
    const userListLink = screen.getByText('Users');
    fireEvent.click(userListLink);
    this.clock.tickAsync(1000);
    const loading = await screen.findByTestId('loading');
    screen.getByText('Hello World!').should.not.be.empty();
    window.location.href.should.be.equal('http://localhost:3000/demos/?hash#/');
    this.clock.tickAsync(10000);
    await waitForElementToBeRemoved(loading);
    window.location.href.should.be.equal(
      'http://localhost:3000/demos/?hash#/users'
    );
    screen.getByText('User List').should.not.be.empty();
  });
});

describe('MemoryRouter', () => {
  before(() => {
    process.env.BASE_URL = '/demos/';

    configure({
      asyncUtilTimeout: 999999
    });
  });

  beforeEach(function () {
    this.clock = useFakeTimers();
    $jsdom.reconfigure({url: 'http://localhost:3000/demos/?memory'});
    render(<App />);
  });

  afterEach(async function () {
    await this.clock.runAllAsync();
    this.clock.restore();
  });

  it('should navigate to user list page successfully', async function () {
    this.clock.runAllAsync();
    const userListLink = await waitFor(() => screen.getByText('Users'));
    fireEvent.click(userListLink);
    this.clock.tick(1000);
    const loading = await screen.findByTestId('loading');
    screen.getByText('Hello World!').should.not.be.empty();
    window.location.href.should.be.equal('http://localhost:3000/demos/?memory');
    this.clock.tickAsync(10000);
    await waitForElementToBeRemoved(loading);
    window.location.href.should.be.equal('http://localhost:3000/demos/?memory');
    screen.getByText('User List').should.not.be.empty();
  });
});
