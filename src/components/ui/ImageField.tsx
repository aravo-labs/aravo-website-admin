"use client";

/**
 * Picking an image, rather than knowing where one lives.
 *
 * These fields used to be a text input for a URL, which asked the person
 * adding a colleague's photograph to first host that photograph somewhere and
 * come back with a link. That is a developer's answer to a content problem.
 *
 * So: choose a file, it uploads, the field holds the URL it came back with.
 * The URL box stays underneath, because an image already hosted somewhere -
 * a company logo, a headshot on a personal site - should not have to be
 * downloaded and re-uploaded to be usable.
 */

import { useRef, useState } from "react";

import { imagesApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import { useAuth } from "@/lib/adminAuth";
import { Button, Input, cx } from "@/components/ui";

export function ImageField({
  value,
  onChange,
  kind = "general",
  id,
  "aria-describedby": describedBy,
}: {
  value: string;
  onChange: (url: string) => void;
  /** Namespaces the object in the bucket, so it stays readable by eye. */
  kind?: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  const auth = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const result = await imagesApi.upload(auth, file, kind);
      onChange(result.url);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "That image could not be uploaded.",
      );
    } finally {
      setBusy(false);
      // Cleared so choosing the same file twice still fires a change event,
      // which it otherwise would not after a failure.
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span
          className={cx(
            "grid size-16 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)]",
            "border border-[var(--color-border)] bg-[var(--color-surface-sunken)]",
            "font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]",
          )}
        >
          {value ? (
            // Arbitrary remote URLs, so a plain img rather than next/image and
            // its host allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            "none"
          )}
        </span>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={() => input.current?.click()}
            >
              {value ? "Replace" : "Choose image"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
            JPEG, PNG, WebP, GIF or AVIF. Up to 5MB.
          </p>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      {error && (
        <p className="text-[length:var(--text-xs)] text-[var(--color-danger-700)]">{error}</p>
      )}

      <Input
        id={id}
        aria-describedby={describedBy}
        aria-label="Image address"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an address"
        className="font-mono text-[length:var(--text-xs)]"
      />
    </div>
  );
}
