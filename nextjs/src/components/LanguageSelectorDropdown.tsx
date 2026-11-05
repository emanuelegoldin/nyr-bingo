"use client";

import { isAppLocale } from "@/i18n/config";
import { useSetLocale } from "@/i18n/use-set-locale";
import { useLocale } from "next-intl";

export const LanguageSelectorDropdown = () => {
    const locale = useLocale();
    const setLocale = useSetLocale();

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Language:</span>
            <select
                className="border border-gray-300 rounded-md p-1"
                value={locale}
                onChange={(e) => {
                    const nextLanguage = e.target.value;
                    if (isAppLocale(nextLanguage)) {
                        setLocale(nextLanguage);
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
