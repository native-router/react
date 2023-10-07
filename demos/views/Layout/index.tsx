import {css} from '@linaria/core';
import {Link, View} from '@native-router/react';

export default function Layout() {
  return (
    <section
      className={css`
        display: flex;
        height: 100vh;
        align-items: stretch;

        & > * {
          overflow: auto;
        }
      `}
    >
      <nav
        className={css`
          width: 200px;
          flex: none;
          border-right: 1px dashed;
        `}
      >
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/users">Users</Link>
          </li>
          <li>
            <Link to="/help">Help</Link>
          </li>
          <li>
            <Link to="/about">About</Link>
          </li>
        </ul>
        modes
        <ul>
          <li>
            <a href={process.env.BASE_URL}>history</a>
          </li>
          <li>
            <a href={`${process.env.BASE_URL}?hash`}>hash</a>
          </li>
          <li>
            <a href={`${process.env.BASE_URL}?memory`}>memory</a>
          </li>
        </ul>
        <a href="//native-router.github.io/react/">docs</a>
      </nav>
      <main
        className={css`
          flex: auto;
        `}
      >
        <View />
      </main>
    </section>
  );
}

export const globals = css`
  :global() {
    body {
      margin: 0;
    }
  }
`;
