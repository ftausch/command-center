// Server shell. /auth/set-password is only reachable with an active
// session (invite-link click puts one in place via /auth/callback).
// Without a session, redirect to /login — there's nothing to update.
//
// The actual form is a client component; the shell handles auth gating
// at the server level so unauthed visitors never see the form flash.

import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { SetPasswordForm } from './form';

export const dynamic = 'force-dynamic';

export default async function SetPasswordPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <SetPasswordForm email={user.email ?? ''} />;
}
