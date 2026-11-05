"use client";

import { useEffect, useState } from "react";

/**
 * A value that settles before anything acts on it.
 *
 * Filter boxes were wired straight into the query, so typing a seven character
 * company name fired seven searches. Six of them were obsolete before
 * they returned: the useAsync hook discards their results correctly, but the
 * server still did the work, and on a large company list that is six
 * unnecessary table scans per word typed.
 *
 * 300ms is below the point a person notices a delay and above a comfortable
 * typing cadence, so a whole word usually costs one request.
 */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return settled;
}
