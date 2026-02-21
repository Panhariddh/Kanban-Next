'use client';

import { useApolloClient, useQuery } from '@apollo/client/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gql } from '@apollo/client';

const ME = gql`
  query {
    me {
      id
      email
      name
      avatar
    }
  }
`;

type MeResponse = {
  me: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
  } | null;
};

export default function Navbar() {
  const router = useRouter();
  const client = useApolloClient();
  const { data } = useQuery<MeResponse>(ME);

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    await client.clearStore();
    router.replace('/login');
    router.refresh();
  };

  return (
    <div style={{
      padding: '12px 20px',
      background: '#111827',
      color: 'white',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ fontWeight: 'bold' }}>
        <Link href="/home">Kanban App</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* USER INFO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={data?.me?.avatar || 'https://ui-avatars.com/api/?name=' + (data?.me?.name || 'User')}
            alt="avatar"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />

          <span style={{ fontSize: 14 }}>
            {data?.me?.name}
          </span>
        </div>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          style={{
            background: 'red',
            color: 'white',
            border: 'none',
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}