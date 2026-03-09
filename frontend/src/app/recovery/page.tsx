import { redirect } from 'next/navigation';

export default function RecoveryRedirectPage() {
  redirect('/login');
}
