# Deferred Items

## From plan 06-11

### `variant="gold"` grep count is 10, not the expected 5

**Found during:** Task 3 final verification (`grep -ro 'variant="gold"' src/app src/components | wc -l`).

**Detail:** The plan's acceptance criteria (Task 3 and the plan-level `<verification>` block)
assert this command returns exactly 5. As of this plan's starting commit (`6d41ae9`, before
any 06-11 work), it already returns 10. The gap is comment-text mentions of the literal string
`variant="gold"` inside doc comments that discuss the "5 real usages" convention
(`src/app/(dashboard)/dashboard/orders/loading.tsx`, `src/app/(dashboard)/dashboard/recent-orders.tsx`,
`src/components/admin/admin-banner.tsx`, `src/components/admin/admin-sidebar.tsx`,
`src/components/app-sidebar.tsx`, `src/components/order-state-chip.tsx`) — a plain `grep -o`
counts those prose mentions alongside the real JSX usages, and the actual JSX usage count (5)
has not changed.

**Verified out of scope:** `git diff --stat 6d41ae9 HEAD -- <those six files>` is empty —
none of them were touched by any 06-11 commit, and none of 06-11's own new/modified files
(`src/components/support/**`, `src/server/images/thread-upload.ts`,
`src/app/api/upload/thread-finalize/route.ts`) contain the string `gold` anywhere. This is a
pre-existing condition in the repository, not a regression introduced by this plan.

**Action:** Not fixed here — out of scope per the executor's scope-boundary rule (only fix
issues directly caused by the current task's changes). Left for a future plan or a dedicated
cleanup pass to either tighten the grep pattern (e.g. exclude comment lines) or reduce the
prose mentions.

**No actual regression:** `tests/unit/dashboard-nav.test.ts`'s own contract test — "spends the
gold accent exactly five times, in the five files the budget names" — is the REAL, precise
enforcement of this invariant (it scans `.tsx` source specifically, not comment prose), and it
passes cleanly as part of the 685-test `npm run test:unit` run. The plan's illustrative
`grep -ro` command is a simplified approximation that double-counts comment mentions; the
underlying budget itself is intact.
