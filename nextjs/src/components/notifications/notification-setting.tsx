"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppContext } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { getDictionaryForLocale } from "@/i18n/dictionary";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";

/** The switch that turns the user's notifications on and off (spec 19). */
export function NotificationSetting() {
  const { language } = useAppContext();
  const { toast } = useToast();
  const strings = getDictionaryForLocale(language).Notifications;
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const loadSetting = async () => {
      const result = await apiFetch<{ enabled: boolean }>("/api/notifications/settings");
      if (result.ok) setEnabled(result.data.enabled);
    };
    void loadSetting();
  }, []);

  const handleChange = async (checked: boolean) => {
    setEnabled(checked);
    const result = await apiFetch("/api/notifications/settings", { method: "PUT", json: { enabled: checked } });
    if (!result.ok) {
      setEnabled(!checked);
      toast({ title: "Error", description: strings.settingError, variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor="notificationsEnabled">{strings.settingLabel}</Label>
        <p className="text-sm text-muted-foreground">{strings.settingDescription}</p>
      </div>
      <Switch
        id="notificationsEnabled"
        checked={enabled ?? false}
        disabled={enabled === null}
        onCheckedChange={handleChange}
      />
    </div>
  );
}
