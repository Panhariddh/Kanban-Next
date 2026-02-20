import Navbar from "../components/NavBar";
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';


export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const cookieStore = cookies();
  const jwt = (await cookieStore).get('jwt');

  // Not logged in → redirect
  if (!jwt) {
    redirect('/login');
  }
  return (
    <div>
      <Navbar />
      {children}
    </div>
  );
}