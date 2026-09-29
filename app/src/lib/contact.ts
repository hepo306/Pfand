import nacl from "tweetnacl";
import bs58 from "bs58";
import type { PublicKey } from "@solana/web3.js";

/**
 * Guest contact details (name + email) are stored on-chain in the ticket, but
 * encrypted so that only the organizer can read them.
 *
 * The organizer's decryption key is derived from a wallet signature over a
 * fixed message. Ed25519 signatures are deterministic, so the same wallet always
 * re-derives the same key: nothing extra to store or lose.
 */
export type Contact = { name: string; email: string };

export const guestKeyMessage = (event: PublicKey) =>
  new TextEncoder().encode(
    `Pfand: unlock the guest list for event ${event.toBase58()}\n\nSigning this is free and does not send a transaction.`,
  );

export function deriveGuestKeypair(signature: Uint8Array) {
  return nacl.box.keyPair.fromSecretKey(nacl.hash(signature).slice(0, 32));
}

/** ephemeral public key (32) | nonce (24) | ciphertext */
export function encryptContact(contact: Contact, guestKey: Uint8Array): Uint8Array {
  const msg = new TextEncoder().encode(JSON.stringify({ n: contact.name.trim(), e: contact.email.trim() }));
  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);
  const box = nacl.box(msg, nonce, guestKey, eph.secretKey);
  const out = new Uint8Array(32 + 24 + box.length);
  out.set(eph.publicKey, 0);
  out.set(nonce, 32);
  out.set(box, 56);
  return out;
}

export function decryptContact(data: Uint8Array, secret: Uint8Array): Contact | null {
  if (data.length < 56 + 16) return null;
  const opened = nacl.box.open(data.slice(56), data.slice(32, 56), data.slice(0, 32), secret);
  if (!opened) return null;
  try {
    const { n, e } = JSON.parse(new TextDecoder().decode(opened));
    return { name: String(n ?? ""), email: String(e ?? "") };
  } catch {
    return null;
  }
}

/** Contact JSON must fit the program's 256-byte limit after encryption. */
export const contactFits = (c: Contact) =>
  new TextEncoder().encode(JSON.stringify({ n: c.name.trim(), e: c.email.trim() })).length + 72 <= 256;

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

// ---- local convenience storage (this browser only) ----

const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export function rememberGuestSecret(event: PublicKey, secret: Uint8Array) {
  safeSet(`pfand.guestkey.${event.toBase58()}`, bs58.encode(secret));
}
export function recallGuestSecret(event: PublicKey): Uint8Array | null {
  const v = safeGet(`pfand.guestkey.${event.toBase58()}`);
  try {
    return v ? bs58.decode(v) : null;
  } catch {
    return null;
  }
}

/** The guest's own details, to prefill forms and label their ticket. */
export function rememberMe(c: Contact, event?: PublicKey) {
  safeSet("pfand.me", JSON.stringify(c));
  if (event) safeSet(`pfand.ticket.${event.toBase58()}`, c.name);
}
export function recallMe(): Contact | null {
  try {
    const v = safeGet("pfand.me");
    return v ? (JSON.parse(v) as Contact) : null;
  } catch {
    return null;
  }
}
export const recallTicketName = (event: PublicKey) => safeGet(`pfand.ticket.${event.toBase58()}`);
