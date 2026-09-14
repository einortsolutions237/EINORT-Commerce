/**
 * Surface C — the platform owner's console (`src/app/admin/**`), ADM-01..ADM-04
 * and the owner half of ADM-05 / SUB-03.
 *
 * Extracted to its own module for the same reason `marketing.ts` was, not for
 * `flagship.ts`'s TS7022 reason: `index.ts` is already ~1,900 lines and this is
 * a self-contained surface with its own distinct voice. Nothing here imports
 * back from `index.ts`, so there is no cycle to break — only a file worth
 * keeping separate. It is authored in ONE pass, before any component exists
 * (06-UI-SPEC.md § Copy modules, 06-RESEARCH.md Pitfall 10): every later plan
 * in Phase 6 reads this file and writes none of it.
 *
 * ---------------------------------------------------------------------------
 * TWO AUDIENCES, NEVER MIXED. A STRING USED ON BOTH SURFACES IS A BUG.
 * ---------------------------------------------------------------------------
 * This file is the OWNER's console, read by exactly one person: the platform
 * operator, looking at somebody else's business. So it says `{store}` or
 * `the merchant` and it never says "your" — the second person belongs to
 * `strings.dashboard.*`, `strings.claims.*` and `strings.support.*`, which are
 * read by merchants. The rule is machine-checked: a `\byour\b` outside a
 * comment in this file fails 06-02's acceptance criteria. If a sentence here
 * would also be right on a merchant screen, that is the signal that the
 * audience boundary has been crossed, not an invitation to share the constant.
 *
 * The one deliberate exception is the reject dialog on `/admin/claims`:
 * 06-UI-SPEC.md § C3 says the owner reuses the MERCHANT's reject copy and
 * canned reasons verbatim, because a merchant and the owner discussing one
 * rejected claim must be reading the same words. That reuse happens at the
 * call site through `strings.claims.rejectDialog*` — the sentences are
 * deliberately absent from `claims` below rather than retyped here.
 *
 * ---------------------------------------------------------------------------
 * VOICE CONTRACT (06-UI-SPEC.md § Copywriting Contract).
 * ---------------------------------------------------------------------------
 * Direct, no exclamation marks, no "Oops"/"Whoops", no emoji, no ALL-CAPS.
 * Errors state what happened AND what to do next, and say when nothing
 * changed. Second person is reserved for merchant-facing surfaces.
 *
 * NEVER WRITE, anywhere in this file:
 *   - an internal name — `platformRole`, `tenantId`, `scopedDb`,
 *     `PAYMENT_CLAIMED`, `SupportMessage`, or any other model or column;
 *   - `Delete` (nothing in this phase hard-deletes — D-08, D-12);
 *   - `Verified` for a payment, or `Payment received` before the owner
 *     confirms it;
 *   - a promise about custom domains, real-time chat or read receipts —
 *     unshipped scope is not a product surface (§ D "Do not write");
 *   - "Are you sure?" as the whole of a confirmation. Every destructive
 *     confirmation names the consequence.
 *
 * Placeholders are `{token}`-style, matching `strings.claims.email`'s existing
 * convention: a token can be moved by a translator, concatenation cannot.
 * `as const` is load-bearing — it makes every key a literal type, so a typo at
 * a call site is a compile error rather than `undefined` rendered on screen.
 */
