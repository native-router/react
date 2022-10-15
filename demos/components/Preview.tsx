import {usePrefetch} from 'native-router-react';
import Popover from './Popover';

type Props = {
  visible: boolean;
};

export default function Preview({visible}: Props) {
  const {view, loading, error} = usePrefetch();
  if (!visible) return null;
  if (loading) return <Popover>loading</Popover>;
  if (error) return <Popover>error</Popover>;
  if (view) return <Popover>{view}</Popover>;
  return null;
}
