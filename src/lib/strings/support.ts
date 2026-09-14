/**
 * The merchant↔platform support thread (ADM-05 / SUB-03 / D-07 / D-09..D-15).
 *
 * Extracted for the same reason `marketing.ts` was — `index.ts` is already
 * ~1,900 lines and this is a self-contained surface — not for `flagship.ts`'s
 * TS7022 reason. Nothing here imports back from `index.ts`, so there is no
 * cycle. Authored in one pass before any component exists (06-UI-SPEC.md
 * § Copy modules, Pitfall 10); every later plan in Phase 6 reads it.
 *
 * ---------------------------------------------------------------------------
 * THIS IS THE MERCHANT'S FILE — WITH ONE SHARED EXCEPTION.
 * ---------------------------------------------------------------------------
 * `page`, `composer` and `email.toMerchant` are second person: the merchant is
 * reading them. The owner's console copy lives in `./admin.ts` and the two are
 * never interchanged (see that file's header for the two-audiences rule).
 *
 * The exception is `thread`, `attachments` and `system`. 06-UI-SPEC.md § S
 * builds ONE message component mirrored by a single `viewer` prop and forbids
 * forking it per surface, so those three namespaces render on both
 * `/dashboard/support` and `/admin/support/[tenantId]`. They are deliberately
 * audience-neutral chrome (`You`, `EINORT`, `Today`, `New`) — except the five
 * `system` templates, which § S prescribes verbatim in the merchant's voice
 * because a system message is one record in one shared transcript, and the
 * owner reading "Your store was suspended by EINORT" is reading what the
 * merchant was told, which is exactly the point.
 *
 * ---------------------------------------------------------------------------
 * THE EMAIL NUDGE QUOTES NOTHING FROM THE THREAD. THAT IS A DECISION.
 * ---------------------------------------------------------------------------
 * `email` below says only that a message arrived and where to read it. It
 * never interpolates a message body and it never interpolates the transaction
 * identifier a subscription claim carries — the same rule, for the same
 * reason, as `src/server/claims/notify.ts`'s "NO REFERENCE AND NO OPERATOR IN
 * THE BODY" paragraph: mail is an unencrypted channel landing in whatever
 * inbox the recipient happens to be signed into, and the claim's identifying
 * value is the one field a reviewer must read off THEIR OWN operator receipt
 * rather than off a message this platform relayed to them. Adding it here
 * would both leak a payment detail into mail and invite a "check" that
 * compares the platform's copy of a number against the platform's copy of the
 * same number. 06-02's acceptance criteria grep for it.
 *
 * `email` mirrors `strings.claims.email`'s shape exactly — `subject`,
 * `heading`, `body`, `{token}` placeholders — and, like it, carries no link:
 * `notify.ts` renders `<p>${heading}</p><p>${body}</p>` plus a text part, and
 * a notification that survives every mail client is worth more than one that
 * looks designed in two of them.
 *
 * Voice contract (06-UI-SPEC.md § Copywriting Contract): direct, no
 * exclamation marks, no emoji, no ALL-CAPS. Never name an internal identifier,
 * never promise real-time chat or read receipts — D-12 and § S rule both out,
 * and `readByMerchantAt`/`readByPlatformAt` exist to count unread messages,
 * never to render "seen".
 */
