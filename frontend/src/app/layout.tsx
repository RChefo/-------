import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SWRProvider } from '@/context/SWRProvider';
import { ToastProvider } from '@/context/ToastContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'C2 Control Dashboard',
  description: 'Cybersecurity simulation command and control dashboard',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-c2-bg text-c2-text`}>
        <SWRProvider>
          <ToastProvider>
            <DashboardLayout>
              {children}
            </DashboardLayout>
          </ToastProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
