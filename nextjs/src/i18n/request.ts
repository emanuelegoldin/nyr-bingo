import {getRequestConfig} from 'next-intl/server';
import { cookies } from 'next/dist/server/request/cookies';
 
export default getRequestConfig(async () => {
  const store = await cookies();  // TODO: set cookie based on user selection or move to locale in path
  const locale = store.get('locale')?.value || 'en';
 
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});