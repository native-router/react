import { css } from '@linaria/core';
import { CSSProperties, ReactPortal, useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLoading, useRouter } from 'native-router-react';

export default function Loading(): ReactPortal | null {
  const { cancel } = useRouter();
  const [percent, setPercent] = useState<number>(0);
  const el = useMemo(() => document.createElement('div'), []);

  const loading = useLoading();
  const { key, status } = loading || {};

  useEffect(() => {
    setPercent(0);
  }, [key]);

  useEffect(() => {
    if (status === undefined) {
      if (el.parentElement) document.body.removeChild(el);
    } else if (status === 'pending') {
      if (el.parentElement) document.body.removeChild(el);
      document.body.appendChild(el);

      const timer = setInterval(() => {
        setPercent((p) => {
          if (p >= 80) return p;
          return p + 30;
        });
      }, 500);

      return () => clearInterval(timer);
    } else if (status === 'resolved') {
      setPercent(100);
      const timer = setTimeout(() => {
        if (el.parentElement) document.body.removeChild(el);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return createPortal(
    <div
      title="Click to cancel!"
      onClick={cancel}
      className={css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 12px;
        z-index: 1000;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        overflow: hidden;
        box-shadow: 0 10px 20px rgba(0, 0, 0, .5);
        cursor: pointer;

        &:hover {
          height: 24px;
        }
      `}
    >
      {percent ? (
        <div
          style={{ width: `${percent}%` } as CSSProperties}
          className={css`
            transition: width 0.5s;
            background: #ffa8b6;
            height: 100%;
            border-radius: 8px;
          `}
        />
      ) : null}
    </div>,
    el
  );
}
