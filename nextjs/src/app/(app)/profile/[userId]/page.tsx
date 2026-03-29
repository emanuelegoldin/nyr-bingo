/**
 * Public Profile Page
 * Spec Reference: 02-user-profile-and-privacy.md
 *
 * Server-first implementation:
 * - Auth, ownership checks, redirects, and profile loading run on the server
 * - A tiny client shell is used for client-only app-header context updates
 */

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getPublicUserProfile, type PublicUserProfile } from "@/lib/db";
import PublicProfilePageShell from "@/components/profile/public-profile-page-shell";

interface PublicProfilePageProps {
  params: Promise<{ userId: string }>;
}

function PublicProfileLoadingFallback() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

function PublicProfileCard({ profile }: { profile: PublicUserProfile }) {
  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">
                {String.fromCodePoint(profile.username.codePointAt(0) ?? 63)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-lg">{profile.username}</p>
              {profile.displayName && (
                <p className="text-sm text-muted-foreground">
                  {profile.displayName}
                </p>
              )}
            </div>
          </div>

          {profile.bio && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-1">Bio</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {profile.bio}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function PublicProfileContent({ userId }: { userId: string }) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  // Owner redirect belongs on the server so we avoid client flashes.
  if (currentUser.id === userId) {
    redirect("/profile");
  }

  // We can call DB methods directly in a Server Component, no useEffect/fetch needed.
  const profile = await getPublicUserProfile(userId);
  if (!profile) {
    notFound();
  }

  return <PublicProfileCard profile={profile} />;
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { userId } = await params;

  return (
    // Client shell updates app header title via context, while server children stay server-rendered.
    <PublicProfilePageShell>
      {/* Suspense lets this async server section stream with a loading fallback. */}
      <Suspense fallback={<PublicProfileLoadingFallback />}>
        <PublicProfileContent userId={userId} />
      </Suspense>
    </PublicProfilePageShell>
  );
}
