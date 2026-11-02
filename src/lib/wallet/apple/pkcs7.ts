// The "signature" file of an Apple Wallet pass: a detached PKCS #7 (CMS)
// SignedData over manifest.json, made with the Pass Type ID certificate and
// key, and carrying Apple's WWDR intermediate certificate. Built with Web
// Crypto, so it runs on Node and Cloudflare Workers alike. Pure, so tested
// (the test checks the result with `openssl smime -verify`).

import {
  concat,
  contextExplicit,
  issuerAndSerial,
  nullValue,
  octetString,
  oid,
  pemBlocks,
  sequence,
  setOf,
  smallInteger,
  tlv,
  utcTime,
} from "./der";

const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  sha256: "2.16.840.1.101.3.4.2.1",
  rsaEncryption: "1.2.840.113549.1.1.1",
};

const algorithm = (id: string) => sequence(oid(id), nullValue());
const attribute = (id: string, value: Uint8Array) => sequence(oid(id), setOf(value));

/**
 * Imports an RSA private key from PEM: PKCS #8 ("BEGIN PRIVATE KEY") or
 * PKCS #1 ("BEGIN RSA PRIVATE KEY", as older OpenSSL writes it).
 */
export async function importRsaSigningKey(pem: string) {
  let pkcs8 = pemBlocks(pem, "PRIVATE KEY")[0];
  if (!pkcs8) {
    const pkcs1 = pemBlocks(pem, "RSA PRIVATE KEY")[0];
    if (!pkcs1) throw new Error("No PRIVATE KEY or RSA PRIVATE KEY block (an encrypted key must be decrypted first)");
    pkcs8 = sequence(smallInteger(0), algorithm(OID.rsaEncryption), octetString(pkcs1));
  }
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export type Signer = {
  /** The signing certificate (DER). */
  certificate: Uint8Array;
  /** Further certificates to include, e.g. Apple's WWDR intermediate (DER). */
  chain: Uint8Array[];
  privateKey: CryptoKey;
};

/** A detached PKCS #7 signature (DER) of `content`. */
export async function signDetached(content: Uint8Array<ArrayBuffer>, signer: Signer, signingTime = new Date()) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", content));
  const attributes = [
    attribute(OID.contentType, oid(OID.data)),
    attribute(OID.signingTime, utcTime(signingTime)),
    attribute(OID.messageDigest, octetString(digest)),
  ];
  // The signature covers the attributes encoded as a SET (tag 0x31) ...
  const signedSet = setOf(...attributes);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signer.privateKey, signedSet));
  // ... while the SignerInfo carries them as [0] IMPLICIT (tag 0xa0), same content.
  const signedAttrs = concat(Uint8Array.of(0xa0), signedSet.subarray(1));

  const { issuer, serial } = issuerAndSerial(signer.certificate);
  const signerInfo = sequence(
    smallInteger(1),
    sequence(issuer, serial),
    algorithm(OID.sha256),
    signedAttrs,
    algorithm(OID.rsaEncryption),
    octetString(signature),
  );
  const signedData = sequence(
    smallInteger(1),
    setOf(algorithm(OID.sha256)),
    sequence(oid(OID.data)), // detached: no content
    tlv(0xa0, signer.certificate, ...signer.chain), // [0] IMPLICIT certificates
    setOf(signerInfo),
  );
  return sequence(oid(OID.signedData), contextExplicit(0, signedData));
}
