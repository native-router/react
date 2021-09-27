import { css } from '@linaria/core';
import type { CSSProperties, ReactPortal } from 'react';
import {
  useMemo,
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useProgress } from 'native-router-react';

export default function Loading(): ReactPortal | null {
  const progress = useProgress();
  const [percent, setPercent] = useState(0);
  const el = useMemo(() => document.createElement('div'), []);

  const isLoading = progress !== undefined;

  useEffect(() => {
    if (!isLoading) return () => {};
    const timer = setInterval(() => setPercent((p) => p + (1 - p) / 2), 100);
    return () => {
      clearInterval(timer);
      setPercent(0);
    };
  }, [isLoading]);

  useEffect(() => {
    document.body.appendChild(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  if (progress === undefined) return null;

  return createPortal(
    <div
      className={css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        z-index: 1000;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
      `}
    >
      <div
        style={{ '--loading-percent': `${percent * 100}%` } as CSSProperties}
        className={css`
          width: var(--loading-percent);
          background: blue;
          height: 4px;
        `}
      />
    </div>,
    el
  );
}