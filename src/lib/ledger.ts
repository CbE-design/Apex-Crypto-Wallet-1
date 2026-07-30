import { ethers } from "ethers";

/**
 * Apex Private Ledger — on-chain anchoring helper.
 *
 * This module mirrors internal Firestore transfers onto a PRIVATE EVM chain
 * (Anvil) so that each transfer has a real, verifiable transaction hash and
 * block number that can be inspected in Blockscout.
 *
 * IMPORTANT (honesty / correctness):
 *  - Firestore remains the source of truth for balances.
 *  - The private chain is NOT Ethereum/Bitcoin mainnet. It is a permissioned
 *    development network (Anvil, chainId 31337 by default). The anchor tx is a
 *    0-value transaction whose calldata records the transfer metadata. It does
 *    NOT move real ether or real crypto assets — it notarises the internal
 *    ledger entry onto the private chain.
 *  - Anchoring is best-effort. If the chain is unreachable, the transfer still
 *    succeeds in Firestore; it is simply recorded as "not anchored".
 */

const RPC_URL = process.env.LEDGER_RPC_URL;
const OPERATOR_KEY = process.env.LEDGER_OPERATOR_PRIVATE_KEY;

export interface AnchorInput {
  senderId: string;
  recipientId: string;
  amount: number;
  currency: string;
  note?: string;
}

export interface AnchorResult {
  txHash: string;
  blockNumber: number;
  chainId: string;
  ledgerAddressFrom: string;
  ledgerAddressTo: string;
}

/** Whether ledger anchoring is configured for this environment. */
export function isLedgerConfigured(): boolean {
  return Boolean(RPC_URL && OPERATOR_KEY);
}

let cachedProvider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return cachedProvider;
}

/**
 * Derive a stable, deterministic pseudo-address for a user so their activity
 * groups together on the private ledger. This is a destination marker derived
 * from the user id — it is not a spendable externally-owned account.
 */
export function deriveLedgerAddress(userId: string): string {
  const digest = ethers.keccak256(ethers.toUtf8Bytes(`apex-private-ledger:${userId}`));
  // Take the last 20 bytes as an EVM address.
  return ethers.getAddress("0x" + digest.slice(-40));
}

/**
 * Anchor a transfer onto the private ledger. Returns null (and logs) if the
 * ledger is not configured or the chain is unreachable — callers must treat
 * anchoring as best-effort.
 */
export async function anchorTransfer(input: AnchorInput): Promise<AnchorResult | null> {
  if (!isLedgerConfigured()) {
    console.log("[v0][ledger] Skipping anchor — LEDGER_RPC_URL / LEDGER_OPERATOR_PRIVATE_KEY not set.");
    return null;
  }

  try {
    const provider = getProvider();
    const operator = new ethers.Wallet(OPERATOR_KEY as string, provider);

    const ledgerAddressFrom = deriveLedgerAddress(input.senderId);
    const ledgerAddressTo = deriveLedgerAddress(input.recipientId);

    // Encode the transfer metadata as calldata so it is permanently recorded
    // on-chain and inspectable in Blockscout.
    const payload = {
      t: "apex.transfer",
      from: input.senderId,
      to: input.recipientId,
      amount: input.amount,
      currency: input.currency,
      note: (input.note || "").slice(0, 120),
      ts: Date.now(),
    };
    const data = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(payload)));

    // 0-value transaction: we are notarising an internal ledger entry, not
    // moving native ether.
    const tx = await operator.sendTransaction({
      to: ledgerAddressTo,
      value: 0n,
      data,
    });
    const receipt = await tx.wait();
    const network = await provider.getNetwork();

    if (!receipt) {
      console.log("[v0][ledger] Anchor tx returned no receipt:", tx.hash);
      return null;
    }

    console.log(
      `[v0][ledger] Anchored transfer ${input.senderId} -> ${input.recipientId} ` +
        `tx=${receipt.hash} block=${receipt.blockNumber}`
    );

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      chainId: network.chainId.toString(),
      ledgerAddressFrom,
      ledgerAddressTo,
    };
  } catch (err) {
    console.log("[v0][ledger] Anchor failed (transfer still succeeds in Firestore):", err);
    return null;
  }
}
