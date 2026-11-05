import { afterEach, describe, expect, it, vi } from "vitest";

import { BASE_URL } from "../api/client";
import { requestPasswordReset } from "../auth";

/**
 * Which service the reset request goes to.
 *
 * The address was assembled here a second time instead of being taken from the
 * API client, and its fallback said 8010: the CMS behind the marketing site,
 * which has no such endpoint. Production set the variable so the mistake only
 * showed on a fresh clone, and it showed as nothing at all, because the failure
 * is swallowed on purpose so the response cannot reveal who has an account.
 */
afterEach(() => vi.unstubAllGlobals());

const capture = () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("requestPasswordReset", () => {
  it("asks the platform API the panel already talks to", async () => {
    const fetchMock = capture();
    await requestPasswordReset("staff@aravo.example");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/public/password-reset`);
  });

  it("sends the address as JSON", async () => {
    const fetchMock = capture();
    await requestPasswordReset("staff@aravo.example");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "staff@aravo.example" });
  });

  it("stays quiet when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(requestPasswordReset("staff@aravo.example")).resolves.toBeUndefined();
  });
});
