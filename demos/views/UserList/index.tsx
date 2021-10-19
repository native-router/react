import { User } from '@/types/user';
import { css } from '@linaria/core';
import { Link } from 'native-router-react';

export default function UserList({ users }: { users: User[] }) {
  return (
    <div>
      <h1
        className={css`
          text-align: center;
        `}
      >
        User List
      </h1>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            <Link to={`/users/${user.id}`}>{user.username}</Link>
          </li>
        ))}
        <li>
          <Link to={`/users/3`}>user 3(lost)</Link>
        </li>
      </ul>
    </div>
  );
}
