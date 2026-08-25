"use client";

/**
 * The mail server invitations and password resets go out through.
 *
 * Three rules shape this screen, all of them enforced on the server as well:
 *
 *  - The stored password is never sent to the browser by an ordinary read.
 *    Seeing it costs your own account password, so a session left open on a
 *    desk is not enough to walk off with the credential.
 *  - Saving does not switch it on. A configuration has to send a real test
 *    message first, because an untested mail server does not fail loudly - it
 *    just quietly swallows invitations.
 *  - Changing anything about the connection turns it back off, so a typo
 *    cannot inherit the trust the previous settings earned.
 */

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  ToastStack,
  type Tone,
  useToasts,
} from "@/components/ui";
import { smtpApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import type { SmtpSecurity, SmtpSettings } from "@/lib/api/types";
import { useAdminSession, useAuth } from "@/lib/adminAuth";
import { useAsync } from "@/lib/useAsync";

const SECURITY_OPTIONS: { value: SmtpSecurity; label: string; port: number }[] = [
  { value: "starttls", label: "STARTTLS (usual)", port: 587 },
  { value: "ssl", label: "SSL / TLS", port: 465 },
  { value: "none", label: "None (not recommended)", port: 25 },
];

type Draft = {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
};

function draftFrom(settings: SmtpSettings | null, fallbackEmail: string): Draft {
  return {
    host: settings?.host ?? "",
    port: settings?.port ?? 587,
    security: settings?.security ?? "starttls",
    username: settings?.username ?? "",
    password: "",
    from_email: settings?.from_email ?? fallbackEmail,
    from_name: settings?.from_name ?? "",
  };
}

export default function SettingsPage() {
  const auth = useAuth();
  const session = useAdminSession();
  const { toasts, push } = useToasts();

  const state = useAsync(() => smtpApi.get(auth), [auth.token]);

  if (state.loading) return <LoadingState label="Loading mail settings" />;
  if (state.error) {
    return (
      <ErrorState
        message={state.error.message}
        code={state.error.code}
        requestId={state.error.requestId}
        onRetry={state.reload}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Mail server"
        description="Where invitations and password resets are sent from."
      />
      <SmtpForm
        key={state.data?.updated_at ?? "new"}
        settings={state.data ?? null}
        accountEmail={session.email ?? ""}
        onSaved={state.reload}
        push={push}
      />
      <ToastStack toasts={toasts} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function SmtpForm({
  settings,
  accountEmail,
  onSaved,
  push,
}: {
  settings: SmtpSettings | null;
  accountEmail: string;
  onSaved: () => void;
  push: (message: string, tone?: Tone) => void;
}) {
  const auth = useAuth();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings, accountEmail));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "test" | "toggle">(null);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function handleApiError(err: unknown, fallback: string) {
    if (err instanceof ApiRequestError) {
      setFieldErrors(err.fieldErrors);
      setFormError(err.summary);
      push(err.summary, "danger");
    } else {
      setFormError(fallback);
      push(fallback, "danger");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setBusy("save");
    try {
      await smtpApi.save(auth, {
        host: draft.host,
        port: Number(draft.port),
        security: draft.security,
        username: draft.username || null,
        // Undefined means "keep the stored one", which is how the port can be
        // changed without retyping a password nobody can see.
        password: draft.password ? draft.password : undefined,
        from_email: draft.from_email,
        from_name: draft.from_name || null,
      });
      setDraft((d) => ({ ...d, password: "" }));
      setRevealed(null);
      push("Saved. Send a test message to switch it on.");
      onSaved();
    } catch (err) {
      handleApiError(err, "Could not save the mail settings.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setFormError(null);
    setBusy("test");
    try {
      const result = await smtpApi.test(auth);
      push(`Test sent to ${result.sent_to}. Check the inbox.`);
      onSaved();
    } catch (err) {
      handleApiError(err, "Could not send the test message.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(next: boolean) {
    setFormError(null);
    setBusy("toggle");
    try {
      await smtpApi.setActive(auth, next);
      push(
        next
          ? "Live. Invitations and resets now send through this server."
          : "Switched off. Falling back to the built-in sender."
      );
      onSaved();
    } catch (err) {
      handleApiError(err, "Could not change that.");
    } finally {
      setBusy(null);
    }
  }

  const saved = settings !== null;
  const tested = Boolean(settings?.last_tested_at);

  return (
    <div className="flex flex-col gap-5">
      {saved && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <Badge tone={settings.is_active ? "success" : "neutral"}>
                {settings.is_active ? "Live" : "Not in use"}
              </Badge>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {settings.is_active
                  ? "Invitations and password resets send through this server."
                  : tested
                    ? "Tested and ready. Switch it on to start using it."
                    : "Send a test message before switching it on."}
              </p>
            </div>
            <Button
              variant={settings.is_active ? "secondary" : "primary"}
              size="sm"
              loading={busy === "toggle"}
              disabled={!settings.is_active && !tested}
              onClick={() => toggleActive(!settings.is_active)}
            >
              {settings.is_active ? "Switch off" : "Switch on"}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Connection"
          description="Your provider gives you these. The port usually follows the encryption setting."
        />
        <form onSubmit={save} className="flex flex-col gap-4 p-5 pt-0">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="Host" required error={fieldErrors.host}>
              {(props) => (
                <Input
                  {...props}
                  value={draft.host}
                  placeholder="smtp.example.com"
                  onChange={(e) => set("host", e.target.value)}
                />
              )}
            </Field>
            <Field label="Port" required error={fieldErrors.port}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  value={draft.port}
                  onChange={(e) => set("port", Number(e.target.value))}
                />
              )}
            </Field>
          </div>

          <Field label="Encryption" error={fieldErrors.security}>
            {(props) => (
              <Select
                {...props}
                value={draft.security}
                onChange={(e) => {
                  const next = e.target.value as SmtpSecurity;
                  const match = SECURITY_OPTIONS.find((o) => o.value === next);
                  // Move the port with it, since the two go together and a
                  // mismatch is the most common reason a send times out.
                  setDraft((d) => ({ ...d, security: next, port: match?.port ?? d.port }));
                }}
              >
                {SECURITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Username" error={fieldErrors.username}>
            {(props) => (
              <Input
                {...props}
                autoComplete="off"
                value={draft.username}
                onChange={(e) => set("username", e.target.value)}
              />
            )}
          </Field>

          <PasswordField
            hasStored={Boolean(settings?.has_password)}
            value={draft.password}
            revealed={revealed}
            error={fieldErrors.password}
            onChange={(value) => set("password", value)}
            onReveal={() => setRevealing(true)}
            onHide={() => setRevealed(null)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="From address"
              required
              hint="Must be one your provider allows you to send as."
              error={fieldErrors.from_email}
            >
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={draft.from_email}
                  onChange={(e) => set("from_email", e.target.value)}
                />
              )}
            </Field>
            <Field label="From name" error={fieldErrors.from_name}>
              {(props) => (
                <Input
                  {...props}
                  value={draft.from_name}
                  placeholder="Careers team"
                  onChange={(e) => set("from_name", e.target.value)}
                />
              )}
            </Field>
          </div>

          {formError && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-danger-700)]">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={busy === "save"}>
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy === "test"}
              disabled={!saved}
              onClick={sendTest}
            >
              Send test message
            </Button>
            {saved && settings.last_tested_at && (
              <span className="font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
                last tested {new Date(settings.last_tested_at).toLocaleString()}
              </span>
            )}
          </div>

          {saved && settings.updated_by && (
            <p className="font-mono text-[length:var(--text-2xs)] text-[var(--color-text-subtle)]">
              last changed by {settings.updated_by}
            </p>
          )}
        </form>
      </Card>

      <Card>
        <div className="p-5">
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            While this is switched off, invitations and password resets go through
            the built-in sender, which is rate limited to a handful of messages and
            is not meant for production. Nothing breaks without it, but it will not
            carry real volume.
          </p>
        </div>
      </Card>

      <RevealModal
        open={revealing}
        onClose={() => setRevealing(false)}
        onRevealed={(password) => {
          setRevealed(password);
          setRevealing(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PasswordField({
  hasStored,
  value,
  revealed,
  error,
  onChange,
  onReveal,
  onHide,
}: {
  hasStored: boolean;
  value: string;
  revealed: string | null;
  error?: string;
  onChange: (value: string) => void;
  onReveal: () => void;
  onHide: () => void;
}) {
  return (
    <div>
      <Field
        label="Password"
        error={error}
        hint={
          hasStored && !value
            ? "A password is saved. Leave this empty to keep it."
            : "Stored encrypted. It is never shown without your account password."
        }
      >
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            value={value}
            placeholder={hasStored ? "••••••••••••" : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </Field>

      {hasStored && (
        <div className="mt-2 flex items-center gap-3">
          {revealed === null ? (
            <button
              type="button"
              onClick={onReveal}
              className="text-[length:var(--text-xs)] text-[var(--color-accent)] underline underline-offset-2"
            >
              Show the saved password
            </button>
          ) : (
            <>
              <code className="rounded-[var(--radius-sm)] bg-[var(--color-surface-hover)] px-2 py-1 font-mono text-[length:var(--text-xs)]">
                {revealed}
              </code>
              <button
                type="button"
                onClick={onHide}
                className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] underline underline-offset-2"
              >
                Hide
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RevealModal({
  open,
  onClose,
  onRevealed,
}: {
  open: boolean;
  onClose: () => void;
  onRevealed: (password: string) => void;
}) {
  const auth = useAuth();
  const [accountPassword, setAccountPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { password } = await smtpApi.reveal(auth, accountPassword);
      onRevealed(password);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Could not verify that."
      );
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Confirm it is you" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          Enter your own account password to see the saved mail server password.
        </p>

        <Field label="Your account password" required>
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              autoFocus
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
            />
          )}
        </Field>

        {error && (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-danger-50)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--color-danger-700)]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!accountPassword}>
            Show password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
