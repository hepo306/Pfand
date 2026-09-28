import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Coins, Copy, Drop, SignOut, Wallet, X } from "@phosphor-icons/react";
import { Button } from "./ui";
import { useAccount } from "./account";
import { useToast } from "./toast";
import { faucet, formatEur, friendlyError, shortKey } from "../lib/pfand";
import { DemoWalletName } from "../lib/demoWallet";

// Lets any page open the wallet picker ("Connect to register").
const openListeners = new Set<() => void>();
export const openConnectModal = () => openListeners.forEach((l) => l());

export function WalletMenu() {
  const { wallets, select, publicKey, disconnect, wallet, connecting } = useWallet();
  const { connection } = useConnection();
  const { program, sol, eur, refresh } = useAccount();
  const toast = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<"sol" | "eur" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const l = () => setPickerOpen(true);
    openListeners.add(l);
    return () => {
      openListeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const choose = (name: WalletName) => {
    setPickerOpen(false);
    // WalletProvider has autoConnect on, so selecting a wallet connects it.
    select(name);
  };

  const getSol = async () => {
    if (!publicKey) return;
    setBusy("sol");
    try {
      const sig = await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      toast.push({ kind: "success", title: "1 test SOL added", body: "Enough for hundreds of transactions.", sig });
      refresh();
    } catch {
      toast.push({
        kind: "error",
        title: "The public faucet is busy",
        body: "Copy your address and paste it on faucet.solana.com (devnet). It takes a few seconds.",
      });
      window.open("https://faucet.solana.com", "_blank", "noopener");
    } finally {
      setBusy(null);
    }
  };

  const getEur = async () => {
    if (!publicKey) return;
    setBusy("eur");
    try {
      const sig = await faucet(program, publicKey);
      toast.push({ kind: "success", title: "€20.00 test euros added", body: "Use them to try deposits.", sig });
      refresh();
    } catch (e) {
      toast.push({ kind: "error", title: "Could not mint test euros", body: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  };

  const installed = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed && w.adapter.name !== DemoWalletName,
  );
  const demo = wallets.find((w) => w.adapter.name === DemoWalletName);

  return (
    <>
      {publicKey ? (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-4 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            {wallet && <img src={wallet.adapter.icon} alt="" className="h-7 w-7 rounded-full" />}
            <span className="tabular">{eur === null ? "…" : formatEur(eur)}</span>
            <span className="hidden text-ink-3 sm:inline">{shortKey(publicKey)}</span>
          </button>
          {menuOpen && (
            <div className="pop absolute right-0 top-12 z-40 w-72 rounded-2xl border border-line bg-surface p-2 shadow-[0_16px_48px_-16px_rgb(20_40_30/0.4)]">
              <div className="px-3 py-2">
                <p className="text-xs text-ink-3">{wallet?.adapter.name} on devnet</p>
                <p className="mt-0.5 break-all font-mono text-xs text-ink-2">{publicKey.toBase58()}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-1">
                <div>
                  <p className="text-xs text-ink-3">Test euros</p>
                  <p className="tabular font-medium">{eur === null ? "…" : formatEur(eur)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-3">SOL for fees</p>
                  <p className="tabular font-medium">{sol === null ? "…" : sol.toFixed(3)}</p>
                </div>
              </div>
              <MenuItem icon={<Drop size={18} />} onClick={getSol} busy={busy === "sol"}>
                Get 1 test SOL
              </MenuItem>
              <MenuItem icon={<Coins size={18} />} onClick={getEur} busy={busy === "eur"}>
                Get €20 test euros
              </MenuItem>
              <MenuItem
                icon={<Copy size={18} />}
                onClick={() => {
                  navigator.clipboard.writeText(publicKey.toBase58());
                  toast.push({ kind: "success", title: "Address copied" });
                }}
              >
                Copy address
              </MenuItem>
              <MenuItem
                icon={<SignOut size={18} />}
                onClick={() => {
                  setMenuOpen(false);
                  disconnect();
                }}
              >
                Disconnect
              </MenuItem>
            </div>
          )}
        </div>
      ) : (
        <Button size="sm" onClick={() => setPickerOpen(true)} loading={connecting}>
          <Wallet size={16} weight="bold" />
          Connect
        </Button>
      )}

      {pickerOpen &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0e1110]/50 p-4 sm:items-center"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="pop w-full max-w-md rounded-2xl border border-line bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Connect a wallet"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Connect a wallet</h2>
              <button onClick={() => setPickerOpen(false)} className="text-ink-3 hover:text-ink" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-2">This prototype runs on Solana devnet. Nothing here costs real money.</p>

            <div className="mt-5 flex flex-col gap-2">
              {demo && (
                <WalletRow
                  icon={demo.adapter.icon}
                  name="Demo wallet"
                  sub="Instant, lives in this browser. Best for trying it on your phone."
                  onClick={() => choose(demo.adapter.name)}
                />
              )}
              {installed.map((w) => (
                <WalletRow
                  key={w.adapter.name}
                  icon={w.adapter.icon}
                  name={w.adapter.name}
                  sub="Switch the wallet to devnet in its settings."
                  onClick={() => choose(w.adapter.name)}
                />
              ))}
              {installed.length === 0 && (
                <p className="px-1 pt-2 text-xs text-ink-3">
                  Phantom, Solflare or Backpack show up here once installed.
                </p>
              )}
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

function WalletRow({ icon, name, sub, onClick }: { icon: string; name: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:border-accent hover:bg-surface-2"
    >
      <img src={icon} alt="" className="h-9 w-9 rounded-lg" />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{name}</span>
        <span className="block text-xs text-ink-3">{sub}</span>
      </span>
    </button>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  busy,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
    >
      <span className={busy ? "animate-pulse text-accent" : "text-ink-3"}>{icon}</span>
      {busy ? "Working…" : children}
    </button>
  );
}
