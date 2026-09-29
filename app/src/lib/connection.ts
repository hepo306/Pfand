import {
  Connection,
  type Commitment,
  type RpcResponseAndContext,
  type SignatureResult,
  type TransactionConfirmationStrategy,
  type TransactionSignature,
} from "@solana/web3.js";

/**
 * Confirms transactions by polling instead of WebSocket subscriptions.
 * Some networks (campus Wi-Fi, corporate proxies) block WebSockets, which would
 * leave the app waiting forever after a wallet signs.
 */
export class PollingConnection extends Connection {
  async confirmTransaction(
    strategy: TransactionConfirmationStrategy | TransactionSignature,
    commitment?: Commitment,
  ): Promise<RpcResponseAndContext<SignatureResult>> {
    const signature = typeof strategy === "string" ? strategy : strategy.signature;
    const want = commitment ?? this.commitment ?? "confirmed";
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const { context, value } = await this.getSignatureStatuses([signature]);
      const status = value[0];
      if (status) {
        if (status.err) return { context, value: { err: status.err } };
        const done =
          status.confirmationStatus === "finalized" ||
          (status.confirmationStatus === "confirmed" && want !== "finalized") ||
          (want === "processed" && status.confirmationStatus === "processed");
        if (done) return { context, value: { err: null } };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error(`Transaction not confirmed after 90s: ${signature}`);
  }
}
