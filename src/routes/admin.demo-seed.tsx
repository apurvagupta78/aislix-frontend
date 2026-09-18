import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload } from "lucide-react";
import { AdminPage } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { backfillDemoEvidence } from "@/lib/demo-evidence-backfill.functions";

export const Route = createFileRoute("/admin/demo-seed")({
  head: () => ({
    meta: [
      { title: "Demo Evidence Backfill — Platform Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDemoSeedPage,
});

const MAX_FILES = 20;

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function AdminDemoSeedPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [force, setForce] = useState(false);
  const upload = useServerFn(backfillDemoEvidence);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = await Promise.all(
        files.slice(0, MAX_FILES).map(async (file) => ({
          filename: file.name,
          mimeType: file.type || "image/jpeg",
          base64: await readAsBase64(file),
        })),
      );
      return upload({ data: { files: payload, force } });
    },
  });

  return (
    <AdminPage
      title="Demo Evidence Backfill"
      description="Attach shelf photos to the Aislix Demo Showcase audits, oldest audit first."
    >
      <Card className="card-surface max-w-2xl">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="demo-evidence-files">Shelf photos (up to {MAX_FILES})</Label>
            <input
              id="demo-evidence-files"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              JPEG, PNG or WebP · max 10MB each · {files.length} selected
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="demo-evidence-force"
              checked={force}
              onCheckedChange={(value) => setForce(value === true)}
            />
            <Label htmlFor="demo-evidence-force" className="text-sm font-normal">
              Force re-upload
            </Label>
          </div>

          <Button
            variant="brand"
            className="rounded-xl"
            disabled={!files.length || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload to Demo Org
          </Button>

          {mutation.isError ? (
            <p className="text-sm text-destructive">
              {mutation.error instanceof Error ? mutation.error.message : "Upload failed."}
            </p>
          ) : null}

          {mutation.data ? (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Done</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Paired with audits: {mutation.data.paired}</li>
                <li>Uploaded: {mutation.data.uploaded}</li>
                <li>Skipped (already present): {mutation.data.skipped}</li>
              </ul>
              {mutation.data.errors.length ? (
                <ul className="mt-3 space-y-1 text-xs text-destructive">
                  {mutation.data.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
