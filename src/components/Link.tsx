import type { MouseEvent, ReactNode } from 'react';
import { useRouter } from './Router';

type Props = {
  to: string;
  children?: ReactNode;
};

export default function Link({ to, ...rest }: Props) {
  const { history, navigate, router } = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    navigate(to);
  }
  return <a {...rest} href={router.baseUrl + history.createHref(to)} onClick={handleClick} />;
}
