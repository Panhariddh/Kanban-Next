'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

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

      <div style={{ display: 'flex', gap: 10 }}>
        {/* <Link href="/home">Home</Link> */}

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