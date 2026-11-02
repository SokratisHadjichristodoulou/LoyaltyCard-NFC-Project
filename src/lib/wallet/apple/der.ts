// Just enough DER (ASN.1) to sign an Apple Wallet pass: read a certificate's
// issuer and serial number, and write a PKCS #7 signature. Pure, so tested.

export function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type Tlv = { tag: number; start: number; contentStart: number; end: number };

/** The element starting at `offset` (single-byte tags, definite lengths: what DER allows). */
export function readTlv(der: Uint8Array, offset = 0): Tlv {
  const tag = der[offset];
  let length = der[offset + 1];
  let contentStart = offset + 2;
  if (length & 0x80) {
    const bytes = length & 0x7f;
    if (bytes === 0 || bytes > 4) throw new Error("Unsupported DER length");
    length = 0;
    for (let i = 0; i < bytes; i++) length = length * 256 + der[contentStart + i];
    contentStart += bytes;
  }
  const end = contentStart + length;
  if (tag === undefined || end > der.length) throw new Error("Truncated DER");
  return { tag, start: offset, contentStart, end };
}

/** The elements inside a constructed element (SEQUENCE, SET, [n]). */
export function childrenOf(der: Uint8Array, parent: Tlv) {
  const out: Tlv[] = [];
  for (let at = parent.contentStart; at < parent.end; ) {
    const child = readTlv(der, at);
    out.push(child);
    at = child.end;
  }
  return out;
}

export const bytesOf = (der: Uint8Array, tlv: Tlv) => der.subarray(tlv.start, tlv.end);

/**
 * A certificate's issuer (Name) and serial number (INTEGER), as encoded: what
 * a PKCS #7 signature uses to say which certificate signed it.
 */
export function issuerAndSerial(certificate: Uint8Array) {
  const cert = readTlv(certificate);
  const tbs = childrenOf(certificate, cert)[0];
  const fields = childrenOf(certificate, tbs);
  const i = fields[0].tag === 0xa0 ? 1 : 0; // [0] version is optional
  return { serial: bytesOf(certificate, fields[i]), issuer: bytesOf(certificate, fields[i + 2]) };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function lengthBytes(length: number) {
  if (length < 0x80) return Uint8Array.of(length);
  const bytes: number[] = [];
  for (let n = length; n > 0; n = Math.floor(n / 256)) bytes.unshift(n & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

export function tlv(tag: number, ...content: Uint8Array[]) {
  const body = concat(...content);
  return concat(Uint8Array.of(tag), lengthBytes(body.length), body);
}

export const sequence = (...items: Uint8Array[]) => tlv(0x30, ...items);

/** A SET OF, with its elements in DER order (sorted by their encoding). */
export function setOf(...items: Uint8Array[]) {
  const sorted = [...items].sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  });
  return tlv(0x31, ...sorted);
}

export const contextExplicit = (n: number, ...items: Uint8Array[]) => tlv(0xa0 + n, ...items);
export const octetString = (bytes: Uint8Array) => tlv(0x04, bytes);
export const nullValue = () => Uint8Array.of(0x05, 0x00);

export function smallInteger(n: number) {
  if (n < 0 || n > 127) throw new Error("smallInteger takes 0..127");
  return Uint8Array.of(0x02, 0x01, n);
}

export function oid(dotted: string) {
  const arcs = dotted.split(".").map(Number);
  const bytes = [arcs[0] * 40 + arcs[1]];
  for (const arc of arcs.slice(2)) {
    const chunk = [arc & 0x7f];
    for (let n = Math.floor(arc / 128); n > 0; n = Math.floor(n / 128)) chunk.unshift((n & 0x7f) | 0x80);
    bytes.push(...chunk);
  }
  return tlv(0x06, Uint8Array.from(bytes));
}

/** UTCTime (YYMMDDHHMMSSZ), valid 1950–2049. */
export function utcTime(date: Date) {
  const two = (n: number) => String(n).padStart(2, "0");
  const text =
    two(date.getUTCFullYear() % 100) + two(date.getUTCMonth() + 1) + two(date.getUTCDate()) +
    two(date.getUTCHours()) + two(date.getUTCMinutes()) + two(date.getUTCSeconds()) + "Z";
  return tlv(0x17, new TextEncoder().encode(text));
}

// ---------------------------------------------------------------------------
// PEM
// ---------------------------------------------------------------------------

/**
 * Every block of the given type ("CERTIFICATE", "PRIVATE KEY", ...) in a PEM
 * text, as DER. Ignores anything around the blocks (e.g. OpenSSL's "Bag
 * Attributes" lines) and accepts "\n" written as two characters.
 */
export function pemBlocks(pem: string, type: string) {
  const text = pem.replace(/\\n/g, "\n");
  const pattern = new RegExp(`-----BEGIN ${type}-----([\\s\\S]*?)-----END ${type}-----`, "g");
  return [...text.matchAll(pattern)].map((m) => Uint8Array.from(atob(m[1].replace(/\s+/g, "")), (c) => c.charCodeAt(0)));
}
