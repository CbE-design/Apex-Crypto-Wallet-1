---
name: Withdrawal balance lifecycle
description: Correct balance state transitions for crypto withdrawals from request through approval or rejection.
---

Withdrawals must not double-spend or leave crypto in limbo after a rejection.

**Rule:**
- On request, atomically move the crypto amount from `balance` to `reservedForWithdrawal` in the user's wallet doc.
- On rejection, atomically return the reserved amount to `balance` and reduce `reservedForWithdrawal`.
- On approval, reduce `reservedForWithdrawal` (the crypto is already reserved, so only the reserved field changes).
- Use Firestore `runTransaction` for all three operations so the wallet doc is read and updated atomically.

**Why:** Showing a raw balance that ignores reserved funds misleads users. Keeping the two fields separate lets the UI show both "available" and "pending" balances without querying the withdrawal collection.
