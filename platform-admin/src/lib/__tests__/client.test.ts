import { describe, expect, it } from "vitest";

import { ApiRequestError } from "../api/client";

/**
 * ApiRequestError decides what a user is told when something fails, and most
 * of that logic exists because of a specific failure that reached someone.
 * The comments in client.ts record those; these pin them down.
 */
const err = (over: Partial<ConstructorParameters<typeof ApiRequestError>[0]> = {}) =>
  new ApiRequestError({
    code: "VALIDATION_ERROR",
    message: "The request failed validation.",
    status: 422,
    ...over,
  });

describe("ApiRequestError", () => {
  describe("fieldErrors", () => {
    it("keys messages by field so a form can put them beside inputs", () => {
      expect(
        err({ details: [
          { field: "email", message: "Enter an email address." },
          { field: "name", message: "Required." },
        ] }).fieldErrors,
      ).toEqual({ email: "Enter an email address.", name: "Required." });
    });

    it("keeps the first message when a field has several", () => {
      expect(
        err({ details: [
          { field: "email", message: "first" },
          { field: "email", message: "second" },
        ] }).fieldErrors,
      ).toEqual({ email: "first" });
    });

    it("ignores details with no field", () => {
      expect(err({ details: [{ message: "whole-form problem" }] }).fieldErrors).toEqual({});
    });

    it("is empty rather than undefined when there are no details", () => {
      expect(err().fieldErrors).toEqual({});
      expect(err({ details: null }).fieldErrors).toEqual({});
    });
  });

  describe("formErrors", () => {
    it("collects the details that belong to no single input", () => {
      expect(
        err({ details: [
          { field: "email", message: "beside the input" },
          { message: "a cross-field rule" },
        ] }).formErrors,
      ).toEqual(["a cross-field rule"]);
    });
  });

  describe("formMessage: what a form prints at the top", () => {
    it("stays quiet when a field error already speaks for itself", () => {
      expect(err({ details: [{ field: "email", message: "Required." }] }).formMessage).toBeNull();
    });

    it("speaks when the only field error is a path no form renders", () => {
      // The regression this getter was written for: a 409 whose one detail
      // pointed at a field the editor had no slot for. The save failed, the
      // modal stayed open, and nothing appeared at all.
      const message = err({ details: [{ field: "items.0.label", message: "Required." }] }).formMessage;
      expect(message).not.toBeNull();
      expect(message).toContain("Required.");
    });

    it("always speaks for a failure that is not a validation error", () => {
      expect(
        err({ code: "CONFLICT", message: "That name is taken.", status: 409,
              details: [{ field: "status", message: "Required." }] }).formMessage,
      ).toBe("That name is taken.");
    });

    it("prefers a whole-form message over anything else", () => {
      expect(
        err({ details: [
          { message: "Pick at least one item." },
          { field: "items", message: "Required." },
        ] }).formMessage,
      ).toBe("Pick at least one item.");
    });
  });

  describe("summary", () => {
    it("prefers a form-level sentence", () => {
      expect(err({ details: [{ message: "Pick at least one." }] }).summary).toBe("Pick at least one.");
    });

    it("falls back to the message", () => {
      expect(err().summary).toBe("The request failed validation.");
    });
  });

  describe("isAuth", () => {
    it.each([["UNAUTHENTICATED"], ["FORBIDDEN"]])("is true for %s", (code) => {
      expect(err({ code, status: 401 }).isAuth).toBe(true);
    });

    it.each([["VALIDATION_ERROR"], ["CONFLICT"], ["INTERNAL_ERROR"]])(
      "is false for %s", (code) => {
        expect(err({ code, status: 500 }).isAuth).toBe(false);
      },
    );
  });

  describe("isRetryable", () => {
    it("is false for a validation failure, which retrying cannot fix", () => {
      expect(err().isRetryable).toBe(false);
    });
  });

  it("carries the request id, which is what support asks for", () => {
    expect(err({ requestId: "req-abc" }).requestId).toBe("req-abc");
    expect(err().requestId).toBeNull();
  });

  it("is a real Error, so it survives being thrown and caught", () => {
    const thrown = err({ message: "boom" });
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toBeInstanceOf(ApiRequestError);
    expect(thrown.name).toBe("ApiRequestError");
    expect(thrown.message).toBe("boom");
  });
});
