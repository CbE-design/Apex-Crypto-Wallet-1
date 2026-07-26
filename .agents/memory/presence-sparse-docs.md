---
name: Presence writes with sparse docs
description: Avoiding `not-found` errors when updating online/offline status for users whose profile doc may not exist yet.
---

Heartbeat presence updates write `lastSeen` and `isOnline` to the user's profile document. During onboarding or after a fresh import, that document may not exist yet, causing `updateDoc` to fail with `not-found`.

**Rule:**
- Use `setDoc(doc(firestore, 'users', user.uid), { lastSeen, isOnline }, { merge: true })` for heartbeat updates.
- The client-side rules should allow the owner to update only the whitelisted presence fields.

**Why:** `updateDoc` requires the document to exist. `setDoc` with `merge: true` creates it if needed and avoids race conditions between the first profile write and the heartbeat effect.
