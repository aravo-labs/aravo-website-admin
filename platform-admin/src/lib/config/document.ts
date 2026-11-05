/**
 * Reading and writing a configuration document by dotted path.
 *
 * The editor works in terms of leaves - `motion.samplingHz` - while the API
 * stores and merges nested objects. These are the operations that translate
 * between the two, kept away from the components so they can be tested on
 * their own.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

export type Leaf = {
  /** Dotted path, e.g. `misc.geofence.enabled`. */
  path: string;
  /** The last segment, for labelling. */
  key: string;
  value: Json;
};

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every leaf in the document, depth first.
 *
 * An array counts as a leaf: `ble.serviceUuids` is one setting a person edits
 * as a list, not a branch with numbered children.
 */
export function leaves(document: JsonObject, prefix = ""): Leaf[] {
  const out: Leaf[] = [];
  for (const [key, value] of Object.entries(document)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(value)) out.push(...leaves(value, path));
    else out.push({ path, key, value });
  }
  return out;
}

/** The value at a dotted path, or undefined if nothing is there. */
export function readPath(document: JsonObject, path: string): Json | undefined {
  let cursor: Json | undefined = document;
  for (const segment of path.split(".")) {
    if (!isObject(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

/** True if this document sets the path itself, whatever the value. */
export function hasPath(document: JsonObject, path: string): boolean {
  return readPath(document, path) !== undefined;
}

/**
 * The document with `path` set to `value`, parents created as needed.
 *
 * Returns a new object rather than mutating: the editor keeps the saved
 * document and the draft side by side to decide what is dirty, and a mutation
 * would quietly make them the same object.
 */
export function writePath(
  document: JsonObject,
  path: string,
  value: Json,
): JsonObject {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) return { ...document, [head]: value };

  const child = document[head];
  return {
    ...document,
    [head]: writePath(isObject(child) ? child : {}, rest.join("."), value),
  };
}

/**
 * The document with `path` removed, and any parent it leaves empty removed too.
 *
 * The pruning matters. Reverting the only overridden setting under `motion`
 * would otherwise leave `{"motion": {}}` behind, which reads in the saved
 * payload and in the audit record as though this level still overrode
 * something there.
 */
export function clearPath(document: JsonObject, path: string): JsonObject {
  const [head, ...rest] = path.split(".");
  if (!(head in document)) return document;

  if (rest.length === 0) {
    const copy = { ...document };
    delete copy[head];
    return copy;
  }

  const child = document[head];
  if (!isObject(child)) return document;

  const pruned = clearPath(child, rest.join("."));
  if (Object.keys(pruned).length === 0) {
    const copy = { ...document };
    delete copy[head];
    return copy;
  }
  return { ...document, [head]: pruned };
}

/**
 * Whether two documents hold the same settings.
 *
 * Compared leaf by leaf rather than by serialising: two objects built in a
 * different key order are the same configuration, and a string comparison
 * would call the draft dirty the moment a save round-tripped it through the
 * API, leaving an unsaved-changes bar nobody can clear.
 */
export function sameDocument(a: JsonObject, b: JsonObject): boolean {
  const flatten = (doc: JsonObject) =>
    leaves(doc)
      .map((l) => `${l.path}=${JSON.stringify(l.value)}`)
      .sort()
      .join("\u0000");
  return flatten(a) === flatten(b);
}

/** `samplingHz` as "Sampling hz"; `rttMaxPeersPerRequest` as "Rtt max peers per request". */
export function humanise(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
