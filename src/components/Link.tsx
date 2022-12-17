import {createHref, navigate} from '@@/router';
import type {MouseEvent, ReactNode} from 'react';
import {useRouter} from './Router';

type Props = {
  to: string;
  // eslint-disable-next-line react/require-default-props
  children?: ReactNode;
};

/**
 * Link for navigate in app.
 * @param props
 * @group Components
 */
export default function Link({to, ...rest}: Props) {
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
