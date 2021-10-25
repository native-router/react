import {sleep} from '@/util';

const users = [
  {id: 1, username: 'user 1', description: '...'},
  {id: 2, username: 'user 2', description: '...'}
];

export async function fetchList() {
  await sleep(3000);
  return users;
}

export async function fetchById(id: number) {
  await sleep(3000);
  if (id > 2) throw new Error('Not Found');
  return users.find((user) => user.id === id);
}
