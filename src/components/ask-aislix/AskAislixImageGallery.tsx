import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { demoShelfFallbackUrl } from "@/lib/demo-shelf-images";

type GalleryItem = {
  url?: string;
  caption?: string;
  captured_at?: string;
  store_name?: string;
  scan_id?: string;
  assignment_id?: string;
};

function GalleryImage({ src, alt, index }: { src?: string; alt: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const resolved = !src || failed ? demoShelfFallbackUrl(index) : src;

  return (
    <img
      src={resolved}
      alt={alt}
      className="aspect-[4/3] w-full object-cover"
      loading="lazy"
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}

export function AskAislixImageGallery({ items, title }: { items: GalleryItem[]; title?: string }) {
  if (!items.length) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No images found in your authorized scope.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {title ? <p className="text-sm font-semibold text-navy">{title}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <figure
            key={`${item.scan_id ?? "img"}-${index}`}
            className="overflow-hidden rounded-xl border border-line bg-white shadow-card"
          >
            <GalleryImage
              src={item.url}
              alt={item.caption ?? "Audit evidence"}
              index={index}
            />
            <figcaption className="space-y-1 p-3 text-xs text-mp-muted">
              {item.caption ? <p className="font-medium text-navy">{item.caption}</p> : null}
              {item.store_name ? <p>{item.store_name}</p> : null}
              {item.captured_at ? (
                <p>{new Date(item.captured_at).toLocaleString()}</p>
              ) : null}
              {item.assignment_id ? (
                <Link
                  to="/my-scans"
                  search={{ assignmentId: item.assignment_id }}
                  className="inline-block text-primary hover:underline"
                >
                  View audit
                </Link>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
