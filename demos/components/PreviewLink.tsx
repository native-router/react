import {PrefetchLink} from '@native-router/react';
import {ComponentProps, useState} from 'react';
import Preview from './Preview';

export default function PreviewLink({
  children,
  ...props
}: ComponentProps<typeof PrefetchLink>) {
  const [visible, setVisible] = useState(false);
  return (
    <PrefetchLink {...props}>
      <span
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </span>
      <Preview visible={visible} />
    </PrefetchLink>
  );
}
