import {History, Path} from 'history';

export type Location<T = any> = Path & {state: T};
