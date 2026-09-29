import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Devnet-only convenience: new wallets start with 0 SOL and can't pay network
 * fees, and the public devnet faucet is often rate-limited. A small "demo
 * sponsor" wallet (test SOL, no real value) tops new wallets up with a few cents
 * worth of devnet SOL. The key is injected at build time (VITE_DEMO_SPONSOR) and
 * is never used on mainnet, where the roadmap replaces this with a fee payer.
 */
const SPONSOR_SECRET = import.meta.env.VITE_DEMO_SPONSOR as string | undefined;
const TOP_UP_SOL = 0.02;
export const LOW_SOL = 0.006;

let sponsor: Keypair | null = null;
try {
  if (SPONSOR_SECRET) sponsor = Keypair.fromSecretKey(bs58.decode(SPONSOR_SECRET));
} catch {
  sponsor = null;
}

const flagKey = (pk: PublicKey) => `pfand.topped.${pk.toBase58()}`;
function alreadyTopped(pk: PublicKey) {
  try {
    return localStorage.getItem(flagKey(pk)) === "1";
  } catch {
    return false;
  }
}
function markTopped(pk: PublicKey) {
  try {
    localStorage.setItem(flagKey(pk), "1");
  } catch {
    /* ignore */
  }
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Returns the signature of the funding transaction, or throws if nothing worked. */
export async function getTestSol(connection: Connection, to: PublicKey, opts: { force?: boolean } = {}) {
  // 1. Our sponsor: fast and reliable.
  if (sponsor && (opts.force || !alreadyTopped(to))) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sponsor.publicKey,
        toPubkey: to,
        lamports: Math.round(TOP_UP_SOL * LAMPORTS_PER_SOL),
      }),
    );
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = sponsor.publicKey;
    tx.sign(sponsor);
    try {
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      markTopped(to);
      return sig;
    } catch {
      /* sponsor empty or RPC hiccup: fall through to the public faucet */
    }
  }
  // 2. Public devnet faucet (often rate-limited).
  const sig = await withTimeout(connection.requestAirdrop(to, 0.5 * LAMPORTS_PER_SOL), 10_000);
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

export const hasSponsor = () => !!sponsor;
