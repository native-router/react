/* eslint-disable no-console */
import {sleep} from '@/util';

const users = [
  {id: 1, username: 'user 1', description: '...'},
  {id: 2, username: 'user 2', description: '...'}
];

const log =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
    ? () => {}
    : console.log;

export async function fetchList() {
  log('fetch list start');
  await sleep(3000);
  log('fetch list done');
  return users;
}

export async function fetchById(id: number) {
  log('fetch by id start');
  await sleep(3000);
  log('fetch by id done');
  if (id > 2) throw new Error('Not Found');
  return users.find((user) => user.id === id);
}
