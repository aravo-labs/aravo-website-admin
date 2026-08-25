"use client";

/**
 * Where a link goes, with the site's own pages offered rather than recalled.
 *
 * A prompt asking for an address works for external links and fails for
 * internal ones: it asks an author to remember the exact slug of another
 * documentation page, and a typo produces a link that looks fine and 404s.
 * So the addresses this site actually has are listed here - documentation
 * pages, standalone pages, the fixed routes - and picking one fills the field.
 *
 * Cross-references are what makes a set of SDK pages readable as one thing:
 * install refers to configuration, configuration refers to the method it sets,
 * and a reader follows the thread instead of going back to the index. That
 * only happens if writing one is easy.
 */

import { useMemo, useState } from "react";

import { Button, Field, Input, Modal } from "@/components/ui";
import { docsApi, pagesApi } from "@/lib/api/admin";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

/** Routes that are files in the site's repository rather than rows. */
const FIXED: readonly { href: string; label: string; group: string }[] = [
  { href: "/", label: "Home", group: "Site" },
  { href: "/docs", label: "Documentation index", group: "Site" },
  { href: "/careers", label: "Careers", group: "Site" },
  { href: "/team", label: "Team", group: "Site" },
  { href: "/sdk-access", label: "Request SDK access", group: "Site" },
];

type DialogProps = {
  open: boolean;
  /** The address already on the selection, if this is an edit. */
  initial?: string;
  onClose: () => void;
  onSubmit: (href: string) => void;
  onRemove: () => void;
};

/**
 * Mounted only while it is open.
 *
 * A toolbar sits in every long-form field on the panel, so the closed dialog
 * is on screen far more often than the open one. Keeping its hooks - the
 * session, the two page lists - inside a component that only exists while it
 * is open means a closed dialog costs nothing and needs nothing, rather than
 * every editor on the panel holding a session it is not using.
 */
export function LinkDialog(props: DialogProps) {
  if (!props.open) return null;
  return <OpenLinkDialog {...props} />;
}

function OpenLinkDialog({ open, initial, onClose, onSubmit, onRemove }: DialogProps) {
  const auth = useAuth();
  const [href, setHref] = useState(initial ?? "");

  const docs = useAsync(() => docsApi.list(auth, { page_size: 100 }), [auth.token]);
  const pages = useAsync(() => pagesApi.list(auth, { page_size: 100 }), [auth.token]);

  const destinations = useMemo(() => {
    const rows = [
      ...FIXED,
      ...(docs.data?.items ?? [])
        .filter((d) => d.status === "published")
        .map((d) => ({ href: `/docs/${d.slug}`, label: d.title, group: d.section || "Docs" })),
      ...(pages.data?.items ?? [])
        .filter((p) => p.status === "published")
        .map((p) => ({ href: `/${p.slug}`, label: p.title, group: "Pages" })),
    ];

    const grouped = new Map<string, typeof rows>();
    for (const row of rows) grouped.set(row.group, [...(grouped.get(row.group) ?? []), row]);
    return [...grouped.entries()];
  }, [docs.data, pages.data]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit link" : "Add link"}
      size="lg"
      footer={
        <>
          {initial && (
            <Button variant="ghost" onClick={onRemove}>
              Remove link
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(href.trim())} disabled={!href.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
        <Field
          label="Address"
          hint="A full address for another site, or one starting with / for this one."
        >
          {(p) => (
            <Input
              {...p}
              value={href}
              autoFocus
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://example.com or /docs/installing-the-sdk"
            />
          )}
        </Field>

        <div className="flex flex-col gap-3">
          <p className="text-[length:var(--text-xs)] tracking-[0.08em] text-[var(--color-text-muted)] uppercase">
            Pages on this site
          </p>

          {destinations.map(([group, rows]) => (
            <div key={group} className="flex flex-col gap-1.5">
              <p className="text-[length:var(--text-xs)] font-medium text-[var(--color-text-muted)]">
                {group}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rows.map((row) => (
                  <button
                    key={row.href}
                    type="button"
                    onClick={() => setHref(row.href)}
                    className={
                      href === row.href
                        ? "rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-2.5 py-1 text-[length:var(--text-sm)] text-white"
                        : "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2.5 py-1 text-[length:var(--text-sm)] text-[var(--color-text)] hover:border-[var(--color-accent)]"
                    }
                  >
                    {row.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
