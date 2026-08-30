import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ORDER_STATUS_VIEW,
  statusViewFor,
} from "@/app/s/[slug]/order/[token]/status-block";
import { strings } from "@/lib/strings";
import { OrderChannel, OrderState } from "@/server/db/enums";
import { STATES_BY_CHANNEL } from "@/components/order-state-chip";

/**
 * CHK-05, asserted rather than trusted.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS ACTUALLY PROTECTING.
 * ---------------------------------------------------------------------------
 * CHK-05 is worded absolutely: there is no state in which a customer opens
 * their tracking link and cannot tell where their order is. That requirement
 * has exactly one realistic failure mode, and it is not a bug anyone writes on
 * purpose — it is a MIGRATION. Somebody adds a seventh member to `OrderState`
 * in `prisma/schema.prisma`, every existing test still passes because every
 * existing test lists six, and the first customer whose order reaches the new
 * state opens a page with an icon-shaped hole where the answer should be.
 *
 * So the sweep below is driven off `OrderState`'s own keys. A hand-written
 * array of six would be a restatement of the bug it is meant to catch: it would
 * pass forever, in perfect confidence, while covering less every year.
 *
 * The compile-time half of the same guarantee lives in the component —
 * `ORDER_STATUS_VIEW` is `satisfies Readonly<Record<OrderState, …>>`, so the
 * seventh state fails `tsc` before it ever reaches this file. This test is the
 * belt to that suspenders, and it is the half that produces a message telling
 * the reader WHICH state is missing and WHY it matters.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A UNIT TEST OVER A `.tsx` MODULE.
 * ---------------------------------------------------------------------------
 * The map is a plain data object, which is exactly why 03-UI-SPEC.md asks for a
 * `Record` and not a `switch` inside the component. Nothing here renders, so
 * there is no DOM and no database, and this stays in the fast `unit` project.
 */

/**
 * Every `OrderState`, from the generated enum object.
 *
 * `Object.keys` on the enum rather than on `ORDER_STATUS_VIEW` itself: reading
 * the keys off the map under test would make every assertion below vacuously
 * true — a map missing a state would simply never be asked about it.
 */
const ALL_STATES = Object.keys(OrderState) as OrderState[];

/** Every `OrderChannel`, for the same reason. */
const ALL_CHANNELS = Object.keys(OrderChannel) as OrderChannel[];

/**
 * The tokens that must never survive into rendered copy.
 *
 * Both enums' member names, because 03-UI-SPEC.md § B7's third additional rule
 * bans rendering the raw enum, and `PAYMENT_CLAIMED` leaking into a heading is
 * the exact shape of "we forgot to author this row and fell back to the value".
 */
const RAW_ENUM_NAMES = [...ALL_STATES, ...ALL_CHANNELS] as string[];

/** Every authored heading in `strings.orderStatus`, per B7's table. */
const AUTHORED_HEADINGS = [
  strings.orderStatus.placedWhatsappHeading,
  strings.orderStatus.placedCodHeading,
  strings.orderStatus.paymentPendingHeading,
  strings.orderStatus.paymentClaimedHeading,
  strings.orderStatus.confirmedHeading,
  strings.orderStatus.disputedHeading,
  strings.orderStatus.fulfilledHeading,
] as string[];

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const COMPONENT_FILE = "src/app/s/[slug]/order/[token]/status-block.tsx";

