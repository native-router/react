import {createHref, navigate} from '@@/router';
import type {LinkProps} from '@@/types';
import {useRef, type MouseEvent} from 'react';
import {useRouter} from './Router';

/**
 * Link for navigate in app.
 * @param props
 * @group Components
 */
export default function Link({to, ...rest}: LinkProps) {
  const router = useRouter();
  const lock = useRef(false);

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();

    if (lock.current) return;
    lock.current = true;
    navigate(router, to).finally(() => (lock.current = false));
  }
  return (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a {...rest} href={createHref(router, to)} onClick={handleClick} />
  );
}
