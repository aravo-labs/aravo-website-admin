import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "../api/client";
import { useDebounced } from "../useDebounced";
import { useAsync } from "../useAsync";

const anError = () =>
  new ApiRequestError({ code: "FORBIDDEN", message: "Not yours.", status: 403 });

describe("useAsync", () => {
  it("starts loading and settles with data", async () => {
    const { result } = renderHook(() => useAsync(async () => "loaded", []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe("loaded");
    expect(result.current.error).toBeNull();
  });

  /**
   * This app has one API client, so it never had the storefront's problem of
   * two lookalike error classes. The behaviour is worth pinning anyway: this
   * is the line that decides whether a user is told what actually went wrong
   * or is shown "Something went wrong" regardless.
   */
  it("keeps a real API error intact instead of flattening it", async () => {
    const { result } = renderHook(() =>
      useAsync(async () => { throw anError(); }, []),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.code).toBe("FORBIDDEN");
    expect(result.current.error?.message).toBe("Not yours.");
    expect(result.current.error?.status).toBe(403);
  });

  it("turns an unrecognised throw into something showable", async () => {
    const { result } = renderHook(() =>
      useAsync(async () => { throw new TypeError("undefined is not a function"); }, []),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.code).toBe("INTERNAL_ERROR");
  });

  it("does not report an abort as a failure", async () => {
    const { result, unmount } = renderHook(() =>
      useAsync(
        (signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
        [],
      ),
    );

    unmount();
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.error).toBeNull();
  });

  it("passes a signal so a superseded request can actually stop", async () => {
    const seen: AbortSignal[] = [];
    const { rerender } = renderHook(
      ({ q }: { q: string }) =>
        useAsync(async (signal) => { seen.push(signal); return q; }, [q]),
      { initialProps: { q: "a" } },
    );

    await waitFor(() => expect(seen.length).toBe(1));
    rerender({ q: "b" });
    await waitFor(() => expect(seen.length).toBe(2));

    expect(seen[0].aborted).toBe(true);
    expect(seen[1].aborted).toBe(false);
  });

  it("shows nothing stale while new arguments are loading", async () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useAsync(async () => `result for ${q}`, [q]),
      { initialProps: { q: "a" } },
    );

    await waitFor(() => expect(result.current.data).toBe("result for a"));

    rerender({ q: "b" });
    // The previous answer must not be shown as though it were this one.
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.data).toBe("result for b"));
  });

  it("clears a previous error once a reload succeeds", async () => {
    let fail = true;
    const { result } = renderHook(() =>
      useAsync(async () => {
        if (fail) throw anError();
        return "recovered";
      }, []),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    fail = false;
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.data).toBe("recovered"));
    expect(result.current.error).toBeNull();
  });

  it("reloads on demand", async () => {
    const loader = vi.fn(async () => "x");
    const { result } = renderHook(() => useAsync(loader, []));

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    act(() => result.current.reload());
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
  });

  it("lets a caller replace the data after an inline edit", async () => {
    const { result } = renderHook(() => useAsync(async () => "before", []));

    await waitFor(() => expect(result.current.data).toBe("before"));
    act(() => result.current.setData("after"));
    expect(result.current.data).toBe("after");
  });
});

describe("useDebounced", () => {
  it("holds the first value straight away", () => {
    const { result } = renderHook(() => useDebounced("a", 50));
    expect(result.current).toBe("a");
  });

  it("does not settle until the typing stops", async () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        ({ v }: { v: string }) => useDebounced(v, 300),
        { initialProps: { v: "e" } },
      );

      for (const v of ["en", "eng", "engi", "engin"]) {
        rerender({ v });
        act(() => { vi.advanceTimersByTime(50); });
      }
      // Still the first value: nothing has been quiet for 300ms.
      expect(result.current).toBe("e");

      act(() => { vi.advanceTimersByTime(300); });
      expect(result.current).toBe("engin");
    } finally {
      vi.useRealTimers();
    }
  });
});
