import {Link, refresh, useRouter} from 'native-router-react';

type Props = {
  error: Error;
};

export default function RouterError({error}: Props) {
  const router = useRouter();
  return (
    <section>
      <h1>Error</h1>
      <pre>{error.stack}</pre>
      <button type="button" onClick={() => refresh(router)}>
        Refresh
      </button>
      <Link to="/">home</Link>
    </section>
  );
}
