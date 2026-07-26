---
name: Component dependency resilience
description: Surviving a missing UI primitive package when package installs are blocked in the environment.
---

If a Shadcn/Radix dependency (e.g. `@radix-ui/react-avatar`) is missing from `node_modules` and installs are blocked, the route that imports it will fail to compile with a module-not-found error.

**Rule:**
- Replace the primitive with a lightweight native implementation using the same DOM structure and class names.
- Preserve the exported names (`Avatar`, `AvatarImage`, `AvatarFallback`) so consumers do not need to change.
- Re-install the original dependency once installs are unblocked if you still want the full accessibility behavior.

**Why:** A single missing UI package should not take down unrelated routes. The native fallback keeps the app functional while the environment issue is resolved.
