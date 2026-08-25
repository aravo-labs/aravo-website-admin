"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  ToastStack,
  Textarea,
  useToasts,
} from "@/components/ui";
import { bannersApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { Banner, BannerItem, BannerVariant, ContentStatus } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

/**
 * The three banner layouts, described in the terms the person choosing one
 * actually cares about: what it looks like and what it needs from them.
 */
const VARIANTS: Array<{
  id: BannerVariant;
  label: string;
  blurb: string;
  needsItems: boolean;
  itemHint: string;
}> = [
  {
    id: "logo_strip",
    label: "Logo strip",
    blurb: "A row of client or partner logos.",
    needsItems: true,
    itemHint: "Each logo needs a name and an image URL.",
  },
  {
    id: "announcement",
    label: "Announcement",
    blurb: "A single line above the hero, with an optional link.",
    needsItems: false,
    itemHint: "",
  },
  {
    id: "showcase",
    label: "Project showcase",
    blurb: "Cards for selected projects or case studies.",
    needsItems: true,
    itemHint: "Each card needs a title; description, image and link are optional.",
  },
];

const STATUS_TONE = {
  published: "success",
  draft: "warning",
  archived: "neutral",
} as const;

export default function BannersPage() {
  const auth = useAuth();
  const { token } = auth;

  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Banner | null>(null);
  const { toasts, push } = useToasts();

  const state = useAsync(() => bannersApi.list(auth, { page_size: 50 }), [token]);

  async function publish(banner: Banner) {
    try {
      await bannersApi.publish(auth, banner.id);
      push(`“${banner.title}” is live. Any previous banner was archived.`);
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not publish.", "danger");
    }
  }

  async function remove(banner: Banner) {
    try {
      await bannersApi.remove(auth, banner.id);
      push(`Deleted “${banner.title}”.`);
      setConfirmDelete(null);
      state.reload();
    } catch (err) {
      push(err instanceof ApiRequestError ? err.message : "Could not delete.", "danger");
    }
  }

  return (
    <>
      <PageHeader
        title="Banners"
        description="Only one banner is live at a time. Publishing one retires the other."
        actions={<Button onClick={() => setEditing("new")}>New banner</Button>}
      />

      {state.loading ? (
        <LoadingState label="Loading banners" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.items.length === 0 ? (
        <EmptyState
          title="No banners yet"
          description="Create one, pick a layout, then publish it when you are happy."
          action={<Button onClick={() => setEditing("new")}>New banner</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {state.data!.items.map((banner) => {
            const variant = VARIANTS.find((v) => v.id === banner.variant);
            return (
              <Card key={banner.id}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-medium">
                        {banner.title}
                      </h2>
                      <Badge tone={STATUS_TONE[banner.status]}>{banner.status}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[length:var(--text-2xs)] tracking-[0.06em] text-[var(--color-text-subtle)] uppercase">
                      {variant?.label ?? banner.variant}
                    </p>
                  </div>
                </div>

                {banner.subtitle && (
                  <p className="mb-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                    {banner.subtitle}
                  </p>
                )}

                {banner.items.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {banner.items.map((item, i) => (
                      <span
                        key={`${item.label}-${i}`}
                        className="rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] px-2 py-1 text-[length:var(--text-xs)] text-[var(--color-text-muted)]"
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {banner.status !== "published" && (
                    <Button size="sm" onClick={() => publish(banner)}>
                      Publish
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setEditing(banner)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(banner)}>
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <BannerEditor
          banner={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            push(m);
            setEditing(null);
            state.reload();
          }}
        />
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this banner?"
        description={confirmDelete ? `“${confirmDelete.title}” will be removed.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>
              Delete banner
            </Button>
          </>
        }
      />

      <ToastStack toasts={toasts} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function BannerEditor({
  banner,
  onClose,
  onSaved,
}: {
  banner: Banner | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const auth = useAuth();
  const [variant, setVariant] = useState<BannerVariant>(banner?.variant ?? "logo_strip");
  const [title, setTitle] = useState(banner?.title ?? "");
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "");
  const [ctaLabel, setCtaLabel] = useState(banner?.cta_label ?? "");
  const [ctaUrl, setCtaUrl] = useState(banner?.cta_url ?? "");
  const [items, setItems] = useState<BannerItem[]>(
    banner ? banner.items.map((i) => ({ ...i })) : []
  );
  const [status, setStatus] = useState<ContentStatus>(banner?.status ?? "draft");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const spec = VARIANTS.find((v) => v.id === variant)!;

  function updateItem(index: number, patch: Partial<BannerItem>) {
    setItems((all) => all.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function save() {
    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const payload = {
        title,
        subtitle: subtitle || null,
        cta_label: ctaLabel || null,
        cta_url: ctaUrl || null,
        items: spec.needsItems ? items : [],
        status,
        sort_order: banner?.sort_order ?? 0,
      };
      if (banner) {
        await bannersApi.update(auth, banner.id, payload);
      } else {
        await bannersApi.create(auth, { ...payload, variant });
      }
      onSaved(banner ? "Banner updated." : "Banner created.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFieldErrors(err.fieldErrors);
        // Variant rules come back as a whole-model error with no field, so
        // they are shown at the top rather than silently swallowed.
        setFormError(err.formMessage);
      } else {
        setFormError("Could not save the banner.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={banner ? "Edit banner" : "New banner"}
      description={
        banner ? "The layout is fixed after creation." : "Pick a layout to start."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {banner ? "Save changes" : "Create banner"}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[62vh] flex-col gap-5 overflow-y-auto pr-1">
        {formError && (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger-700)]">
            {formError}
          </p>
        )}

        {/* Layout choice, only when creating: changing it later would
            reinterpret items that were validated against the old one. */}
        {!banner && (
          <fieldset>
            <legend className="mb-2 text-[length:var(--text-sm)] font-medium">
              Layout
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {VARIANTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariant(v.id)}
                  aria-pressed={variant === v.id}
                  className={
                    variant === v.id
                      ? "rounded-[var(--radius-md)] border-2 border-[var(--color-accent)] bg-[var(--color-accent-subtle)] p-3 text-left"
                      : "rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-left hover:border-[var(--color-border-strong)]"
                  }
                >
                  <span className="block text-[length:var(--text-sm)] font-medium">
                    {v.label}
                  </span>
                  <span className="mt-0.5 block text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {v.blurb}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <Field label="Title" required error={fieldErrors.title}>
          {(p) => (
            <Input
              {...p}
              value={title}
              invalid={!!fieldErrors.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Trusted by operations teams"
            />
          )}
        </Field>

        <Field label="Subtitle" error={fieldErrors.subtitle}>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link label" error={fieldErrors.cta_label}>
            {(p) => (
              <Input
                {...p}
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Read more"
              />
            )}
          </Field>
          <Field
            label="Link URL"
            hint="A page on this site, like /seed, or a full address elsewhere."
            error={fieldErrors.cta_url}
          >
            {(p) => (
              <Input
                {...p}
                value={ctaUrl}
                invalid={!!fieldErrors.cta_url}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="/seed"
              />
            )}
          </Field>
        </div>

        {spec.needsItems && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-[length:var(--text-sm)] font-medium">Items</p>
                <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                  {spec.itemHint}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setItems((all) => [...all, { label: "", description: null, image_url: null, url: null }])}
              >
                Add item
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                This layout needs at least one item.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
                        #{index + 1}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setItems((all) => all.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* The API names item problems by position -
                          items.0.label - so the message can be put beside the
                          input it is about rather than at the top of a form
                          with several items in it. */}
                      <Field
                        label="Name"
                        required
                        error={fieldErrors[`items.${index}.label`]}
                      >
                        {(p) => (
                          <Input
                            {...p}
                            value={item.label}
                            invalid={!!fieldErrors[`items.${index}.label`]}
                            onChange={(e) => updateItem(index, { label: e.target.value })}
                          />
                        )}
                      </Field>
                      <Field
                        label="Image URL"
                        required={variant === "logo_strip"}
                        error={fieldErrors[`items.${index}.image_url`]}
                      >
                        {(p) => (
                          <Input
                            {...p}
                            value={item.image_url ?? ""}
                            invalid={!!fieldErrors[`items.${index}.image_url`]}
                            onChange={(e) =>
                              updateItem(index, { image_url: e.target.value || null })
                            }
                            placeholder="https://…"
                          />
                        )}
                      </Field>
                      {variant === "showcase" && (
                        <Field label="Description">
                          {(p) => (
                            <Input
                              {...p}
                              value={item.description ?? ""}
                              onChange={(e) =>
                                updateItem(index, { description: e.target.value || null })
                              }
                            />
                          )}
                        </Field>
                      )}
                      <Field label="Link URL" error={fieldErrors[`items.${index}.url`]}>
                        {(p) => (
                          <Input
                            {...p}
                            value={item.url ?? ""}
                            invalid={!!fieldErrors[`items.${index}.url`]}
                            onChange={(e) => updateItem(index, { url: e.target.value || null })}
                            placeholder="https://…"
                          />
                        )}
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Field
          label="Status"
          hint="Use Publish on the list to make a banner live; it retires the current one."
          error={fieldErrors.status}
        >
          {(p) => (
            <Select
              {...p}
              value={status}
              invalid={!!fieldErrors.status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}
