import {css} from '@linaria/core';
import {ReactNode, useEffect, useMemo} from 'react';
import {createPortal} from 'react-dom';

export default function Popover({children}: {children: ReactNode}) {
  const el = useMemo(() => document.createElement('div'), []);

  useEffect(() => {
    document.body.appendChild(el);
    return () => {
      el.parentElement?.removeChild(el);
    };
  }, []);

  return createPortal(
    <div
      className={css`
        position: fixed;
        transform: scale(0.2);
        transform-origin: bottom right;
        width: 100vw;
        height: 100vh;
        bottom: 0;
        right: 0;
        overflow: auto;
        z-index: 1000;
        border: solid 1px #ccc;
        border-radius: 4px;
        background: #fff;
        pointer-events: none;
      `}
    >
      {children}
    </div>,
    el
  );
}
