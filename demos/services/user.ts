/* eslint-disable no-console */
import {sleep} from '@/util';

const users = [
  {id: 1, username: 'user 1', description: '...'},
  {id: 2, username: 'user 2', description: '...'}
];

export async function fetchList() {
  console.log('fetch list start');
  await sleep(3000);
  console.log('fetch list done');
  return users;
}

export async function fetchById(id: number) {
  console.log('fetch by id start');
  await sleep(3000);
  console.log('fetch by id done');
  if (id > 2) throw new Error('Not Found');
  return users.find((user) => user.id === id);
}
