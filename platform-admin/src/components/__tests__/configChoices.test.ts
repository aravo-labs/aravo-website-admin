import { describe, expect, it } from "vitest";

import { CHOICES } from "@/components/ConfigEditor";

/**
 * The payload format was a free text box, and `dsdp` was typed into it. A
 * value the handset does not understand looked exactly like a valid one until
 * batches started failing, so the list is the fix and these pin it.
 */
describe("payload format choices", () => {
  const formats = CHOICES["misc.payloadFormat"];

  it("offers the three formats the SDK sends, and nothing else", () => {
    expect(formats.map((c) => c.value)).toEqual(["json", "v3", "dsdp"]);
  });

  it("labels them exactly as they go over the wire", () => {
    // Lower case: these are the literal strings, not display names.
    for (const c of formats) expect(c.label).toBe(c.value);
  });

  it("has no duplicate values, which would make a select ambiguous", () => {
    expect(new Set(formats.map((c) => c.value)).size).toBe(formats.length);
  });
});