export const adminCopy = {
  /**
   * R-1 / D-02 — the persistent gold strip at the top of every admin page.
   * Not interactive, not dismissible: it is a state indicator, which is why
   * `full` is a statement rather than a warning with an action.
   *
   * `short` is what remains below `sm`; `detail` is the clause carried by the
   * `hidden sm:inline` span. `full` exists so the strip's accessible name is
   * one sentence rather than two spans a screen reader has to reassemble.
   */
  banner: {
    full: "EINORT Platform Admin — you are acting across every merchant store.",
    short: "EINORT Platform Admin",
    detail: "— you are acting across every merchant store.",
  },

  /**
   * § C0 — the four rail destinations, in render order, plus the rail
   * header's second line.
   *
   * `platformAdmin` is the cheapest distinctness signal in the whole surface
   * (R-1): it costs no colour and it sits above every page. `openNavigation`
   * is the accessible name on the sheet trigger below `lg`, passed in place of
   * the registry `SidebarTrigger`'s hardcoded "Toggle Sidebar".
   *
   * The two count-badge labels are `role="status"` regions, not decoration:
   * the accessibility floor forbids colour (gold for money, blue for unread)
   * being the only signal, so each badge is announced in words.
   */
  nav: {
    merchants: "Merchants",
    claims: "Payment claims",
    subscriptions: "Subscription payments",
    support: "Support",
    platformAdmin: "Platform Admin",
    openNavigation: "Open navigation",
    pendingCountLabel: "{n} awaiting review",
    unreadCountLabel: "{n} unread messages",
  },

  /**
   * § C1 — `/admin`, the merchants and stores list (ADM-01 / ADM-03 / R-2).
   *
   * `columnActions` is the sr-only header over the `⋯` column: a table header
   * cell is never empty, or the row's controls have no name in a screen
   * reader's table mode.
   *
   * There is no search string here and that is deliberate — § C1 rules a
   * search box out at pilot scale, and an unimplemented input is worse than
   * none. Do not add one "for later".
   */
  merchants: {
    /** Renders as "Merchants · EINORT" through the root layout template. */
    title: "Merchants",
    heading: "Merchants",
    subline: "{n} stores",

    columnStore: "Store",
    columnPlan: "Plan",
    columnStatus: "Status",
    columnDomain: "Domain",
    columnProducts: "Products",
    columnOrders: "Orders",
    columnJoined: "Joined",
    columnActions: "Actions",

    filterLabel: "Status",
    filterAll: "All stores",
    filterActive: "Active",
    filterSuspended: "Suspended",

    /** Accessible name on the per-row `⋯` trigger — never a bare "More". */
    rowActionsLabel: "Actions for {store}",
    actionViewStore: "View store",
    actionOpenThread: "Open support thread",
    actionSuspend: "Suspend store",
    actionRestore: "Restore store",

    /**
     * Sort chrome. Shared by the C3 and C4 ledgers as well — sharing inside
     * the owner's console is not the two-audiences violation this file's
     * header warns about, which is about merchant copy leaking here.
     */
    sortLabel: "Sort by {column}",
    sortedAscending: "Sorted by {column}, lowest first",
    sortedDescending: "Sorted by {column}, highest first",

    emptyHeading: "No merchants yet",
    emptyBody: "The first store to finish signup shows up here.",
    /** No heading and no illustration — a filter result is not an empty app. */
    filteredEmptyBody: "No stores match this filter.",
  },

  /**
   * § C2 — `/admin/merchants/[id]`, one store in full (ADM-01 / ADM-03).
   *
   * `statusChangedSuspended` / `statusChangedActive` are the Body line § C2
   * requires beside the status chip: when it last changed, and why. Two
   * strings rather than one with an optional clause, because a restored store
   * has no reason to show and "Reason: —" is not copy.
   */
  merchantDetail: {
    cardStoreStatus: "Store status",
    cardDomain: "Domain",
    cardPlan: "Plan & subscription",
    cardAtAGlance: "At a glance",

    openThread: "Open support thread",

    statusChangedSuspended: "Suspended {when}. Reason: {reason}",
    statusChangedActive: "Active since {when}.",

    /**
     * The Plan & subscription card's Body line (06-08-PLAN.md Task 3) —
     * `src/server/entitlements/resolve.ts`'s `TrialState` has exactly three
     * values, and each reads a different sentence here rather than one
     * sentence with a conditional clause, for the same reason
     * `statusChangedSuspended`/`statusChangedActive` above are two strings:
     * a subscribed store has no trial date left to show.
     */
    trialEndsLine: "Trial ends {when}.",
    trialEndedLine: "Trial ended {when}.",
    subscriptionActiveLine: "Subscription active.",

    /** § C4's `Covers through` column, restated on the plan card. */
    coversThrough: "Covers through",
    subscriptionsLink: "See subscription payments",

    figureProducts: "Products",
    figureOrders: "Orders",
    figurePendingClaims: "Pending payment claims",
  },

  /**
   * § C3 — `/admin/claims`, one flat order-payment-claims ledger across every
   * tenant (ADM-02 / D-18 / D-19 / D-20).
   *
   * THE REJECT DIALOG IS NOT HERE ON PURPOSE. § C3 reuses the merchant-side
   * dialog's copy and its four canned reasons verbatim, so the call site reads
   * `strings.claims.rejectDialogTitle`, `.rejectReasonAmount` and the rest.
   * Retyping them here would create a second copy that drifts the first time
   * one of the two is edited.
   *
   * `mismatchDialogTitle` states the fact and lets the body ask the question —
   * the contract forbids "Are you sure?" standing alone as a confirmation.
   */
  claims: {
    /** Renders as "Payment claims · EINORT" through the root layout template. */
    title: "Payment claims",
    heading: "Payment claims",
    subline: "{n} awaiting review",
    sublineEmpty: "Nothing waiting",

    columnScreenshot: "Screenshot",
    columnMerchant: "Merchant",
    columnOrder: "Order",
    columnAmount: "Amount claimed",
    columnOperator: "Operator",
    columnReference: "Reference",
    columnSubmitted: "Submitted",
    columnStatus: "Status",
    columnActions: "Actions",

    /** Label/`--destructive` line under a claimed amount that disagrees. */
    amountMismatch: "Order total is {total}.",

    copyReference: "Copy reference",
    /** Announced through `role="status"` after the clipboard write. */
    copiedReference: "Copied",

    viewScreenshot: "View screenshot",
    screenshotAlt: "Payment screenshot submitted on order {n}",
    closeScreenshot: "Close",
    noScreenshot: "No screenshot",

    confirmCta: "Confirm",
    rejectCta: "Reject",

    mismatchDialogTitle: "The amounts don't match",
    mismatchDialogBody:
      "The customer claimed {claimed} but the order total is {total}. Confirm anyway?",
    mismatchDialogConfirm: "Confirm payment",
    mismatchDialogCancel: "Go back",

    confirmedToast: "Payment confirmed for order {n}.",
    rejectedToast: "Claim rejected for order {n}.",

    filterStatusLabel: "Status",
    filterAwaiting: "Awaiting review",
    filterConfirmed: "Confirmed",
    filterRejected: "Rejected",
    filterAll: "All",
    filterMerchantLabel: "Merchant",
    filterAllMerchants: "All merchants",

    emptyHeading: "No claims yet",
    emptyBody:
      "Payment claims from every store land here as customers submit them.",
    filteredEmptyBody: "No claims match this filter.",
  },

  /**
   * § C4 — `/admin/subscriptions`, the merchant-pays-EINORT ledger (SUB-03 /
   * D-20). A SEPARATE page from C3, never one table with a type column: the
   * two queues have different actors, different consequences and different
   * reject copy.
   *
   * Confirming is not optimistic — it changes what a merchant is entitled to —
   * so both decisions carry a submitting label. The reject reason is free text
   * with no canned options: the owner is writing to one merchant about one
   * platform-specific failure, not triaging a queue.
   */
  subscriptions: {
    /** Renders as "Subscription payments · EINORT" through the template. */
    title: "Subscription payments",
    heading: "Subscription payments",
    subline: "{n} awaiting review",
    sublineEmpty: "Nothing waiting",

    columnReceipt: "Receipt",
    columnMerchant: "Merchant",
    columnPlan: "Plan",
    columnAmount: "Amount",
    columnOperator: "Operator",
    columnReference: "Reference",
    columnSubmitted: "Submitted",
    columnCoversThrough: "Covers through",
    columnStatus: "Status",
    columnActions: "Actions",

    /** Rendered in the `Covers through` cell until a decision is made. */
    coversThroughPending: "—",

    copyReference: "Copy reference",
    copiedReference: "Copied",

    viewReceipt: "View receipt",
    receiptAlt: "Subscription payment receipt from {store}",
    closeReceipt: "Close",
    noReceipt: "No receipt",

    confirmCta: "Confirm",
    confirmSubmitting: "Confirming…",
    rejectCta: "Reject",
    rejectSubmitting: "Rejecting…",

    confirmDialogTitle: "Confirm this payment?",
    confirmDialogBody:
      "This extends {store}'s subscription through {date}, and posts a confirmation to their support thread.",
    confirmDialogConfirm: "Confirm payment",
    confirmDialogCancel: "Go back",

    rejectDialogTitle: "Why are you rejecting this payment?",
    rejectDialogBody:
      "The merchant sees this in their support thread and can send a corrected payment.",
    rejectReasonLabel: "Reason",
    /** Live counter beside the reason field. `{n}` typed, `{max}` allowed. */
    rejectReasonCounter: "{n}/{max}",
    rejectReasonHelper: "At least 10 characters.",
    rejectDialogConfirm: "Reject payment",
    rejectDialogCancel: "Go back",

    confirmedToast: "Subscription confirmed for {store}.",
    rejectedToast: "Subscription payment rejected for {store}.",

    filterStatusLabel: "Status",
    filterAwaiting: "Awaiting review",
    filterConfirmed: "Confirmed",
    filterRejected: "Rejected",
    filterAll: "All",
    filterMerchantLabel: "Merchant",
    filterAllMerchants: "All merchants",

    emptyHeading: "No subscription payments yet",
    emptyBody:
      "When a merchant sends proof of a subscription payment, it lands here for you to check.",
    filteredEmptyBody: "No subscription payments match this filter.",
  },

  /**
   * § C5 — `/admin/support`, the flat inbox, and § C6's per-thread chrome.
   *
   * `lastMessagePrefix` carries its trailing space on purpose: it is
   * concatenated onto a `line-clamp-1` preview, and a call site that adds the
   * space itself is a call site that will eventually forget to.
   *
   * The C6 thread strings live here rather than in `support.ts` because they
   * are the OWNER's chrome around a shared component — `support.ts` is the
   * merchant's file plus the message-rendering contract both surfaces share.
   */
  inbox: {
    /** Renders as "Inbox · EINORT" through the root layout template. */
    title: "Inbox",
    heading: "Inbox",
    subline: "{n} unread",
    sublineEmpty: "All caught up",

    lastMessagePrefix: "You: ",
    noMessagesPreview: "No messages yet.",
    unreadCountLabel: "{n} unread messages",

    emptyHeading: "No merchants yet",
    emptyBody: "Once a store signs up, its thread appears here.",

    backToInbox: "← Inbox",
    viewMerchant: "View merchant",
    threadEmptyHeading: "No messages yet",
    threadEmptyBody: "Nothing from {store} yet. You can write first.",
  },

  /**
   * D-14 — suspending a store. The safety gate is the REQUIRED reason, not
   * the number of clicks (R-2), and the reason is not an audit note: D-15
   * posts it into the merchant's support thread, so the body says so and
   * tells the owner to write it for that reader.
   *
   * The bounds are 10–280 characters. `reasonCounter` is the live counter;
   * the confirm button stays disabled below 10.
   */
  suspend: {
    title: "Suspend {store}?",
    body: "Their storefront stops serving straight away and they can't reach their dashboard. The reason below is posted to their support thread, so write it for them to read.",
    reasonLabel: "Reason",
    reasonHelper: "At least 10 characters. The merchant reads this.",
    reasonCounter: "{n}/{max}",
    confirm: "Suspend store",
    confirming: "Suspending…",
    cancel: "Go back",
    toast: "{store} is suspended.",
    /** Blocking `alert` inside the dialog — never a toast for a failed write. */
    error: "Couldn't suspend this store. Nothing changed — try again.",
  },

  /**
   * D-17 — the symmetric other half. Restoring is a SAFE action, so the note
   * is optional and the confirm button is not destructive-styled: colouring a
   * recovery red teaches the wrong reflex about the colour.
   */
  restore: {
    title: "Restore {store}?",
    body: "Their storefront and dashboard come back straight away. This is posted to their support thread too.",
    noteLabel: "Note",
    noteHelper: "Optional. The merchant reads this.",
    noteCounter: "{n}/{max}",
    confirm: "Restore store",
    confirming: "Restoring…",
    cancel: "Go back",
    toast: "{store} is active again.",
    error: "Couldn't restore this store. Nothing changed — try again.",
  },

  /**
   * § D — the domain cell, rendered as a column on C1 and a card on C2. There
   * is no `/admin/domains` page and there is no custom-domain copy: § D says
   * in as many words that unshipped scope is not a product surface, so do not
   * add a "coming soon" line or a disabled "Add domain" label here.
   *
   * Two chip states only. A third would imply DNS state this phase cannot
   * observe.
   */
  domain: {
    label: "Domain",
    statusLive: "Live",
    statusOffline: "Offline",
    copyLabel: "Copy domain",
    /** Announced through `role="status"` after the clipboard write. */
    copiedLabel: "Copied",
    openLabel: "Open this storefront in a new tab",
  },

  /**
   * § Status Chip Registry — rendered inline on C1 and C2. Deliberately not
   * the raw status value: an owner-facing chip reads as a word, never as a
   * database enum.
   */
  storeStatus: {
    active: "Active",
    suspended: "Suspended",
  },

  /**
   * The two failures that are not specific to one dialog. Both state that
   * nothing changed, because the owner's next question after a failed
   * decision is always whether it half-happened.
   */
  errors: {
    generic: "Something went wrong. Try again in a moment.",
    confirmSubscription:
      "Couldn't confirm this payment. Nothing changed — try again.",
  },
} as const;
