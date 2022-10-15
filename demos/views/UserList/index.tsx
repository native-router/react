import {css} from '@linaria/core';
import {PrefetchLink, useData} from 'native-router-react';
import {User} from '@/types/user';
import Preview from '@/components/Preview';

export default function UserList() {
  const users = useData() as User[];
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
            <PrefetchLink to={`/users/${user.id}`}>
              {user.username}
              <Preview />
            </PrefetchLink>
          </li>
        ))}
        <li>
          <PrefetchLink to="/users/3" data-testid="lost">
            user 3(lost)
            <Preview />
          </PrefetchLink>
        </li>
      </ul>
    </div>
  );
}
