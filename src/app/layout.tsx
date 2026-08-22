import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Easement MVP',
  description: 'LA County Property Easement & Advocacy Tool',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
