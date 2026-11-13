'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getToken } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? '/chat/' : '/login/');
  }, [router]);
  return null;
}
