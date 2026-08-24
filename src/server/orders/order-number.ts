import { randomBytes } from "node:crypto";

/**
 * The order number a customer reads back over WhatsApp.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT A SECURITY VALUE, AND IT MUST NOT BECOME ONE.
 * ---------------------------------------------------------------------------
 * `Order.trackingTokenHash` is the credential; this is a label. The order
 * number is short precisely so a person can say it out loud, which also means
 * it is short enough to enumerate — so nothing may ever be authorised by
 * knowing it. Every lookup that grants access goes through the tracking token
 * (see `tracking-token.ts`); the order number exists so a merchant can find a
 * row in their own queue and a customer can name which purchase they mean.
 *
 * ---------------------------------------------------------------------------
 * THE ALPHABET EXCLUDES I, L, O, U, 0 AND 1.
 * ---------------------------------------------------------------------------
 * Not aesthetics — transcription. The channel this number travels over is a
 * voice note or a typed WhatsApp message between two people who are guessing at
 * each other's handwriting and pronunciation. `I` versus `1`, `O` versus `0`
 * and `L` versus `1` are the classic confusions; `U` goes too because "you" and
 * the letter are indistinguishable when someone spells a code aloud in French
 * or English. Thirty characters at length 8 is ~6.6e11 combinations, which is
 * ample for a per-tenant identifier.
 *
 * Uniqueness is NOT this function's promise. `@@unique([tenantId, orderNumber])`
 * is the guarantee; the generator only makes a collision rare. `placeOrder`
 * retries on `P2002` with a fresh number rather than trusting the draw, because
 * "rare" over a long enough run is "eventually", and the failure mode of
 * trusting it is a lost sale at checkout.
 *
 * ---------------------------------------------------------------------------
 * WHY `node:crypto` AND NOT A GENERATOR LIBRARY.
 * ---------------------------------------------------------------------------
 * 03-07-PLAN.md names `nanoid`'s `customAlphabet` here. That package is
 * legitimate and pre-audited (03-RESEARCH.md § Package Legitimacy Audit, `[OK]`)
 * but it is NOT yet a dependency of this repository — plan 03-02 owns its
 * install, and this plan's own threat register says, in T-03-SC, that no
 * package is installed here. Adding it from this plan would contradict that
 * line and would collide with 03-02's own lockfile edit.
 *
 * So the same 12 lines are written directly against `node:crypto`, which is
 * what `customAlphabet` is a wrapper around anyway. Unbiased selection is the
 * only part with a way to be subtly wrong, and it is handled below by rejection
 * sampling rather than by a bare `% 30`. Swapping this body for the library
 * later is a local change with the unit test already in place to catch a
 * regression in the alphabet.
 */

/**
 * Thirty characters, each of which survives being spoken aloud.
 *
 * Exported so `tests/unit/order-number.test.ts` can assert that the emitted
 * characters cover exactly this set — a generator that silently starved the
 * last member of the alphabet would otherwise look correct.
 */
export const ORDER_NUMBER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Long enough to be unique in practice, short enough to dictate. */
export const ORDER_NUMBER_LENGTH = 8;

/**
 * The largest multiple of the alphabet size that fits in a byte.
 *
 * Bytes at or above this are DISCARDED rather than folded in with `%`. Without
 * the discard, 256 % 30 = 16 of the 30 characters would be drawn on 9 of 256
 * byte values and the other 14 on 8 — a measurable bias, and the kind of defect
 * that never surfaces as a bug report, only as a slightly elevated collision
 * rate that someone eventually blames on the database.
 */
const ACCEPT_BELOW = 256 - (256 % ORDER_NUMBER_ALPHABET.length);

/**
 * A fresh, unambiguous, human-transcribable order number.
 *
 * Draws bytes in batches rather than one at a time: a `randomBytes` call is a
 * syscall, and roughly 6% of bytes are rejected, so asking for twice what is
 * needed makes a second round trip almost never necessary while keeping the
 * loop obviously correct for the case where it is.
 */
export function newOrderNumber(): string {
  const size = ORDER_NUMBER_ALPHABET.length;
  let number = "";

  while (number.length < ORDER_NUMBER_LENGTH) {
    for (const byte of randomBytes(ORDER_NUMBER_LENGTH * 2)) {
      if (byte >= ACCEPT_BELOW) continue;
      number += ORDER_NUMBER_ALPHABET[byte % size];
      if (number.length === ORDER_NUMBER_LENGTH) break;
    }
  }

  return number;
}
