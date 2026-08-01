"use client";

import { useOptionalAppContext } from "@/hooks/AppContext";
import { hasLocale, LOCALE_COOKIE_NAME, type Locale } from "@/i18n/locale";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export const LanguageSelectorDropdown = () => {
    const appContext = useOptionalAppContext();
    const locale = useLocale();
    const router = useRouter();

    const language: Locale = appContext?.language ?? (hasLocale(locale) ? locale : "en");

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Language:</span>
            <select
                className="border border-gray-300 rounded-md p-1"
                value={language}
                onChange={(e) => {
                    const nextLanguage = e.target.value;
                    if (hasLocale(nextLanguage)) {
                        if (appContext) {
                            appContext.setLanguage(nextLanguage);
                        } else {
                            document.cookie = `${LOCALE_COOKIE_NAME}=${nextLanguage}; path=/; max-age=31536000`;
                        }
                        router.refresh();
                    }
                }}
            >
                <option value="en">English</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
            </select>
        </div>
    );
}