import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, type Connection } from "@solana/web3.js";
import { PollingConnection } from "../lib/connection";
import { usePoll } from "../lib/useEventData";
import { getProgram, tokenBalance, type PfandProgram } from "../lib/pfand";
import { LOW_SOL, getTestSol, hasSponsor } from "../lib/sponsor";

type AccountCtx = {
  connection: Connection;
  program: PfandProgram;
  sol: number | null;
  eur: number | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AccountCtx | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { connection: base } = useConnection();
  const connection = useMemo(() => new PollingConnection(base.rpcEndpoint, "confirmed"), [base]);
  const anchorWallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const program = useMemo(() => getProgram(connection, anchorWallet), [connection, anchorWallet]);
  const [sol, setSol] = useState<number | null>(null);
  const [eur, setEur] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setSol(null);
      setEur(null);
      return;
    }
    const [lamports, tokens] = await Promise.all([
      connection.getBalance(publicKey, "confirmed").catch(() => 0),
      tokenBalance(connection, publicKey),
    ]);
    setSol(lamports / LAMPORTS_PER_SOL);
    setEur(tokens);
  }, [connection, publicKey]);

  usePoll(refresh, 15000);

  // New wallets have no SOL for fees: top them up once, automatically.
  const [autoTried, setAutoTried] = useState<string | null>(null);
  useEffect(() => {
    if (!publicKey || sol === null || sol >= LOW_SOL || !hasSponsor()) return;
    const k = publicKey.toBase58();
    if (autoTried === k) return;
    setAutoTried(k);
    getTestSol(connection, publicKey)
      .then(() => refresh())
      .catch(() => {});
  }, [publicKey, sol, autoTried, connection, refresh]);

  return <Ctx.Provider value={{ connection, program, sol, eur, refresh }}>{children}</Ctx.Provider>;
}

export function useAccount() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AccountProvider missing");
  return c;
}
