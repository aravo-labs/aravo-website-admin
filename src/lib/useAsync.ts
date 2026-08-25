"use client";

/**
 * Data loading for the admin screens.
 *
 * Small on purpose. Every list screen needs the same four things - data,
 * loading, error, reload - and getting those wrong is what produces the
 * flicker-then-error screens that make an admin panel feel unfinished.
 *
 * `loading` is derived rather than stored: it is simply "the settled result
 * is not for the arguments we are currently asking about". That keeps the
 * effect free of a synchronous setState, and removes the window where a stale
 * result is briefly shown as though it were current.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiRequestError } from "@/lib/api/client";

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: ApiRequestError | null;
  reload: () => void;
  /** Replace the data locally, e.g. after an inline status change. */
  setData: (next: T) => void;
};

type Settled<T> = {
  key: string;
  data: T | null;
  error: ApiRequestError | null;
};

function toApiError(err: unknown): ApiRequestError {
  return err instanceof ApiRequestError
    ? err
    : new ApiRequestError({
        code: "INTERNAL_ERROR",
        message: "Something went wrong.",
        status: 0,
      });
}

export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>
): AsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify(deps) + `#${nonce}`;

  const [settled, setSettled] = useState<Settled<T>>({
    key: "",
    data: null,
    error: null,
  });

  // The loader closes over fresh props on every render; keeping it in a ref
  // means the effect depends only on `key`, not on the identity of a function
  // that is rebuilt each time.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let active = true;
    // Abandoning a result is not the same as abandoning the request. Passing a
    // signal lets a superseded fetch actually stop rather than run to
    // completion for an answer nobody will read.
    const controller = new AbortController();

    loaderRef
      .current(controller.signal)
      .then((result) => {
        // A slow first request must not overwrite a faster second one.
        if (active) setSettled({ key, data: result, error: null });
      })
      .catch((err) => {
        if (!active) return;
        // An abort is this effect tearing down, not a failure to report.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSettled({ key, data: null, error: toApiError(err) });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const setData = useCallback(
    (next: T) => setSettled((s) => ({ ...s, data: next })),
    []
  );

  return {
    data: settled.key === key ? settled.data : null,
    loading: settled.key !== key,
    error: settled.key === key ? settled.error : null,
    reload,
    setData,
  };
}

/**
 * A value that settles only once the user stops changing it.
 *
 * Search boxes feed straight into `useAsync` dependencies, so without this
 * every keystroke was a request: typing "engineering" fired eleven, and the
 * ten that were superseded still ran to completion on the server.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (value === settled) return;
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, settled, delayMs]);

  return settled;
}
