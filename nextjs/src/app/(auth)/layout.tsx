import { AppLogo } from '@/components/icons';
import { CornerLocaleSwitcher } from '@/components/locale-switcher';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <CornerLocaleSwitcher />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
            <Link href="/" className="flex items-center justify-center gap-2">
                <AppLogo />
                <span className="text-2xl font-semibold font-headline">Resolution Bingo</span>
            </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
