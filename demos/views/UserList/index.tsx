import {css} from '@linaria/core';
import {useData} from 'native-router-react';
import {User} from '@/types/user';
import PreviewLink from '@/components/PreviewLink';

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
            <PreviewLink to={`/users/${user.id}`}>{user.username}</PreviewLink>
          </li>
        ))}
        <li>
          <PreviewLink to="/users/3" data-testid="lost">
            user 3(lost)
          </PreviewLink>
        </li>
      </ul>
    </div>
  );
}
