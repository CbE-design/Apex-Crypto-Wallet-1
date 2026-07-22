---
title: "fix(api): resolve firebase import path for alchemy webhook route"
---

This PR fixes a Vercel build error by correcting the Firebase Admin import in `src/app/api/webhooks/alchemy/route.ts`.

What I changed:
- Replaced the client-side `@/lib/firebase` import with the server-side admin helpers from `@/lib/firebase-admin`.
- Adjusted the webhook handler to use `getAdminFirestore()` and `firebaseAdmin` for batch writes and FieldValue operations.
- Kept existing signature verification and deposit processing logic.

Please review and merge when ready.
