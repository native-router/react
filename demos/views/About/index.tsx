import {css} from '@linaria/core';

/**
 * About 页面
 */
export default function About() {
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        align-items: center;
      `}
    >
      <h1>About Native Router</h1>
      <p>
        Native Router is another router lib which work like the native browser.
      </p>
    </div>
  );
}
