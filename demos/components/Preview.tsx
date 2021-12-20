import {css} from '@linaria/core';
import {usePrefetch} from 'native-router-react';
import {ReactNode} from 'react';

function Popover({children}: {children: ReactNode}) {
  return (
    <span
      className={css`
        display: none;
        position: relative;

        a:hover > & {
          display: initial;
        }
      `}
    >
      <div
        className={css`
          position: absolute;
          width: 300px;
          height: 200px;
          top: 0;
          left: 0;
          overflow: auto;
          z-index: 1000;
          border: solid 1px #ccc;
          border-radius: 4px;
          background: #fff;
          pointer-events: none;
        `}
      >
        {children}
      </div>
    </span>
  );
}

export default function Preview() {
  const {view, loading, error} = usePrefetch();
  if (loading) return <Popover>loading</Popover>;
  if (error) return <Popover>error</Popover>;
  if (view) return <Popover>{view}</Popover>;
  return null;
}
