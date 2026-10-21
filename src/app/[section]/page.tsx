import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { validSession, cookieName } from '@/lib/auth';
import { sectionForPath } from '@/lib/navigation';
import Dashboard from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const initialTab = sectionForPath('/' + section);
  if (!initialTab) notFound();
  if (!validSession((await cookies()).get(cookieName)?.value)) redirect('/login');
  return <Dashboard initialTab={initialTab} />;
}
