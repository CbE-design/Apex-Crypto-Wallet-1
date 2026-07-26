---
name: Account restriction enforcement
description: How to implement admin account restrictions so restricted users are cleanly locked out of the app.
---

A user profile can carry `isRestricted`, `restrictedReason`, `restrictedAt`, and `restrictedBy` flags. Setting the flag is not enough; the app must actively enforce it.

**Rule:**
- In the wallet context, watch `userProfile.isRestricted`. When it becomes `true`, show a destructive toast and call `disconnectWallet()` to clear the session and redirect to login.
- In the admin users page, provide a clear restrict/unrestrict button with a required reason and update the profile atomically.
- Firestore rules must allow admins (not just owners) to update user profile docs, otherwise client-side restriction writes will be denied.

**Why:** Relying only on route guards or server rules lets a restricted user continue using an already-loaded client. An active sign-out effect is the cleanest way to revoke access.
