import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Meal Planner',
  description: 'What can I cook tonight? A personal AI cooking assistant.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body
        style={{
          margin: 0,
          background: '#fafaf9',
          color: '#1c1917',
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}
