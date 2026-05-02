import type { Metadata } from 'next';
import { Tajawal, Reem_Kufi } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { Toaster } from '@/components/ui/toaster';

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-tajawal',
});
const reem = Reem_Kufi({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-reem',
});

export const metadata: Metadata = {
  title: 'إدارة فريق السوشال ميديا',
  description: 'نظام إدارة وجدولة مهام فريق السوشال ميديا',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${reem.variable}`}>
      <body className="font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 px-6 py-8 md:px-10">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
