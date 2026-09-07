import { describe, expect, it } from "vitest";

import { bucketByDay } from "@/server/dashboard/buckets";

/**
 * Quick task 260906-egn, Task 4 — `bucketByDay` is a pure function with no
 * I/O and no clock read, so every boundary case that would otherwise need a
 * live database and a frozen clock is testable here as plain arithmetic.
 *
 * The UTC+1 midnight-boundary case is the one most likely to silently
 * regress: Cameroon (Douala) is WAT, UTC+1 year-round with no DST, so a row
 * placed late in the UTC day genuinely belongs to the NEXT Douala-local
 * calendar day. A future edit that "simplifies" the bucketing back to raw UTC
 * days would pass every other assertion here and still be wrong for exactly
 * the customers this product serves.
 */

const DAY_MS = 86_400_000;

describe("bucketByDay", () => {
  it("always returns exactly 7 buckets, oldest first", () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    const buckets = bucketByDay([], since);

    expect(buckets).toHaveLength(7);
    expect(buckets[0]?.dayKey < buckets[6]!.dayKey).toBe(true);
  });

  it("returns 7 zero-total buckets for empty input, not an empty array and not NaN", () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    const buckets = bucketByDay([], since);

    expect(buckets).toHaveLength(7);
    for (const bucket of buckets) {
      expect(bucket.totalXaf).toBe(0);
      expect(Number.isNaN(bucket.totalXaf)).toBe(false);
      expect(bucket.percentOfMax).toBe(0);
    }
  });

  it("buckets a row placed at 23:30 UTC into the NEXT day, because Douala is UTC+1", () => {
    // `since` is day 0's UTC midnight. A row at 23:30 UTC on day 0 is 00:30
    // Douala-local on day 1, so it must land in bucket index 1, not bucket 0.
    const since = new Date("2026-01-05T00:00:00.000Z");
    const placedAt = new Date("2026-01-05T23:30:00.000Z");

    const buckets = bucketByDay([{ placedAt, totalXaf: 1000 }], since);

    expect(buckets[0]?.totalXaf).toBe(0);
    expect(buckets[1]?.totalXaf).toBe(1000);
  });

  it("a row landing exactly on a bucket boundary goes to the later bucket", () => {
    // Shifted-to-Douala timestamp lands exactly 2 * 86_400_000ms after
    // `since` — precisely the day-2/day-3 boundary. It must count in bucket
    // 2 (the day that boundary instant BEGINS), not bucket 1.
    const since = new Date("2026-01-05T00:00:00.000Z");
    const offsetMs = 60 * 60_000; // DOUALA_UTC_OFFSET_MINUTES
    const placedAt = new Date(since.getTime() + 2 * DAY_MS - offsetMs);

    const buckets = bucketByDay([{ placedAt, totalXaf: 500 }], since);

    expect(buckets[1]?.totalXaf).toBe(0);
    expect(buckets[2]?.totalXaf).toBe(500);
  });

  it("clamps a row outside the 7-day window into range instead of writing out of bounds", () => {
    const since = new Date("2026-01-05T00:00:00.000Z");

    // Ten days before the window: would be index -10 unclamped.
    const tooEarly = new Date(since.getTime() - 10 * DAY_MS);
    // Ten days after the window: would be index 10 unclamped.
    const tooLate = new Date(since.getTime() + 10 * DAY_MS);

    const buckets = bucketByDay(
      [
        { placedAt: tooEarly, totalXaf: 100 },
        { placedAt: tooLate, totalXaf: 200 },
      ],
      since,
    );

    expect(buckets).toHaveLength(7);
    expect(buckets[0]?.totalXaf).toBe(100);
    expect(buckets[6]?.totalXaf).toBe(200);
  });

  it("computes percentOfMax relative to the largest bucket, and 0 when every bucket is 0", () => {
    const since = new Date("2026-01-05T00:00:00.000Z");
    const day0 = new Date(since.getTime());
    const day1 = new Date(since.getTime() + DAY_MS);

    const buckets = bucketByDay(
      [
        { placedAt: day0, totalXaf: 1000 },
        { placedAt: day1, totalXaf: 500 },
      ],
      since,
    );

    expect(buckets[0]?.percentOfMax).toBe(100);
    expect(buckets[1]?.percentOfMax).toBe(50);
    expect(buckets[2]?.percentOfMax).toBe(0);

    const allZero = bucketByDay([], since);
    for (const bucket of allZero) {
      expect(bucket.percentOfMax).toBe(0);
    }
  });
});
