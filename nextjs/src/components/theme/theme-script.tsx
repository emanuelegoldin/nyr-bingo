/**
 * Inline script that applies the operating system's theme before the first paint.
 * Spec Reference: 25-theming.md - Selection and Persistence
 */

import { DARK_MEDIA_QUERY } from '@/lib/theme/config';

const script = `(function(){try{var d=window.matchMedia(${JSON.stringify(DARK_MEDIA_QUERY)}).matches;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(_){}})();`;

/**
 * Render in `<head>` when the stored theme is `system`, so a dark operating system
 * never sees the light theme flash while the page loads.
 *
 * @returns The inline script element.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
