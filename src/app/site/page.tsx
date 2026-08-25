"use client";

/**
 * What the site calls itself, and whether it is hiring.
 *
 * Three settings that were previously three edits to three files: the company
 * name in the wordmark, the icon in the browser tab, and whether the hiring
 * section appears at the bottom of every page.
 *
 * Hiring is stored rather than inferred from whether a role is published,
 * because those are different questions. A team can have a role open and not
 * want a banner about it while the description is still being argued over,
 * and can want the banner up while the next role is being written.
 */

import { useState } from "react";

import {
  Button,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Textarea,
  ToastStack,
  useToasts,
} from "@/components/ui";
import { ImageField } from "@/components/ui/ImageField";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { siteSettingsApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { SiteSettings } from "@/lib/api/types";
import { useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

export default function SitePage() {
  const auth = useAuth();
  const { token } = auth;

  const state = useAsync(() => siteSettingsApi.read(auth), [token]);

  return (
    <>
      <PageHeader
        title="Site"
        description="The name, the icon, and whether the site says you are hiring."
      />

      {state.loading ? (
        <LoadingState label="Loading settings" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : (
        <SettingsForm
          /* Remounted when the saved values change, which is what seeds the
             fields. Copying them in an effect instead would overwrite
             something half-typed the moment a background reload landed. */
          key={state.data!.updated_at}
          settings={state.data!}
          onSaved={state.reload}
        />
      )}
    </>
  );
}

function SettingsForm({
  settings,
  onSaved,
}: {
  settings: SiteSettings;
  onSaved: () => void;
}) {
  const auth = useAuth();
  const { toasts, push } = useToasts();
  const [companyName, setCompanyName] = useState(settings.company_name);
  const [iconUrl, setIconUrl] = useState(settings.icon_url ?? "");
  const [hiring, setHiring] = useState(settings.hiring_enabled);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp_number ?? "");
  const [linkedin, setLinkedin] = useState(settings.linkedin_url ?? "");
  const [x, setX] = useState(settings.x_url ?? "");
  const [docsTitle, setDocsTitle] = useState(settings.docs_title);
  const [docsIntro, setDocsIntro] = useState(settings.docs_intro);
  const [docsCtaLabel, setDocsCtaLabel] = useState(settings.docs_cta_label);
  const [docsCtaUrl, setDocsCtaUrl] = useState(settings.docs_cta_url);
  const [docsHome, setDocsHome] = useState(settings.docs_home_html);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function save() {
    setBusy(true);
    setFieldErrors({});
    try {
      await siteSettingsApi.save(auth, {
        company_name: companyName,
        icon_url: iconUrl || null,
        hiring_enabled: hiring,
        whatsapp_number: whatsapp || null,
        linkedin_url: linkedin.trim() || null,
        x_url: x.trim() || null,
        docs_title: docsTitle,
        docs_intro: docsIntro,
        docs_cta_label: docsCtaLabel,
        docs_cta_url: docsCtaUrl,
        docs_home_html: docsHome,
      });
      push("Saved. The site picks this up on its next load.");
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFieldErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) push(err.message, "danger");
      } else {
        push("Could not save.", "danger");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Field
        label="Company name"
        required
        hint="The name in the header, the footer, the browser tab and the copyright line."
        error={fieldErrors.company_name}
      >
        {(p) => (
          <Input
            {...p}
            value={companyName}
            invalid={!!fieldErrors.company_name}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        )}
      </Field>

      <Field
        label="Logo"
        hint="The mark beside the name in the header and footer, and the browser tab icon. Square reads best; 512px or larger. Empty uses the drawn mark."
        error={fieldErrors.icon_url}
      >
        {(p) => (
          <ImageField
            {...p}
            kind="icon"
            value={iconUrl}
            onChange={setIconUrl}
          />
        )}
      </Field>

      <Field
        label="WhatsApp number"
        hint="With the country code. Punctuation is ignored. Leave empty for no WhatsApp button."
        error={fieldErrors.whatsapp_number}
      >
        {(p) => (
          <Input
            {...p}
            value={whatsapp}
            invalid={!!fieldErrors.whatsapp_number}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+91 98765 43210"
          />
        )}
      </Field>

      {/* The two profiles the footer links to. Empty means the icon is not
          drawn at all, which is the honest state until there is a profile:
          the placeholder these replace pointed at linkedin.com itself, and a
          link to a network's homepage is not a link to us. */}
      <Field
        label="LinkedIn"
        hint="The company page. Leave empty to drop the icon from the footer."
        error={fieldErrors.linkedin_url}
      >
        {(p) => (
          <Input
            {...p}
            value={linkedin}
            invalid={!!fieldErrors.linkedin_url}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://www.linkedin.com/company/aravo"
          />
        )}
      </Field>

      <Field
        label="X"
        hint="Leave empty to drop the icon from the footer."
        error={fieldErrors.x_url}
      >
        {(p) => (
          <Input
            {...p}
            value={x}
            invalid={!!fieldErrors.x_url}
            onChange={(e) => setX(e.target.value)}
            placeholder="https://x.com/aravo"
          />
        )}
      </Field>

      <Field label="Hiring">
        {() => (
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3.5 py-3">
            <input
              type="checkbox"
              checked={hiring}
              onChange={(e) => setHiring(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[length:var(--text-sm)] font-medium">
                Show the hiring section
              </span>
              <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                Turning this off hides it everywhere, whatever roles are
                published.
              </span>
            </span>
          </label>
        )}
      </Field>

      <div className="mt-2 flex flex-col gap-6 border-t border-[var(--color-border)] pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[length:var(--text-base)] font-medium">Documentation page</h2>
          <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            The heading and intro at the top of /docs, and the button in its header. The
            pages themselves are managed under SDK docs.
          </p>
        </div>

        <Field label="Heading" required error={fieldErrors.docs_title}>
          {(p) => (
            <Input
              {...p}
              value={docsTitle}
              invalid={!!fieldErrors.docs_title}
              onChange={(e) => setDocsTitle(e.target.value)}
            />
          )}
        </Field>

        <Field
          label="Intro"
          hint="One or two sentences under the heading."
          error={fieldErrors.docs_intro}
        >
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              value={docsIntro}
              invalid={!!fieldErrors.docs_intro}
              onChange={(e) => setDocsIntro(e.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button label" required error={fieldErrors.docs_cta_label}>
            {(p) => (
              <Input
                {...p}
                value={docsCtaLabel}
                invalid={!!fieldErrors.docs_cta_label}
                onChange={(e) => setDocsCtaLabel(e.target.value)}
              />
            )}
          </Field>

          <Field
            label="Button link"
            required
            hint="A path like /sdk-access, or a full address."
            error={fieldErrors.docs_cta_url}
          >
            {(p) => (
              <Input
                {...p}
                value={docsCtaUrl}
                invalid={!!fieldErrors.docs_cta_url}
                onChange={(e) => setDocsCtaUrl(e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field
          label="Front page"
          hint="What a reader sees at /docs, before they pick a platform. Headings here become the contents list on the right of that page. Leave it empty to fall back to an automatic list of every published page."
          error={fieldErrors.docs_home_html}
        >
          {(p) => (
            <RichTextEditor
              {...p}
              minHeight={280}
              value={docsHome}
              invalid={!!fieldErrors.docs_home_html}
              onChange={setDocsHome}
              placeholder="Say what the SDK is, which platform to pick, and what integrating involves."
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={busy}>
          Save
        </Button>
      </div>

      <ToastStack toasts={toasts} />
    </div>
  );
}
