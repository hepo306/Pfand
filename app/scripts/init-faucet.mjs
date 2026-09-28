// One-time setup after deploying: creates the devnet test-euro mint (pEUR).
// Usage: RPC_URL=https://api.devnet.solana.com node scripts/init-faucet.mjs [path/to/keypair.json]
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import anchor from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const idl = JSON.parse(readFileSync(new URL("../src/idl/pfand.json", import.meta.url)));
const rpc = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const keyPath = process.argv[2] ?? `${homedir()}/.config/solana/id.json`;
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8"))));

const connection = new Connection(rpc, "confirmed");
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), { commitment: "confirmed" });
const program = new anchor.Program(idl, provider);
const [mint] = PublicKey.findProgramAddressSync([Buffer.from("test-eur")], program.programId);

if (await connection.getAccountInfo(mint)) {
  console.log("Faucet mint already exists:", mint.toBase58());
} else {
  const sig = await program.methods
    .initFaucet()
    .accountsPartial({
      payer: payer.publicKey,
      faucetMint: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("Created faucet mint", mint.toBase58(), "tx", sig);
}
