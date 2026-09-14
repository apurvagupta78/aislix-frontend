import { Eye, FlaskConical, History, Loader2, Save, Send } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  templateId: string;
  status: string;
  dirty?: boolean;
  saving?: boolean;
  onSave: () => void;
  onPublish: () => void;
};

export function BuilderTopBar({
  templateId,
  status,
  dirty,
  saving,
  onSave,
  onPublish,
}: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-0 lg:rounded-xl lg:border lg:px-4">
      <div className="flex items-center gap-2">
        <Badge variant={status === "published" ? "secondary" : "outline"} className="capitalize">
          {status}
        </Badge>
        {dirty ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={onSave}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="mr-1 size-3" />}
          Save Draft
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link to="/audit-templates/$templateId/preview" params={{ templateId }}>
            <Eye className="mr-1 size-3" /> Preview
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link to="/audit-templates/$templateId/test" params={{ templateId }}>
            <FlaskConical className="mr-1 size-3" /> Test Audit
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link to="/audit-templates/$templateId/versions" params={{ templateId }}>
            <History className="mr-1 size-3" /> Versions
          </Link>
        </Button>
        <Button type="button" size="sm" variant="brand" onClick={onPublish}>
          <Send className="mr-1 size-3" /> Publish
        </Button>
      </div>
    </div>
  );
}
