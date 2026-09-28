import { PublicKey, clusterApiUrl } from "@solana/web3.js";
import idl from "../idl/pfand.json";

export const CLUSTER = "devnet" as const;
export const RPC_URL = import.meta.env.VITE_RPC_URL ?? clusterApiUrl(CLUSTER);
export const PROGRAM_ID = new PublicKey(idl.address);

/** Devnet test euro minted by the program's faucet. On mainnet this would be EURC. */
export const TEST_EUR_MINT = PublicKey.findProgramAddressSync(
  [new TextEncoder().encode("test-eur")],
  PROGRAM_ID,
)[0];
export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "pEUR";

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
export const explorerAddress = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=${CLUSTER}`;
