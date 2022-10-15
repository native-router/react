import {Link, useRouter} from 'native-router-react';

type Props = {
  error: Error;
};

export default function RouterError({error}: Props) {
  const {refresh} = useRouter();
  return (
    <section>
      <h1>Error</h1>
      <pre>{error.stack}</pre>
      <button type="button" onClick={refresh}>
        Refresh
      </button>
      <Link to='/'>home</Link>
    </section>
  );
}
