"use client";

/**
 * Who can use this panel.
 *
 * Deliberately its own screen rather than a section on Account. Adding
 * somebody here grants sight of every company on the platform, and that is
 * not a setting - it should take a decision and a click that says so.
 */

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Table,
  Td,
  Th,
  ToastStack,
  Tr,
  useToasts,
} from "@/components/ui";
import { staffApi } from "@/lib/api/admin";
import { useAdminSession, useAuth } from "@/lib/adminAuth";
import { ApiRequestError } from "@/lib/api/client";
import { useAsync } from "@/lib/useAsync";

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "never";
}

export default function StaffPage() {
  const { token } = useAuth();
  const me = useAdminSession();
  const { toasts, push } = useToasts();
  const [inviting, setInviting] = useState(false);

  const state = useAsync((signal) => staffApi.list({ token }, signal), [token]);

  async function revoke(id: string, name: string) {
    try {
      await staffApi.revoke({ token }, id);
      push(`${name} can no longer use this panel.`);
      state.reload();
    } catch (err) {
      push(
        err instanceof ApiRequestError ? err.message : "Could not revoke that.",
        "danger",
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Staff"
        description="Everyone here sees every company on the platform."
        actions={<Button onClick={() => setInviting(true)}>Invite</Button>}
      />

      {state.loading ? (
        <LoadingState label="Loading staff" />
      ) : state.error ? (
        <ErrorState
          message={state.error.message}
          code={state.error.code}
          requestId={state.error.requestId}
          onRetry={state.reload}
        />
      ) : state.data!.length === 0 ? (
        <EmptyState title="Nobody yet" description="Invite the first administrator." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Last seen</Th>
              <Th className="text-right">Access</Th>
            </tr>
          </thead>
          <tbody>
            {state.data!.map((s) => {
              const isMe = s.email === me.email;
              return (
                <Tr key={s.id}>
                  <Td>
                    {s.name}
                    {isMe && (
                      <span className="ml-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                        you
                      </span>
                    )}
                  </Td>
                  <Td className="font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]">
                    {s.email}
                  </Td>
                  <Td>
                    <Badge tone={s.is_active ? "success" : "neutral"}>
                      {s.is_active ? "active" : "revoked"}
                    </Badge>
                  </Td>
                  <Td>{when(s.last_seen_at)}</Td>
                  <Td className="text-right">
                    {/* Revoking yourself would lock you out of the panel that
                        grants access, so it is not offered rather than
                        offered and refused. */}
                    {!isMe && (
                      <Button
                        variant="ghost"
                        aria-label={`Revoke access for ${s.name}`}
                        onClick={() => revoke(s.id, s.name)}
                      >
                        Revoke
                      </Button>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Card className="mt-6">
        <CardHeader
          title="What an invitation does"
          description={
            "Creates the account, emails a link to set a password, and grants " +
            "sight of every company here. Somebody who already has an account " +
            "is added without an email and keeps the password they have."
          }
        />
      </Card>

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onDone={(message) => {
            push(message);
            setInviting(false);
            state.reload();
          }}
          token={token}
        />
      )}

      <ToastStack toasts={toasts} />
    </>
  );
}

function InviteModal({
  token,
  onClose,
  onDone,
}: {
  token: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open title="Invite an administrator" onClose={onClose}>
      <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        This grants sight of every company on the platform, including their
        delivery history and their delivery partners&rsquo; movement data.
      </p>

      <Field label="Email">
        {(props) => (
          <Input
            {...props}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field label="Name">
        {(props) => (
          <Input {...props} value={name} onChange={(e) => setName(e.target.value)} />
        )}
      </Field>

      {error && (
        <p className="mt-3 text-[length:var(--text-sm)] text-[var(--color-danger-700)]">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          loading={busy}
          disabled={!email.trim() || !name.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await staffApi.invite(
                { token },
                { email: email.trim(), name: name.trim() },
              );
              onDone(
                result.email_sent
                  ? `Invitation sent to ${email.trim()}.`
                  : `${name.trim()} already had an account and can sign in now.`,
              );
            } catch (err) {
              setError(
                err instanceof ApiRequestError
                  ? err.message
                  : "Could not send that invitation.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Send invitation
        </Button>
      </div>
    </Modal>
  );
}
