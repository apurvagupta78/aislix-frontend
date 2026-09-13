import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signupUrl as buildSignupUrl } from "@/lib/landing-scan-api";

export function WorkspaceShareDialog({
  open,
  onOpenChange,
  signupHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signupHref?: string;
}) {
  const href = signupHref ?? buildSignupUrl();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share audits with your team</DialogTitle>
          <DialogDescription>
            Create your free Aislix workspace to invite teammates, save audits and share shelf
            intelligence in one place.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button asChild variant="brand" className="w-full">
            <Link to={href} onClick={() => onOpenChange(false)}>
              Create Free Workspace →
            </Link>
          </Button>
          <Button variant="subtle" className="w-full" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
