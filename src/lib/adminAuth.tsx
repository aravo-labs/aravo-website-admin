"use client";

/**
 * Session context for the admin panel.
 *
 * The layout already resolves the session before it renders any screen, so
 * screens read it from here rather than each calling `useSession()` and
 * re-reading localStorage. Without this, every screen renders once with an
 * empty token and fires a request that is guaranteed to 401.
 */

import { createContext, useContext } from "react";

import type { Session } from "@/lib/auth";

const AdminSessionContext = createContext<Session | null>(null);

export function AdminSessionProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  return (
    <AdminSessionContext.Provider value={session}>
      {children}
    </AdminSessionContext.Provider>
  );
}

/** The signed-in admin. Only valid inside the admin layout. */
export function useAdminSession(): Session {
  const session = useContext(AdminSessionContext);
  if (!session) {
    throw new Error("useAdminSession must be used inside the admin layout.");
  }
  return session;
}

/** Convenience for the API layer, which only ever needs the token. */
export function useAuth(): { token: string } {
  return { token: useAdminSession().accessToken };
}
