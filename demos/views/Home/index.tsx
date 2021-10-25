import {css} from '@linaria/core';
import {center} from '@/util/styles';
import HelloWorld from '@/components/HelloWorld';

export default function Home() {
  return (
    <div
      className={css`
        text-align: center;
      `}
    >
      <h1>Welcome to Native Router</h1>
      <HelloWorld className={center} />
    </div>
  );
}
