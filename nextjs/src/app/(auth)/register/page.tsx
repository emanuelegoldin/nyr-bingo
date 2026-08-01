import { UserAuthForm } from '@/components/user-auth-form';
import { getDictionary } from '@/i18n/request';
import Link from 'next/link';

export default async function RegisterPage() {
  const t = (await getDictionary()).RegisterPage; // ISSUE: this is a server composnent --> we cannot use context
  // Use coockie as bridge 
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-headline">
          {t.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.description}
        </p>
      </div>
      <UserAuthForm variant="register" />
      <p className="px-8 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="hover:text-primary underline underline-offset-4"
        >
          {t.loginLink}
        </Link>
      </p>
    </div>
  );
}
