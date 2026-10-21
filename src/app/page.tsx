import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validSession, cookieName } from '@/lib/auth';
import Dashboard from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!validSession((await cookies()).get(cookieName)?.value)) redirect('/login');
  return <Dashboard />;
}
