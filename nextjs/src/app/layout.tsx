import { ThemeProvider } from '@/components/theme/theme-provider';
import { ThemeScript } from '@/components/theme/theme-script';
import { Toaster } from '@/components/ui/toaster';
import { getTheme } from '@/lib/theme/get-theme';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import './globals.css';

/**
 * Page title and description in the active locale (spec 15).
 *
 * @returns The metadata of every page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('App');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const theme = await getTheme();
  // An explicit theme is rendered by the server; `system` is resolved by ThemeScript before paint (spec 25)
  const isDark = theme === 'dark';
  return (
    <html
      lang={locale}
      className={isDark ? 'dark' : undefined}
      style={theme === 'system' ? undefined : { colorScheme: theme }}
      suppressHydrationWarning
    >
      <head>
        {theme === 'system' && <ThemeScript />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider initialTheme={theme}>
          <NextIntlClientProvider>
            {children}
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
