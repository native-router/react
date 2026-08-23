import {createHref, navigate} from '@native-router/core';
import type {LinkProps} from '@@/types';
import {useRef, type MouseEvent} from 'react';
import {useRouter} from './Router';
import {shouldNavigate} from './link-behavior';

/**
 * Link for navigate in app.
 * @param props
 * @group Components
 */
export default function Link({to, ...rest}: LinkProps) {
  const router = useRouter();
  const lockRef = useRef(false);

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Modified clicks, other buttons and links to another browsing context
    // keep the browser default behavior (open in new tab/window, etc).
    if (!shouldNavigate(e, rest.target, rest.rel)) return;
    e.preventDefault();

    if (lockRef.current) return;
    lockRef.current = true;
    navigate(router, to)
      .catch(() => undefined)
      .finally(() => {
        lockRef.current = false;
      });
  }
  return (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a {...rest} href={createHref(router, to)} onClick={handleClick} />
  );
}
