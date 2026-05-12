import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Command Center · UnicornBakery · SelbstFrei',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body
        data-cc-density="default"
        data-cc-surface="paper"
        data-cc-brand-intensity="subtle"
      >
        {children}
      </body>
    </html>
  );
}
