'use client';

import { useRouter } from 'next/navigation';

import { AuthService } from '@/services/auth.service';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = AuthService.getToken();
    if (token) router.replace('/chat');
    else router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Redirecting...</p>
    </div>
  );
}