describe("every order state has authored customer copy (CHK-05)", () => {
  it("covers every OrderState member for at least one channel", () => {
    const missing = ALL_STATES.filter((state) =>
      ALL_CHANNELS.every((channel) => {
        const view = statusViewFor(state, channel);
        return (
          view === undefined ||
          view.heading.trim() === "" ||
          view.body.trim() === ""
        );
      }),
    );

    expect(
      missing,
      "CHK-05 violation — an OrderState has no customer-facing copy.\n" +
        `  States with no authored row: ${missing.join(", ") || "(none)"}\n` +
        "  CHK-05 is absolute: a customer opening their tracking link must " +
        "always be told explicitly where their order is. A state with no row " +
        "in ORDER_STATUS_VIEW renders the status region blank — not a spinner, " +
        "not a fallback, nothing — and the customer is left guessing about " +
        "money they have already sent.\n" +
        `  Add the row to ${COMPONENT_FILE} with its icon, heading and body ` +
        "from 03-UI-SPEC.md § B7's table, and the copy itself to " +
        "strings.orderStatus.",
    ).toEqual([]);
  });

  it("names every state in the map, with no key the enum does not have", () => {
    expect(
      Object.keys(ORDER_STATUS_VIEW).sort(),
      "ORDER_STATUS_VIEW and the OrderState enum disagree about which states " +
        "exist.\n" +
        "  The map is the customer's whole vocabulary for their order. A key " +
        "the enum lost is dead copy; a member the map lost is a blank page.",
    ).toEqual([...ALL_STATES].sort());
  });

  it("resolves an icon for every state and channel", () => {
    const iconless: string[] = [];

    for (const state of ALL_STATES) {
      for (const channel of ALL_CHANNELS) {
        const view = statusViewFor(state, channel);
        if (view === undefined || view.icon === undefined) {
          iconless.push(`${state} / ${channel}`);
        }
      }
    }

    expect(
      iconless,
      "A state and channel pair resolves to no icon.\n" +
        "  03-UI-SPEC.md § B7 gives the status block three parts — a 24px " +
        "icon, a Display heading and a Body explanation — and this surface " +
        "carries NO coloured chip, so the icon is one third of the entire " +
        "signal rather than decoration.",
    ).toEqual([]);
  });
});

describe("the ORDER_PLACED split reads differently per channel", () => {
  it("says sent on WhatsApp and received on cash on delivery", () => {
    const whatsapp = statusViewFor("ORDER_PLACED", "WHATSAPP");
    const cod = statusViewFor("ORDER_PLACED", "CASH_ON_DELIVERY");

    expect(whatsapp.heading).toBe(strings.orderStatus.placedWhatsappHeading);
    expect(cod.heading).toBe(strings.orderStatus.placedCodHeading);

    expect(
      whatsapp.heading,
      "ORDER_PLACED renders the same heading on both channels.\n" +
        "  These are two different facts about the world. A WhatsApp order was " +
        "SENT and is waiting on a conversation; a cash-on-delivery order was " +
        "RECEIVED and is waiting on a courier. Collapsing them tells one of " +
        "the two customers something untrue about what happens next — which is " +
        "why strings.orderStatus carries seven headings for six states.",
    ).not.toBe(cod.heading);

    expect(whatsapp.body).not.toBe(cod.body);
    expect(
      whatsapp.icon,
      "The two ORDER_PLACED channels share an icon. B7 gives WhatsApp " +
        "message-circle and cash on delivery truck, because the icon is the " +
        "fastest-read half of the split.",
    ).not.toBe(cod.icon);
  });
});

