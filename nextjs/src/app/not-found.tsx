import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('Common');

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-lg text-muted-foreground">{t('notFound')} - (┬┬﹏┬┬)</p>
    </div>
  );
}
