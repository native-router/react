import { css } from '@linaria/core';
import { CSSProperties, ReactPortal, useRef } from 'react';
import {
  useMemo,
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useLoading, useRouter } from 'native-router-react';

export default function Loading(): ReactPortal | null {
  const {cancel} = useRouter();
  const isLoading = useLoading();
  const [percent, setPercent] = useState<number>();
  const el = useMemo(() => document.createElement('div'), []);
  const animationRef = useRef(false);

  useEffect(() => {
    if (!isLoading) return () => {};

    setPercent(p => {
      if (p === undefined) return 0;
      animationRef.current = true;
      return undefined;
    });
    return () => setPercent(100);
  }, [isLoading]);

  useEffect(() => {
    if (percent === undefined) {
      if ( !animationRef.current) return;
      animationRef.current = false;
      setPercent(0);
    } else if (percent === 0) {
      setPercent(90);
    } else if (percent === 100) {
      const timer = setTimeout(() => setPercent(undefined), 600);
      return () => clearTimeout(timer);
    }
  }, [percent]);

  useEffect(() => {
    document.body.appendChild(el);
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  if (percent === undefined) return null;

  return createPortal(
    <div
      onClick={cancel}
      className={css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 8px;
        z-index: 1000;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;

        &:hover {
          height: 24px;
        }
      `}
    >
      <div
        style={{ '--loading-percent': `${percent}%`, transition: `width ${percent === 100 ? 0.5 : 5}s` } as CSSProperties}
        className={css`
          width: var(--loading-percent);
          background: blue;
          height: 100%;
        `}
      />
    </div>,
    el
  );
}