describe("the map agrees with the channel's real state set", () => {
  it("authors copy for every state a channel can actually reach", () => {
    const gaps: string[] = [];

    for (const channel of ALL_CHANNELS) {
      for (const state of STATES_BY_CHANNEL[channel]) {
        const view = statusViewFor(state, channel);
        if (
          view === undefined ||
          view.heading.trim() === "" ||
          view.body.trim() === ""
        ) {
          gaps.push(`${channel} / ${state}`);
        }
      }
    }

    expect(
      gaps,
      "A state a channel can genuinely reach has no copy on the tracking " +
        "page.\n" +
        "  STATES_BY_CHANNEL is the display half of D-02/D-03 and is itself " +
        "cross-checked against the server state machine by " +
        "tests/unit/order-state-chip.test.ts. So a pair listed there is a page " +
        "a real customer will really open.",
    ).toEqual([]);
  });

  it("keeps the payment states off the channels that never pay in band", () => {
    // Not a statement about the copy map — a statement about the fact the copy
    // map is allowed to rely on. PAYMENT_PENDING, PAYMENT_CLAIMED and DISPUTED
    // exist only for MANUAL_TRANSFER (D-02), which is what makes it correct for
    // those three rows to carry one view rather than a per-channel split.
    for (const state of [
      "PAYMENT_PENDING",
      "PAYMENT_CLAIMED",
      "DISPUTED",
    ] as const) {
      expect(STATES_BY_CHANNEL.WHATSAPP as readonly OrderState[]).not.toContain(
        state,
      );
      expect(
        STATES_BY_CHANNEL.CASH_ON_DELIVERY as readonly OrderState[],
      ).not.toContain(state);
      expect(
        STATES_BY_CHANNEL.MANUAL_TRANSFER as readonly OrderState[],
      ).toContain(state);
    }
  });

  it("shows CONFIRMED and FULFILLED on all three channels", () => {
    for (const state of ["CONFIRMED", "FULFILLED"] as const) {
      for (const channel of ALL_CHANNELS) {
        const view = statusViewFor(state, channel);
        expect(view.heading.trim().length).toBeGreaterThan(0);
        expect(view.body.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("nothing machine-shaped reaches the customer", () => {
  it("renders no raw enum name in any heading or body", () => {
    const offenders: string[] = [];

    for (const state of ALL_STATES) {
      for (const channel of ALL_CHANNELS) {
        const view = statusViewFor(state, channel);
        for (const token of RAW_ENUM_NAMES) {
          if (view.heading.includes(token) || view.body.includes(token)) {
            offenders.push(`${state} / ${channel}: ${token}`);
          }
        }
      }
    }

    expect(
      offenders,
      "A raw enum name reached customer-facing copy.\n" +
        "  03-UI-SPEC.md § B7's additional rules ban it outright. " +
        "\"PAYMENT_CLAIMED\" is not a sentence, and a customer reading it " +
        "learns only that something went wrong with the page.",
    ).toEqual([]);
  });

  it("reads every heading from strings.orderStatus", () => {
    const unauthored: string[] = [];

    for (const state of ALL_STATES) {
      for (const channel of ALL_CHANNELS) {
        const { heading } = statusViewFor(state, channel);
        if (!AUTHORED_HEADINGS.includes(heading)) {
          unauthored.push(`${state} / ${channel}: "${heading}"`);
        }
      }
    }

    expect(
      unauthored,
      "A status heading is not one of the seven authored in " +
        "strings.orderStatus.\n" +
        "  CLAUDE.md's copy rule is not decoration here: strings.ts is meant " +
        "to become the `en` message catalogue whole, and a heading inlined in " +
        "the component is a heading the later extraction cannot see.",
    ).toEqual([]);
  });
});

describe("a seventh state cannot ship as a blank page", () => {
  it("types the map against the whole OrderState enum", () => {
    expect(
      existsSync(join(repoRoot, COMPONENT_FILE)),
      `${COMPONENT_FILE} does not exist, so this file's source assertion ` +
        "would pass over an empty string with zero coverage.",
    ).toBe(true);

    const source = readFileSync(join(repoRoot, COMPONENT_FILE), "utf8");

    expect(
      /satisfies\s+Readonly<\s*Record<\s*OrderState\s*,/.test(source),
      "ORDER_STATUS_VIEW is no longer typed against the full OrderState " +
        "enum.\n" +
        "  The `satisfies Readonly<Record<OrderState, …>>` clause is what " +
        "turns a seventh state added to prisma/schema.prisma into a `tsc` " +
        "failure at the map that forgot it. Without it the gap is silent " +
        "until a customer finds it, and the runtime sweep in this file is the " +
        "only thing left — one release later than it should have fired.",
    ).toBe(true);
  });
});
