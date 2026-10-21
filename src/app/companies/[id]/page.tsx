import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { validSession, cookieName } from '@/lib/auth';
import { store } from '@/lib/store';
import Dashboard from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!validSession((await cookies()).get(cookieName)?.value)) redirect('/login');
  const { id } = await params;
  if (!(await store().read()).companies.some((c) => c.id === id)) notFound();
  return <Dashboard initialCompanyId={id} />;
}