export const supportCopy = {
  /**
   * § A2 — `/dashboard/support`, the merchant's side of the thread.
   *
   * `subscriptionPrompt` carries its trailing space on purpose: it is
   * concatenated with the inline link that follows it, and a call site that
   * adds the space itself is one that will eventually forget to. R-3 is
   * explicit that this is a LINK to `/dashboard/plan`, never a form — a
   * payment form inside a chat transcript competes with the conversation and
   * gives the merchant no plan or price context.
   */
  page: {
    /** Renders as "Support · EINORT" through the root layout template. */
    title: "Support",
    heading: "Support",
    subline: "Ask the EINORT team anything. Replies land here.",

    emptyHeading: "No messages yet",
    emptyBody:
      "Write to the EINORT team here — questions, problems, or proof of your subscription payment. Replies land in this thread.",

    /** SUB-03 entry line. Rendered only while the subscription is unpaid. */
    subscriptionPrompt: "Paying your subscription? ",
    subscriptionLink: "Submit your payment",
  },

  /**
   * § A2's composer, reused on § C6 minus the SUB-03 line.
   *
   * `label` is a VISIBLE `<label>`, not a placeholder — the accessibility
   * floor calls placeholder-as-label a contract violation, so there is
   * deliberately no placeholder string here to reach for.
   *
   * Two keyboard hints rather than one, following `strings.dashboard.topbar`'s
   * precedent: the Windows/Linux glyph server-renders by default because that
   * is this market's hardware, and the Mac glyph swaps in post-mount. The hint
   * states BOTH halves of the rule, because plain Enter inserting a newline is
   * the surprising half and this market is mobile-first — an accidental send
   * is worse than an extra tap.
   */
  composer: {
    label: "Message",
    send: "Send",
    sending: "Sending…",
    attachLabel: "Attach an image",
    keyboardHintWindows: "Ctrl + Enter sends. Enter adds a new line.",
    keyboardHintMac: "⌘ + Enter sends. Enter adds a new line.",

    /**
     * A blocking `alert` above the composer, never a toast alone: § A2 keeps
     * the typed body and the staged images in place, so the merchant's next
     * action is to press Send again, not to retype.
     */
    sendError:
      "Your message didn't send. Check your connection and try again.",

    /** Label/muted note once the 4-image cap is reached. */
    attachmentCapNote: "4 images is the maximum for one message.",
  },

  /**
   * § S — the shared display chrome. Audience-neutral by design: one
   * component, two surfaces, mirrored by a single `viewer` prop.
   *
   * `authorOther` is `EINORT` on the merchant's side; the owner's side
   * substitutes the store name, which is data, not copy.
   */
  thread: {
    authorSelf: "You",
    authorOther: "EINORT",

    separatorToday: "Today",
    separatorYesterday: "Yesterday",
    /** The once-per-load unread divider. Not sticky, not recomputed. */
    newDivider: "New",

    /** Label line above each bubble. Absolute time goes in a `title`. */
    meta: "{author} · {time}",

    /** Accessible name on the `aria-live="polite"` `role="log"` container. */
    logLabel: "Support conversation",
    /** Accessible name on an optimistic bubble's spinner, in place of a time. */
    messagePending: "Sending",
  },

  /**
   * § S — attachments. JPG/PNG/WebP only (Assumption A2): every accepted
   * format is a decoder the image pipeline must be trusted with, and a PDF
   * cannot be re-encoded at all. Do not write "PDF" anywhere in this
   * namespace — the format is not supported and naming it promises it.
   *
   * `attachmentAlt` is never empty and never a filename: an empty alt hides
   * the attachment from a screen reader entirely, and a filename is the one
   * string here that could carry a merchant's own words into a context that
   * does not escape them. `{max}` in `sizeError` interpolates the real upload
   * constant — never hardcode a number into this sentence.
   */
  attachments: {
    attachmentAlt: "Image attached by {author} at {time}",
    typeHelper: "JPG, PNG or WebP.",
    typeError: "Only JPG, PNG and WebP images can be attached.",
    sizeError: "That image is larger than {max}. Try a smaller one.",

    uploading: "Uploading…",
    /** Inline beside the staged thumb. The typed message body survives. */
    uploadError: "That image didn't upload. Try again.",

    removeLabel: "Remove this image",
    openLabel: "Open this image",
    closeLightbox: "Close",
  },

  /**
   * § S / D-15 — the five `SYSTEM` messages, verbatim from 06-UI-SPEC.md.
   *
   * Always third person about the event and never conversational: a system
   * row is a record, not a turn in the conversation. It renders full-width and
   * centered with no bubble on BOTH surfaces, so the owner reads the same
   * sentence the merchant was shown.
   *
   * `{reason}` is the owner's own words, typed into the suspend or reject
   * dialog. `{plan}` is a tier NAME, never an internal tier key.
   */
  system: {
    suspended: "Your store was suspended by EINORT. Reason: {reason}",
    restored: "Your store was restored by EINORT.",
    subscriptionSubmitted:
      "Subscription payment submitted for review — {plan}, {amount}.",
    subscriptionConfirmed:
      "Subscription payment confirmed. Your plan is active through {date}.",
    subscriptionRejected: "Subscription payment rejected. Reason: {reason}",
  },

  /**
   * D-09 — the two nudges, one per direction. Both say a message arrived and
   * where to read it, and nothing else. See this file's header for why they
   * quote no content: it is the same rule `src/server/claims/notify.ts`
   * documents, and it is not a stylistic choice.
   *
   * The in-app badge is the reliable channel on both surfaces; these sends are
   * best effort and are allowed to fail, exactly as the claim nudge is.
   */
  email: {
    toMerchant: {
      subject: "A new message from EINORT support",
      heading: "The EINORT team wrote to you",
      body: "There is a new message waiting in your support thread. Open Support in your dashboard to read it and reply.",
    },
    toPlatform: {
      subject: "A new support message from {store}",
      heading: "A merchant wrote in",
      body: "{store} sent a new message. Open their thread in the platform inbox to read it and reply.",
    },
  },
} as const;
