import {useRouter} from './components/Router';

/**
 * Get current route params
 * @group Hooks
 */
export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  const router = useRouter();
  const {matched, index} = router.state;
  if (!matched.length) return {} as T;
  return matched[index]?.params as T;
}

/**
 * Get current location
 * @group Hooks
 */
export function useLocation() {
  const router = useRouter();
  return router.state.location;
}
