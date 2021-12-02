import {css} from '@linaria/core';
import {useData} from 'native-router-react';
import {User} from '@/types/user';

export default function UserProfile() {
  const {username, description} = useData() as User;
  return (
    <div
      className={css`
        text-align: center;
      `}
    >
      <h1>{username}</h1>
      <p>{description}</p>
    </div>
  );
}
