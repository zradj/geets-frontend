'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { parseInvite } from '@/lib/invite';
import { getToken, saveGroupKey, setPendingInvite, takePendingInvite } from '@/lib/store';

export default function JoinPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const fragment = window.location.hash.slice(1) || takePendingInvite() || '';
    // Drop the secrets from the address bar and history right away.
    window.history.replaceState(null, '', window.location.pathname);

    const invite = parseInvite(fragment);
    (async () => {
      if (!invite) return setError('this invite link is broken or incomplete.');
      if (!getToken()) {
        setPendingInvite(fragment);
        return router.replace('/login/');
      }
      try {
        await api.joinGroup(invite.groupId, invite.token);
        saveGroupKey(invite.groupId, invite.key);
        router.replace(`/chat/?g=${invite.groupId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message.toLowerCase() : 'could not join.');
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4 text-center">
      {error ? (
        <div className="space-y-3">
          <p className="text-danger">{error}</p>
          <Link className="text-accent underline" href="/chat/">back to chats</Link>
        </div>
      ) : (
        <p className="text-dim">joining...</p>
      )}
    </main>
  );
}
