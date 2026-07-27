import { useAppContext } from "@/hooks/AppContext";
import { useRouter } from "next/navigation";

export const LanguageSelectorDropdown = () => {
    const { language, setLanguage } = useAppContext();
    const router = useRouter();
    return (
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Language:</span>
            <select
                className="border border-gray-300 rounded-md p-1"
                value={language}
                onChange={(e) => {
                    const nextLanguage = e.target.value;
                    if (nextLanguage === "en" || nextLanguage === "de" || nextLanguage === "it") {
                        setLanguage(nextLanguage)
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