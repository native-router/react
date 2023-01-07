import {createHref, navigate} from '@@/router';
import type {LinkProps} from '@@/types';
import type {MouseEvent} from 'react';
import {useRouter} from './Router';

/**
 * Link for navigate in app.
 * @param props
 * @group Components
 */
export default function Link({to, ...rest}: LinkProps) {
  const router = useRouter();

  // TODO: 防重复点击
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    navigate(router, to);
  }
  return (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a {...rest} href={createHref(router, to)} onClick={handleClick} />
  );
}
