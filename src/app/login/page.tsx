import { configured } from '@/lib/auth';
import Login from '@/components/login';
export const dynamic = 'force-dynamic';
export default function Page() {
  return <Login setup={!configured() && process.env.NODE_ENV !== 'production'} />;
}
