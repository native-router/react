import {css} from '@linaria/core';
import {User} from '@/types/user';

export default function UserProfile({username, description}: User) {
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
