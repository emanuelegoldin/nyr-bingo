"use client";

/**
 * Profile Page Client Component
 * Spec Reference: 02-user-profile-and-privacy.md
 */

import { NotificationSetting } from "@/components/notifications/notification-setting";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/AppContext";
import { useApiErrorToast } from '@/hooks/use-api-error-toast';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import type { UserProfile } from '@/lib/db/types';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface UserViewModel {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
}

interface ProfilePageClientProps {
  initialUser: UserViewModel;
  initialProfile: UserProfile | null;
}

export default function ProfilePageClient({
  initialUser,
  initialProfile,
}: ProfilePageClientProps) {
  const t = useTranslations("Profile");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  usePageTitle(t("pageTitle"));

  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [displayName, setDisplayName] = useState(initialProfile?.displayName || '');
  const [bio, setBio] = useState(initialProfile?.bio || '');
  const [displayNamePublic, setDisplayNamePublic] = useState(initialProfile?.displayNamePublic ?? true);
  const [bioPublic, setBioPublic] = useState(initialProfile?.bioPublic ?? false);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await apiFetch<unknown>('/api/profile', {
      method: 'PUT',
      json: {
        displayName,
        bio,
        displayNamePublic,
        bioPublic,
      },
    });

    if (result.ok) {
      toast({
        title: tc("success"),
        description: t("toasts.updated"),
      });
    } else {
      toastApiError(result, t("toasts.updateFailed"));
    }
    setIsSaving(false);
  };

  const handleResendVerification = async () => {
    setIsResendingVerification(true);
    const result = await apiFetch<{ message?: string }>('/api/auth/resend-verification', {
      method: 'POST',
    });

    if (result.ok) {
      toast({
        title: tc("success"),
        description: result.data.message || t("toasts.verificationSent"),
      });
    } else {
      toastApiError(result, t("toasts.resendFailed"));
    }
    setIsResendingVerification(false);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
          <TabsTrigger value="password">{t("tabs.password")}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">{t("info.title")}</CardTitle>
              <CardDescription>{t("info.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-2xl">
                    {String.fromCodePoint(initialUser.username.codePointAt(0) || 63)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{initialUser.username}</p>
                  <p className="text-sm text-muted-foreground">{initialUser.email}</p>
                  {initialUser.emailVerified ? (
                    <p className="text-sm text-green-600 font-medium mt-1">{t("info.verified")}</p>
                  ) : (
                    <div className="mt-1">
                      <p className="text-sm text-amber-600 font-medium">{t("info.notVerified")}</p>
                      <p className="text-xs text-muted-foreground">{t("info.verifyNeeded")}</p>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs mt-1"
                        onClick={handleResendVerification}
                        disabled={isResendingVerification}
                      >
                        {isResendingVerification ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            {t("info.sending")}
                          </>
                        ) : (
                          t("info.resend")
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="displayName">{t("info.displayName")}</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("info.displayNamePlaceholder")}
                />
                <div className="flex items-center space-x-2">
                  <Switch
                    id="displayNamePublic"
                    checked={displayNamePublic}
                    onCheckedChange={setDisplayNamePublic}
                  />
                  <Label htmlFor="displayNamePublic" className="text-sm text-muted-foreground">
                    {t("info.displayNamePublic")}
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">{t("info.bio")}</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t("info.bioPlaceholder")}
                  rows={3}
                />
                <div className="flex items-center space-x-2">
                  <Switch
                    id="bioPublic"
                    checked={bioPublic}
                    onCheckedChange={setBioPublic}
                  />
                  <Label htmlFor="bioPublic" className="text-sm text-muted-foreground">
                    {t("info.bioPublic")}
                  </Label>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("info.save")}
              </Button>
            </CardFooter>
          </Card>
          <Card className="mt-6">
            <CardContent className="pt-6">
              <NotificationSetting />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="password" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">{t("password.title")}</CardTitle>
              <CardDescription>{t("password.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">{t("password.current")}</Label>
                <Input id="current-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("password.new")}</Label>
                <Input id="new-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("password.confirm")}</Label>
                <Input id="confirm-password" type="password" />
              </div>
            </CardContent>
            <CardFooter>
              <Button>{t("password.update")}</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
