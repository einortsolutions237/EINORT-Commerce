import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  IMAGE_PRESETS,
  processImage,
  type ImagePresetName,
} from "@/server/images/pipeline";

/**
 * CAT-02 — the enhancement half of the image pipeline.
 *
 * CAT-02 asks for *enhancement*, not display-time resizing, and the difference
 * is what this file pins down. `next/image` can serve a merchant's photo at
 * three widths; it cannot turn a sideways, flat, underexposed phone snap into
 * something that looks like the merchant paid for a photographer, and it stores
 * no stable derivative that a WhatsApp share or an email can point at. So the
 * bytes are re-encoded once, on upload, and what comes out is what the platform
 * serves forever.
 *
 * Two properties are load-bearing and neither is obvious from reading the code:
 *
 *   1. `rotate()` runs FIRST. A phone photo carries its orientation in EXIF, not
 *      in its pixel layout, so a `resize` applied before the rotation crops the
 *      wrong axis — and it does so silently, producing a plausible-looking image
 *      with the merchant's product half out of frame.
 *   2. The stored object is never the uploaded object. Every derivative is a
 *      fresh WebP encode, which is what makes a polyglot or a script-carrying
 *      payload in the original irrelevant to what gets served (T-03-24).
 *
 * ---------------------------------------------------------------------------
 * REGENERATING `tests/fixtures/sample-product.jpg`
 * ---------------------------------------------------------------------------
 * It is generated with Sharp rather than committed from a stock photo, so it
 * carries no licence question and its properties are stated rather than assumed.
 * It is a 900x600 JPEG — landscape as STORED — tagged EXIF orientation 6, which
 * means "rotate 90 degrees clockwise to display", so the DISPLAYED image is
 * 600x900 portrait. The blocks are deliberately dark and low-contrast so that
 * `normalise()` has something to do. To rebuild it:
 *
 * ```js
 * import sharp from "sharp";
 * const patch = (w, h, r, g, b) =>
 *   sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).png().toBuffer();
 * const out = await sharp({
 *   create: { width: 900, height: 600, channels: 3, background: { r: 78, g: 62, b: 44 } },
 * })
 *   .composite([
 *     { input: await patch(320, 220, 124, 108, 74), left: 60,  top: 70 },
 *     { input: await patch(260, 300, 52, 44, 34),   left: 520, top: 180 },
 *     { input: await patch(140, 140, 96, 86, 58),   left: 300, top: 380 },
 *   ])
 *   .withMetadata({ orientation: 6 })
 *   .jpeg({ quality: 78 })
 *   .toBuffer();
 * // → tests/fixtures/sample-product.jpg  (~6 KB)
 * ```
 *
 * No network and no R2 in this file. Sharp runs locally against the fixture.
 */

const fixture = readFileSync(
  fileURLToPath(new URL("../fixtures/sample-product.jpg", import.meta.url)),
);

/** The stored (pre-rotation) size of the fixture. */
const STORED = { width: 900, height: 600 };
/** What the fixture means once EXIF orientation 6 is honoured. */
const DISPLAYED = { width: 600, height: 900 };

/**
 * A PNG that declares 10000x8000 (80 megapixels) in its IHDR and carries almost
 * no actual data — the classic decompression-bomb shape (T-03-25).
 *
 * 80 MP is chosen deliberately: it is comfortably under Sharp's OWN default
 * ceiling of ~268 MP, so a test that passes here is proving that
 * `limitInputPixels: 50_000_000` was actually set by this codebase rather than
 * accidentally passing on a library default.
 */
function pixelBombPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(typed) >>> 0);
    return Buffer.concat([length, typed, checksum]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.alloc(64))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const isWebp = (body: Buffer): boolean =>
  body.subarray(0, 4).toString("ascii") === "RIFF" &&
  body.subarray(8, 12).toString("ascii") === "WEBP";

describe("the fixture itself", () => {
  it("is a small, non-square JPEG carrying EXIF orientation 6", async () => {
    expect(fixture.byteLength).toBeLessThan(100 * 1024);
    const metadata = await sharp(fixture).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(STORED.width);
    expect(metadata.height).toBe(STORED.height);
    expect(metadata.orientation).toBe(6);
    // Non-square, so a square output can only come from a deliberate crop.
    expect(metadata.width).not.toBe(metadata.height);
  });
});

