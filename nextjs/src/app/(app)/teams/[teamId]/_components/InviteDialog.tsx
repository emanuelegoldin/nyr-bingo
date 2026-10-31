import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";

interface InviteDialogProps {
  teamId: string;
}

/**
 * Invite button plus dialog that creates and shows a shareable invite link.
 * The generated invite code is kept while this component stays mounted, so it
 * survives closing and reopening the dialog.
 */
export function InviteDialog({ teamId }: InviteDialogProps) {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  /** Requests a new invite code from the API and stores it on success. */
  const handleCreateInvite = async () => {
    setIsCreatingInvite(true);
    const result = await apiFetch<{ invitation: { inviteCode: string } }>(`/api/teams/${teamId}/invite`, {
      method: 'POST',
      json: {},
    });

    if (result.ok) {
      setInviteCode(result.data.invitation.inviteCode);
      toast({
        title: "Success",
        description: "Invite link created",
      });
    } else {
      toast({
        title: "Error",
        description: result.status === 0 ? "An error occurred" : result.error || "Failed to create invite",
        variant: "destructive",
      });
    }
    setIsCreatingInvite(false);
  };

  /** Copies the invite link to the clipboard and shows a check mark for two seconds. */
  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
          <DialogDescription>
            Create an invite link to share with your friends.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!inviteCode ? (
            <Button onClick={handleCreateInvite} disabled={isCreatingInvite}>
              {isCreatingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Invite Link
            </Button>
          ) : (
            <div className="space-y-2">
              <Label>Invite Link</Label>
              <div className="flex gap-2">
                <Input
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteCode}`}
                  readOnly
                />
                <Button onClick={copyInviteLink} variant="outline">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
