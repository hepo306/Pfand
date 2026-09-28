import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getProgram, tokenBalance, type PfandProgram } from "../lib/pfand";

type AccountCtx = {
  program: PfandProgram;
  sol: number | null;
  eur: number | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AccountCtx | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
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

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  return <Ctx.Provider value={{ program, sol, eur, refresh }}>{children}</Ctx.Provider>;
}

export function useAccount() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AccountProvider missing");
  return c;
}