describe("IMAGE_PRESETS", () => {
  it("product: three fixed square sizes, cover-cropped, WebP", () => {
    expect(IMAGE_PRESETS.product).toMatchObject({
      sizes: [400, 800, 1600],
      fit: "cover",
      ratio: 1,
      format: "webp",
    });
  });

  it("claim: one long-edge size, fit inside, aspect preserved", () => {
    // A payment-claim screenshot is evidence. Cropping it square could remove
    // the transaction reference the merchant has to read, so `ratio` is null.
    expect(IMAGE_PRESETS.claim).toMatchObject({
      sizes: [1200],
      fit: "inside",
      ratio: null,
      format: "webp",
    });
  });

  it("logo: the D-07 Phase-4 slot, contained on a transparent background", () => {
    // ONB-03 has not been built yet. This row exists now so that building it is
    // a data edit rather than a second pipeline — deleting it as dead code is
    // the regression this assertion catches.
    expect(IMAGE_PRESETS.logo).toMatchObject({
      sizes: [128, 512],
      fit: "contain",
      ratio: 1,
      format: "webp",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  });

  it("gives every preset one label per size", () => {
    for (const name of Object.keys(IMAGE_PRESETS) as ImagePresetName[]) {
      const preset = IMAGE_PRESETS[name];
      expect(preset.labels).toHaveLength(preset.sizes.length);
      expect(new Set(preset.labels).size).toBe(preset.labels.length);
    }
  });
});

describe("processImage — product preset", () => {
  it("produces exactly three derivatives labelled thumb, card and detail", async () => {
    const derived = await processImage(fixture, "product");
    expect(derived).toHaveLength(3);
    expect(derived.map((d) => d.label)).toEqual(["thumb", "card", "detail"]);
  });

  it("returns square derivatives at 400, 800 and 1600", async () => {
    const derived = await processImage(fixture, "product");
    for (const [index, size] of [400, 800, 1600].entries()) {
      const image = derived[index]!;
      expect(image.width).toBe(size);
      expect(image.height).toBe(size);
      expect(image.width).toBe(image.height);
    }
  });

  it("reports the dimensions the bytes actually have, not the ones requested", async () => {
    const derived = await processImage(fixture, "product");
    for (const image of derived) {
      const metadata = await sharp(image.body).metadata();
      expect(metadata.width).toBe(image.width);
      expect(metadata.height).toBe(image.height);
    }
  });

  it("re-encodes to WebP rather than passing the original bytes through", async () => {
    const derived = await processImage(fixture, "product");
    for (const image of derived) {
      expect(image.contentType).toBe("image/webp");
      expect(isWebp(image.body)).toBe(true);
      // The uploaded bytes were JPEG; nothing here may still be them.
      expect(image.body.equals(fixture)).toBe(false);
    }
  });
});

describe("processImage — EXIF orientation", () => {
  it("honours orientation 6 before resizing, so the aspect-preserving preset comes back portrait", async () => {
    // The square product preset would hide this: 1:1 out is 1:1 out either way.
    // `claim` preserves aspect, so the orientation shows up in the numbers.
    // Displayed 600x900, fit inside a 1200 box → 800x1200. Skip the rotation
    // and the same image would come back 1200x800.
    const [full] = await processImage(fixture, "claim");
    expect(full).toBeDefined();
    expect(full!.width).toBe(800);
    expect(full!.height).toBe(1200);
    expect(full!.height).toBeGreaterThan(full!.width);

    const ratio = full!.width / full!.height;
    expect(ratio).toBeCloseTo(DISPLAYED.width / DISPLAYED.height, 2);
  });
});

describe("processImage — logo preset (D-07)", () => {
  it("produces the two Phase-4 sizes as WebP", async () => {
    const derived = await processImage(fixture, "logo");
    expect(derived.map((d) => [d.width, d.height])).toEqual([
      [128, 128],
      [512, 512],
    ]);
    for (const image of derived) {
      expect(isWebp(image.body)).toBe(true);
    }
  });
});

describe("processImage — malicious input", () => {
  it("rejects a decompression bomb instead of allocating for it", async () => {
    // 80 MP declared, 69 bytes on the wire. Without limitInputPixels this call
    // asks libvips for roughly a quarter of a gigabyte of pixel buffer.
    await expect(processImage(pixelBombPng(10_000, 8_000), "product")).rejects.toThrow(
      /pixel limit/i,
    );
  });

  it("rejects bytes that are not a decodable image at all", async () => {
    await expect(
      processImage(Buffer.from("this is not an image"), "product"),
    ).rejects.toThrow();
  });
});
