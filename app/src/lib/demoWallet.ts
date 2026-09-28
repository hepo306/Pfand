import {
  BaseSignerWalletAdapter,
  WalletNotConnectedError,
  WalletReadyState,
  isVersionedTransaction,
  type TransactionOrVersionedTransaction,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { Keypair, type TransactionVersion } from "@solana/web3.js";
import bs58 from "bs58";

export const DemoWalletName = "Demo wallet" as WalletName<"Demo wallet">;
const STORAGE_KEY = "pfand.demo-wallet.v1";

const ICON =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#0b7a55"/><circle cx="16" cy="16" r="6" fill="none" stroke="#fff" stroke-width="2.5"/></svg>`,
  );

function loadOrCreate(): Keypair {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return Keypair.fromSecretKey(bs58.decode(saved));
  } catch {
    /* storage blocked: fall through to an in-memory key */
  }
  const kp = Keypair.generate();
  try {
    localStorage.setItem(STORAGE_KEY, bs58.encode(kp.secretKey));
  } catch {
    /* ignore */
  }
  return kp;
}

/**
 * A throwaway devnet wallet that lives in this browser. Lets anyone try Pfand
 * on a phone without installing a wallet app. Never use it for real funds.
 */
export class DemoWalletAdapter extends BaseSignerWalletAdapter {
  name = DemoWalletName;
  url = "https://github.com/hepo306/pfand";
  icon = ICON;
  readonly supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set(["legacy", 0]);
  private _keypair: Keypair | null = null;

  get connecting() {
    return false;
  }
  get publicKey() {
    return this._keypair?.publicKey ?? null;
  }
  get readyState() {
    return typeof window === "undefined" ? WalletReadyState.Unsupported : WalletReadyState.Loadable;
  }

  async connect(): Promise<void> {
    // Yield once so the provider has subscribed to events (like a real wallet popup would).
    await new Promise((r) => setTimeout(r, 0));
    this._keypair = loadOrCreate();
    this.emit("connect", this._keypair.publicKey);
  }

  async disconnect(): Promise<void> {
    this._keypair = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends TransactionOrVersionedTransaction<this["supportedTransactionVersions"]>>(
    tx: T,
  ): Promise<T> {
    const kp = this._keypair;
    if (!kp) throw new WalletNotConnectedError();
    if (isVersionedTransaction(tx)) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  }
}
