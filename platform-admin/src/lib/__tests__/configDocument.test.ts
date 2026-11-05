import { describe, expect, it } from "vitest";

import {
  clearPath,
  hasPath,
  humanise,
  leaves,
  readPath,
  sameDocument,
  writePath,
  type JsonObject,
} from "../config/document";

/**
 * These four operations are what keeps the editor's promise: it edits the
 * overrides for one level, never the merged document. Saving a merged
 * document as an override would pin a company to whatever the defaults
 * happened to be the day somebody first opened the screen - the exact
 * outcome the API's deep merge exists to prevent.
 */

const doc = (): JsonObject => ({
  motion: { enabled: true, samplingHz: 100 },
  ble: { enabled: false, serviceUuids: [] },
});

describe("leaves", () => {
  it("walks to the bottom and names each leaf by its full path", () => {
    expect(leaves(doc()).map((l) => l.path)).toEqual([
      "motion.enabled",
      "motion.samplingHz",
      "ble.enabled",
      "ble.serviceUuids",
    ]);
  });

  it("treats an array as one setting, not a branch of numbered children", () => {
    // `ble.serviceUuids` is a list a person edits as a list. Walking into it
    // would produce `ble.serviceUuids.0`, which is not a setting and has no
    // control to render it.
    const found = leaves({ ble: { serviceUuids: ["a", "b"] } });
    expect(found).toHaveLength(1);
    expect(found[0].value).toEqual(["a", "b"]);
  });
});

describe("readPath / hasPath", () => {
  it("reads through nesting", () => {
    expect(readPath(doc(), "motion.samplingHz")).toBe(100);
  });

  it("reports nothing for a path that is not there", () => {
    expect(readPath(doc(), "wifi.enabled")).toBeUndefined();
    expect(hasPath(doc(), "wifi.enabled")).toBe(false);
  });

  it("counts a falsy value as set", () => {
    // The whole screen turns on this distinction: `false` is an override that
    // turns a sensor off, and treating it as absent would show the row as
    // inherited and silently drop it from the save.
    expect(hasPath(doc(), "ble.enabled")).toBe(true);
  });
});

describe("writePath", () => {
  it("sets a nested value", () => {
    expect(writePath(doc(), "motion.samplingHz", 25)).toMatchObject({
      motion: { samplingHz: 25 },
    });
  });

  it("creates the parents for a path nothing has yet", () => {
    expect(writePath({}, "misc.geofence.enabled", false)).toEqual({
      misc: { geofence: { enabled: false } },
    });
  });

  it("leaves the original untouched", () => {
    const before = doc();
    writePath(before, "motion.samplingHz", 25);
    expect(before.motion).toEqual({ enabled: true, samplingHz: 100 });
  });

  it("keeps the siblings of the value it sets", () => {
    const after = writePath(doc(), "motion.samplingHz", 25) as JsonObject;
    expect(after.motion).toEqual({ enabled: true, samplingHz: 25 });
  });
});

describe("clearPath", () => {
  it("removes the setting", () => {
    const after = clearPath(doc(), "motion.samplingHz") as JsonObject;
    expect(after.motion).toEqual({ enabled: true });
  });

  it("removes a parent it leaves empty", () => {
    // Otherwise `{"motion": {}}` is saved and recorded, which reads as "this
    // level still overrides something under motion" when it no longer does.
    const after = clearPath({ motion: { samplingHz: 25 } }, "motion.samplingHz");
    expect(after).toEqual({});
  });

  it("prunes every level that empties, not just the last one", () => {
    const after = clearPath(
      { misc: { geofence: { enabled: false } } },
      "misc.geofence.enabled",
    );
    expect(after).toEqual({});
  });

  it("stops pruning where a sibling survives", () => {
    const after = clearPath(
      { misc: { sdkEnabled: true, geofence: { enabled: false } } },
      "misc.geofence.enabled",
    );
    expect(after).toEqual({ misc: { sdkEnabled: true } });
  });

  it("is a no-op for a path that was never set", () => {
    expect(clearPath(doc(), "wifi.enabled")).toEqual(doc());
  });
});

describe("humanise", () => {
  it("splits camel case", () => {
    expect(humanise("samplingHz")).toBe("Sampling hz");
    expect(humanise("rttMaxPeersPerRequest")).toBe("Rtt max peers per request");
  });

  it("keeps runs of capitals together", () => {
    expect(humanise("minRssiDbm")).toBe("Min rssi dbm");
  });

  it("leaves a single word alone but for its first letter", () => {
    expect(humanise("enabled")).toBe("Enabled");
  });
});

describe("sameDocument", () => {
  it("ignores key order", () => {
    // A save round-trips the draft through the API, which is free to return
    // the keys in another order. Comparing serialised strings would call the
    // freshly saved draft dirty and leave a save bar that cannot be cleared.
    expect(
      sameDocument(
        { motion: { enabled: true, samplingHz: 25 } },
        { motion: { samplingHz: 25, enabled: true } },
      ),
    ).toBe(true);
  });

  it("sees a changed value", () => {
    expect(
      sameDocument({ motion: { samplingHz: 25 } }, { motion: { samplingHz: 26 } }),
    ).toBe(false);
  });

  it("sees an added setting", () => {
    expect(sameDocument({}, { ble: { enabled: true } })).toBe(false);
  });

  it("distinguishes types that print the same", () => {
    expect(
      sameDocument({ misc: { payloadFormat: "1" } }, { misc: { payloadFormat: 1 } }),
    ).toBe(false);
  });
});
