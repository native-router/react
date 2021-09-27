import type { ReactNode } from 'react';
import { css } from '@linaria/core';

type Props = {
  navigation: ReactNode;
  children: ReactNode;
};

export default function Layout({ navigation, children }: Props) {
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
        {navigation}
      </nav>
      <main
        className={css`
          flex: auto;
        `}
      >
        {children}
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
