import { AnchorProvider, BN, Program, type IdlAccounts } from "@anchor-lang/core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "../idl/pfand.json";
import type { Pfand } from "../idl/pfand-types";
import { PROGRAM_ID, TEST_EUR_MINT, TOKEN_DECIMALS } from "./config";

export type EventAccount = IdlAccounts<Pfand>["event"];
export type TicketAccount = IdlAccounts<Pfand>["ticket"];
export type EventWithKey = { publicKey: PublicKey; account: EventAccount };
export type TicketWithKey = { publicKey: PublicKey; account: TicketAccount };

const enc = new TextEncoder();

/** Read-only wallet used when nobody is connected. */
const readOnlyWallet: AnchorWallet = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error("Connect a wallet first");
  },
  signAllTransactions: async () => {
    throw new Error("Connect a wallet first");
  },
};

export function getProgram(connection: Connection, wallet?: AnchorWallet | null) {
  const provider = new AnchorProvider(connection, wallet ?? readOnlyWallet, {
    commitment: "confirmed",
  });
  return new Program<Pfand>(idl as Pfand, provider);
}
export type PfandProgram = ReturnType<typeof getProgram>;

export const eventPda = (organizer: PublicKey, eventId: BN) =>
  PublicKey.findProgramAddressSync(
    [enc.encode("event"), organizer.toBuffer(), eventId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID,
  )[0];

export const ticketPda = (event: PublicKey, attendee: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [enc.encode("ticket"), event.toBuffer(), attendee.toBuffer()],
    PROGRAM_ID,
  )[0];

export const ata = (owner: PublicKey, mint: PublicKey = TEST_EUR_MINT) =>
  getAssociatedTokenAddressSync(mint, owner, true);

export function randomEventId(): BN {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return new BN(bytes, "le");
}

// ---------- formatting ----------

export function toBaseUnits(euros: number): BN {
  return new BN(Math.round(euros * 10 ** TOKEN_DECIMALS));
}

export function formatEur(amount: BN | number | bigint, withSymbol = true): string {
  const n = typeof amount === "number" ? amount : Number(amount.toString());
  const value = n / 10 ** TOKEN_DECIMALS;
  const s = new Intl.NumberFormat("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return withSymbol ? `€${s}` : s;
}

export function formatDate(ts: BN | number): string {
  const n = typeof ts === "number" ? ts : ts.toNumber();
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(n * 1000));
}

export const shortKey = (k: PublicKey | string) => {
  const s = k.toString();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};

export type EventPhase = "open" | "cancel-closed" | "live" | "ended" | "settled";

export function eventPhase(e: EventAccount, now = Date.now() / 1000): EventPhase {
  if (e.settled) return "settled";
  if (now >= e.endsAt.toNumber()) return "ended";
  if (now >= e.startsAt.toNumber()) return "live";
  if (now > e.cancelUntil.toNumber()) return "cancel-closed";
  return "open";
}

export const isCheckedIn = (t: TicketAccount) => "checkedIn" in t.status;

// ---------- QR payload ----------

const QR_PREFIX = "pfand1";
export const ticketQrPayload = (event: PublicKey, attendee: PublicKey) =>
  `${QR_PREFIX}:${event.toBase58()}:${attendee.toBase58()}`;

export function parseTicketQr(text: string): { event: PublicKey; attendee: PublicKey } | null {
  const parts = text.trim().split(":");
  if (parts.length !== 3 || parts[0] !== QR_PREFIX) return null;
  try {
    return { event: new PublicKey(parts[1]), attendee: new PublicKey(parts[2]) };
  } catch {
    return null;
  }
}

// ---------- queries ----------

// Account sizes of the current layout. Filtering by size skips accounts
// created by earlier versions of the program on devnet.
export const EVENT_SIZE = 258;
export const TICKET_SIZE = 350;

export async function fetchEvent(program: PfandProgram, event: PublicKey) {
  const info = await program.provider.connection.getAccountInfo(event, "confirmed");
  if (!info || info.data.length !== EVENT_SIZE || !info.owner.equals(PROGRAM_ID)) return null;
  return program.coder.accounts.decode("event", info.data) as EventAccount;
}

export async function fetchEventTickets(program: PfandProgram, event: PublicKey) {
  return program.account.ticket.all([
    { dataSize: TICKET_SIZE },
    { memcmp: { offset: 8, bytes: event.toBase58() } },
  ]);
}

export async function fetchOrganizerEvents(program: PfandProgram, organizer: PublicKey) {
  const list = await program.account.event.all([
    { dataSize: EVENT_SIZE },
    { memcmp: { offset: 8, bytes: organizer.toBase58() } },
  ]);
  return list.sort((a, b) => b.account.startsAt.toNumber() - a.account.startsAt.toNumber());
}

export async function fetchAttendeeTickets(program: PfandProgram, attendee: PublicKey) {
  return program.account.ticket.all([
    { dataSize: TICKET_SIZE },
    { memcmp: { offset: 40, bytes: attendee.toBase58() } },
  ]);
}

export async function tokenBalance(connection: Connection, owner: PublicKey): Promise<number> {
  try {
    const res = await connection.getTokenAccountBalance(ata(owner), "confirmed");
    return Number(res.value.amount);
  } catch {
    return 0;
  }
}

// ---------- instructions ----------

export type CreateEventInput = {
  title: string;
  depositEur: number;
  capacity: number;
  cancelUntil: Date;
  startsAt: Date;
  endsAt: Date;
  beneficiary: PublicKey;
};

const secs = (d: Date) => new BN(Math.floor(d.getTime() / 1000));

export async function createEvent(
  program: PfandProgram,
  organizer: PublicKey,
  input: CreateEventInput,
  eventId: BN,
  guestKey: Uint8Array,
) {
  const event = eventPda(organizer, eventId);
  const sig = await program.methods
    .createEvent({
      eventId,
      title: input.title,
      deposit: toBaseUnits(input.depositEur),
      capacity: input.capacity,
      cancelUntil: secs(input.cancelUntil),
      startsAt: secs(input.startsAt),
      endsAt: secs(input.endsAt),
      beneficiary: input.beneficiary,
      guestKey: Array.from(guestKey),
    })
    .accountsPartial({
      organizer,
      event,
      mint: TEST_EUR_MINT,
      vault: ata(event),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  return { sig, event };
}

export function register(
  program: PfandProgram,
  event: PublicKey,
  e: EventAccount,
  attendee: PublicKey,
  contact: Uint8Array,
) {
  return program.methods
    .register(Buffer.from(contact))
    .accountsPartial({
      attendee,
      event,
      ticket: ticketPda(event, attendee),
      mint: e.mint,
      attendeeToken: ata(attendee, e.mint),
      vault: ata(event, e.mint),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export function cancelRegistration(program: PfandProgram, event: PublicKey, e: EventAccount, attendee: PublicKey) {
  return program.methods
    .cancelRegistration()
    .accountsPartial({
      attendee,
      event,
      ticket: ticketPda(event, attendee),
      mint: e.mint,
      attendeeToken: ata(attendee, e.mint),
      vault: ata(event, e.mint),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export function checkIn(program: PfandProgram, event: PublicKey, e: EventAccount, attendee: PublicKey) {
  return program.methods
    .checkIn()
    .accountsPartial({
      organizer: e.organizer,
      event,
      ticket: ticketPda(event, attendee),
      mint: e.mint,
      attendeeToken: ata(attendee, e.mint),
      vault: ata(event, e.mint),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export function settle(program: PfandProgram, event: PublicKey, e: EventAccount) {
  return program.methods
    .settle()
    .accountsPartial({
      organizer: e.organizer,
      event,
      beneficiary: e.beneficiary,
      mint: e.mint,
      beneficiaryToken: ata(e.beneficiary, e.mint),
      vault: ata(event, e.mint),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export function faucet(program: PfandProgram, user: PublicKey) {
  return program.methods
    .faucet()
    .accountsPartial({
      user,
      faucetMint: TEST_EUR_MINT,
      userToken: ata(user),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

// ---------- errors ----------

const FRIENDLY: Record<string, string> = {
  EventFull: "This event is full.",
  RegistrationClosed: "Registration closed when the event started.",
  CancellationClosed: "The free cancellation window has passed.",
  AlreadyCheckedIn: "Already checked in. The deposit was refunded.",
  AlreadySettled: "This event has been settled.",
  EventNotEnded: "You can settle once the event has ended.",
  Unauthorized: "Only the organizer's wallet can do this.",
  WrongAttendee: "This ticket belongs to a different wallet.",
  InvalidSchedule: "Check the times: cancel deadline ≤ start < end, all in the future.",
  InvalidTitle: "Title must be 1 to 64 characters.",
  InvalidContact: "Name and email are too long.",
};

export function friendlyError(err: unknown): string {
  const e = err as { error?: { errorCode?: { code?: string }; errorMessage?: string }; message?: string; logs?: string[] };
  const code = e?.error?.errorCode?.code;
  if (code && FRIENDLY[code]) return FRIENDLY[code];
  if (e?.error?.errorMessage) return e.error.errorMessage;
  const msg = e?.message ?? String(err);
  for (const k of Object.keys(FRIENDLY)) if (msg.includes(k)) return FRIENDLY[k];
  if (/already in use/.test(msg) || (e.logs ?? []).some((l) => l.includes("already in use")))
    return "You're already registered for this event.";
  if (/insufficient (funds|lamports)|0x1\b/i.test(msg) || /Attempt to debit an account but found no record of a prior credit/.test(msg))
    return "Not enough balance. Top up test SOL or test euros first.";
  if (/User rejected|rejected the request/i.test(msg)) return "You cancelled the request in your wallet.";
  return msg.length > 160 ? msg.slice(0, 160) + "…" : msg;
}
