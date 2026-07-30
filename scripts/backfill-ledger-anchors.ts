/**
 * Backfill: anchor pre-existing Firestore transfers onto the Apex Private Ledger.
 *
 * Context
 * -------
 * Transfers created before Blockscout/Anvil was wired up have no on-chain
 * anchor. This one-off script walks the `transactions` collection, pairs each
 * TRANSFER_SENT with its matching TRANSFER_RECEIVED, and notarises the pair on
 * the private chain via the SAME `anchorTransfer` helper used at runtime — so
 * the backfilled records are identical in shape to freshly anchored ones.
 *
 * Honesty / correctness
 * ---------------------
 *  - Firestore remains the source of truth. This only adds a verifiable record
 *    on the PRIVATE chain; it does not move real crypto or alter balances.
 *  - Idempotent: records already marked `ledgerStatus: "ANCHORED"` are skipped,
 *    so it is safe to re-run.
 *  - Pairs are matched on (createdAt, amount, currency) because both records
 *    are written inside the same Firestore transaction and share those values.
 *
 * Usage
 * -----
 *   set -a && source /vercel/share/.env.project && set +a && \
 *     npx tsx scripts/backfill-ledger-anchors.ts [--dry-run] [--limit=N]
 *
 * Requires: FIREBASE_ADMIN_SDK_CONFIG, LEDGER_RPC_URL, LEDGER_OPERATOR_PRIVATE_KEY.
 */
import { getDb } from "../src/lib/db";
import { anchorTransfer, isLedgerConfigured } from "../src/lib/ledger";

interface TxRecord {
  id: string;
  userId?: string;
  type?: string;
  amount?: number;
  currency?: string;
  description?: string;
  createdAt?: string;
  ledgerStatus?: string;
  onChainTxHash?: string;
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : Infinity;

function pairKey(t: TxRecord): string {
  return `${t.createdAt ?? ""}|${t.amount ?? ""}|${t.currency ?? ""}`;
}

async function main() {
  if (!isLedgerConfigured()) {
    console.log(
      "[v0][backfill] Ledger not configured. Set LEDGER_RPC_URL and " +
        "LEDGER_OPERATOR_PRIVATE_KEY before running. Aborting."
    );
    process.exit(1);
  }

  const db = getDb();
  const snap = await db.collection("transactions").get();
  const all: TxRecord[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TxRecord, "id">) }));

  const sent = all.filter((t) => t.type === "TRANSFER_SENT");
  const received = all.filter((t) => t.type === "TRANSFER_RECEIVED");

  console.log(
    `[v0][backfill] Loaded ${all.length} transactions ` +
      `(${sent.length} sent, ${received.length} received). ` +
      `Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}.`
  );

  // Index received records by pair key so each SENT can find its counterpart.
  const receivedByKey = new Map<string, TxRecord[]>();
  for (const r of received) {
    const key = pairKey(r);
    const list = receivedByKey.get(key) ?? [];
    list.push(r);
    receivedByKey.set(key, list);
  }

  let anchored = 0;
  let skipped = 0;
  let unpaired = 0;
  let failed = 0;

  for (const s of sent) {
    if (anchored >= LIMIT) break;

    if (s.ledgerStatus === "ANCHORED" && s.onChainTxHash) {
      skipped++;
      continue;
    }

    // Find (and consume) the matching received record.
    const key = pairKey(s);
    const candidates = receivedByKey.get(key) ?? [];
    const match = candidates.find((r) => r.userId && r.userId !== s.userId);

    if (!s.userId || !match?.userId) {
      unpaired++;
      console.log(
        `[v0][backfill] No counterpart for SENT ${s.id} ` +
          `(key=${key}). Marking NOT_ANCHORED.`
      );
      if (!DRY_RUN) {
        await db.collection("transactions").doc(s.id).update({ ledgerStatus: "NOT_ANCHORED" });
      }
      continue;
    }

    // Consume this match so a duplicate pair can't reuse it.
    receivedByKey.set(
      key,
      candidates.filter((r) => r.id !== match.id)
    );

    if (DRY_RUN) {
      console.log(
        `[v0][backfill] [dry-run] Would anchor ${s.userId} -> ${match.userId} ` +
          `amount=${s.amount} ${s.currency} (sent=${s.id}, recv=${match.id}).`
      );
      anchored++;
      continue;
    }

    const anchor = await anchorTransfer({
      senderId: s.userId,
      recipientId: match.userId,
      amount: Number(s.amount ?? 0),
      currency: String(s.currency ?? ""),
      note: s.description,
    });

    if (!anchor) {
      failed++;
      console.log(`[v0][backfill] Anchor failed for pair (sent=${s.id}, recv=${match.id}).`);
      continue;
    }

    const ledgerUpdate = {
      ledgerStatus: "ANCHORED",
      onChainTxHash: anchor.txHash,
      onChainBlockNumber: anchor.blockNumber,
      onChainId: anchor.chainId,
      ledgerAddressFrom: anchor.ledgerAddressFrom,
      ledgerAddressTo: anchor.ledgerAddressTo,
      ledgerBackfilledAt: new Date().toISOString(),
    };

    await Promise.all([
      db.collection("transactions").doc(s.id).update(ledgerUpdate),
      db.collection("transactions").doc(match.id).update(ledgerUpdate),
    ]);

    anchored++;
    console.log(
      `[v0][backfill] Anchored pair (sent=${s.id}, recv=${match.id}) ` +
        `tx=${anchor.txHash} block=${anchor.blockNumber}.`
    );
  }

  console.log(
    `[v0][backfill] Done. anchored=${anchored} skipped=${skipped} ` +
      `unpaired=${unpaired} failed=${failed}.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.log("[v0][backfill] Fatal error:", err);
  process.exit(1);
});
