import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { siteUrl } from '@/lib/site';
import { PRODUCT_NAME, SiteFooter } from '@/components/site-footer';
import './globals.css';

/**
 * Site metadata.
 *
 * WHAT WAS HERE, AND WHY IT MATTERED. Title "Easement MVP" — the internal
 * project name, meaningless to anyone searching — and description "LA County
 * Property Easement & Advocacy Tool", which stopped being true when the flood
 * lookup and the easement guidance went national. Every shared link and every
 * search result carried both.
 *
 * For a free product whose acquisition is people searching "who maintains the
 * sewer easement on my property", the title and description ARE the product's
 * front page for most of the people who will ever see it.
 *
 * `title.template` so each page can set its own without repeating the suffix,
 * and `metadataBase` so relative OG images and canonicals resolve.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'What the easement on your property means',
    // Was "Easement Report" — the project's working name, not the product's.
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    'Free. Enter your address and find out what an easement on your property restricts, who is ' +
    'responsible for maintaining and repairing it, how long it lasts, and what should be on ' +
    'record but often is not. Not legal advice.',
  applicationName: 'SafeHomeValue',
  openGraph: {
    type: 'website',
    siteName: 'SafeHomeValue',
    title: 'SafeHomeValue — know what your home is worth and what keeps it safe',
    description:
      'Free. What an easement restricts, who maintains and repairs it, how long it lasts, and ' +
      'what should be on record but often is not.',
  },
  /*
   * NO TWITTER/OG IMAGE, deliberately. An image would be invented branding for
   * a product that has none, and a broken image reference is worse than its
   * absence. Add one when there is a real one to add.
   */
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        {/*
          Rendered from the layout so the Privacy link, the contact address and
          the standing "not a survey" line reach every page — including the
          ones that carry no other disclaimer. See site-footer.tsx for why it
          is one component rather than per-page markup. Analytics rides here
          too: the <Analytics /> component is the code side of Vercel Web
          Analytics; the dashboard starts counting once this is deployed.
        */}
        <SiteFooter />
      </body>
    </html>
  );
}
