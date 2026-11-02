// Reads the path of a PassKit web service request (see
// src/app/api/apple-wallet). Pure, so it can be tested.

export type ServiceCall =
  | { kind: "register" | "unregister"; device: string; serial: string }
  | { kind: "list"; device: string }
  | { kind: "pass"; serial: string }
  | { kind: "log" };

const DEVICE = /^[A-Za-z0-9._-]{1,128}$/;
const SERIAL = /^[0-9a-fA-F-]{36}$/;

/** The request for `method` and the path after /v1/, or null when it isn't one we serve. */
export function parseServicePath(method: string, path: string[], passTypeId: string): ServiceCall | null {
  const [first, a, b, c, d, ...rest] = path;
  if (rest.length) return null;

  if (first === "devices" && a && DEVICE.test(a) && b === "registrations" && c === passTypeId) {
    if (d === undefined) return method === "GET" ? { kind: "list", device: a } : null;
    if (!SERIAL.test(d)) return null;
    if (method === "POST") return { kind: "register", device: a, serial: d };
    if (method === "DELETE") return { kind: "unregister", device: a, serial: d };
    return null;
  }
  if (first === "passes" && a === passTypeId && b && SERIAL.test(b) && c === undefined) {
    return method === "GET" ? { kind: "pass", serial: b } : null;
  }
  if (first === "log" && a === undefined) return method === "POST" ? { kind: "log" } : null;
  return null;
}

/**
 * The passesUpdatedSince tag for the phone's next request: just after the
 * latest change. The database keeps microseconds and JavaScript milliseconds,
 * so it is the next whole millisecond: a change at 12:00:00.123456 must not be
 * listed again.
 */
export function nextUpdateTag(updatedAts: string[]) {
  return String(Math.max(...updatedAts.map((at) => Math.floor(Date.parse(at)) + 1)));
}
