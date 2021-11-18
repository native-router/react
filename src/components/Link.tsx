import type {MouseEvent, ReactNode} from 'react';
import {useRouter} from './Router';

type Props = {
  to: string;
  // eslint-disable-next-line react/require-default-props
  children?: ReactNode;
};

export default function Link({to, ...rest}: Props) {
  const {navigate, createHref} = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    navigate(to);
  }
  return (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a {...rest} href={createHref(to)} onClick={handleClick} />
  );
}
