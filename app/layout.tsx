import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'geets',
  description: 'group chat without names',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0b0c0e' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
