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

/**
 * ---------------------------------------------------------------------------
 * THE LOGO FIXTURE, AND WHY IT IS BUILT RATHER THAN PHOTOGRAPHED (ONB-03).
 * ---------------------------------------------------------------------------
 * A brand logo is the opposite of the product photo above: flat, already
 * correctly exposed, and mostly transparent. Those are the three properties the
 * `enhance: false` row exists to protect, so the fixture states each of them
 * exactly rather than approximating them with a real wordmark:
 *
 *   - `LOGO_LEFT` / `LOGO_RIGHT` are the "brand's own colours". They are read
 *     back verbatim from the derivative, which is only possible if
 *     `.normalise()` and `.modulate()` did not run and the WebP encode was
 *     lossless. Any one of those three changing turns the assertion red.
 *   - The two blocks differ in luminance on purpose. A single flat colour would
 *     give `.normalise()` a zero-range histogram to stretch, and it would leave
 *     the image alone for reasons that have nothing to do with this preset.
 *   - The canvas is transparent, so a corner pixel proves both the row's
 *     `background: { alpha: 0 }` and an encode that carries alpha through.
 *
 * 480x240 keeps the arithmetic in the assertions below exact: contained in a
 * 128 box the content is 128x64 letterboxed at y=32; in a 512 box it is 512x256
 * letterboxed at y=128.
 */
const LOGO_CANVAS = { width: 480, height: 240 };
const LOGO_LEFT = { r: 176, g: 32, b: 40 };
const LOGO_RIGHT = { r: 32, g: 96, b: 176 };

async function flatLogoPng(): Promise<Buffer> {
  const block = (colour: { r: number; g: number; b: number }): Promise<Buffer> =>
    sharp({
      create: {
        width: 200,
        height: 120,
        channels: 4,
        background: { ...colour, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

  return sharp({
    create: {
      ...LOGO_CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: await block(LOGO_LEFT), left: 20, top: 60 },
      { input: await block(LOGO_RIGHT), left: 260, top: 60 },
    ])
    .png()
    .toBuffer();
}

interface Pixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Decode a derivative back to raw RGBA and read one pixel out of it. */
async function pixelAt(body: Buffer, x: number, y: number): Promise<Pixel> {
  const { data, info } = await sharp(body)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return {
    r: data[offset]!,
    g: data[offset + 1]!,
    b: data[offset + 2]!,
    a: data[offset + 3]!,
  };
}

/** How many pixels of a derivative are exactly this colour, alpha ignored. */
async function countExactColour(
  body: Buffer,
  colour: { r: number; g: number; b: number },
): Promise<number> {
  const { data, info } = await sharp(body)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (
      data[offset] === colour.r &&
      data[offset + 1] === colour.g &&
      data[offset + 2] === colour.b
    ) {
      count += 1;
    }
  }
  return count;
}

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

  it("carries an explicit enhance flag on every row (ONB-03)", () => {
    // The flag is a COLUMN, not a special case: `processImage` reads the row,
    // never the preset's name. A row added without it is a compile error, which
    // is the point — a new surface has to state whether a photographic
    // enhancement chain is appropriate for it.
    expect(IMAGE_PRESETS.product.enhance).toBe(true);
    expect(IMAGE_PRESETS.claim.enhance).toBe(true);
    expect(IMAGE_PRESETS.logo.enhance).toBe(false);
    for (const name of Object.keys(IMAGE_PRESETS) as ImagePresetName[]) {
      expect(typeof IMAGE_PRESETS[name].enhance).toBe("boolean");
    }
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

  it("produces exactly two derivatives labelled small and large", async () => {
    const derived = await processImage(await flatLogoPng(), "logo");
    expect(derived).toHaveLength(2);
    expect(derived.map((d) => d.label)).toEqual(["small", "large"]);
    expect(derived.map((d) => d.width)).toEqual([128, 512]);
  });

  it("keeps a fully transparent corner transparent in both derivatives", async () => {
    // `fit: "contain"` + the row's `background: { alpha: 0 }` + an encode that
    // carries alpha. A lossy WebP fringes semi-transparent edges; an encode that
    // dropped alpha entirely would give the merchant a black box.
    const derived = await processImage(await flatLogoPng(), "logo");
    for (const image of derived) {
      expect((await pixelAt(image.body, 0, 0)).a).toBe(0);
      expect((await pixelAt(image.body, image.width - 1, image.height - 1)).a).toBe(0);
      // The letterbox band above the contained content, well clear of any edge.
      expect((await pixelAt(image.body, Math.floor(image.width / 2), 4)).a).toBe(0);
    }
  });

  it("returns the brand's own colours byte-for-byte, so no enhancement ran", async () => {
    // This is the whole reason `enhance` exists. `.normalise()` stretches the
    // 1st-99th luminance percentile, which on a two-colour wordmark rewrites
    // both colours; `.modulate({ saturation })` pushes them further; a lossy
    // WebP finishes the job. A merchant cannot name what went wrong, only that
    // their logo looks off — so the pipeline is pinned to exact equality here.
    const [small, large] = await processImage(await flatLogoPng(), "logo");

    // 480x240 into a 128 box: content is 128x64 at y=32. The left block spans
    // x 20..219 of 480 (centre 32 out of 128) and y 60..179 (centre 64 with the
    // letterbox offset). The right block's centre is x 96.
    expect(await pixelAt(small!.body, 32, 64)).toMatchObject(LOGO_LEFT);
    expect(await pixelAt(small!.body, 96, 64)).toMatchObject(LOGO_RIGHT);

    // Into a 512 box: content is 512x256 at y=128, so the same centres scale by
    // four.
    expect(await pixelAt(large!.body, 128, 256)).toMatchObject(LOGO_LEFT);
    expect(await pixelAt(large!.body, 384, 256)).toMatchObject(LOGO_RIGHT);
  });

  it("still enhances the product preset — the flag is per row, not global", async () => {
    // The counterpart of the assertion above. Run the SAME flat image through
    // `product` and neither brand colour survives anywhere in the output, which
    // is what proves the previous test is measuring `enhance: false` rather
    // than a pipeline that quietly stopped enhancing everything.
    const flat = await flatLogoPng();
    const derived = await processImage(flat, "product");
    for (const image of derived) {
      expect(await countExactColour(image.body, LOGO_LEFT)).toBe(0);
      expect(await countExactColour(image.body, LOGO_RIGHT)).toBe(0);
    }
  });

  it("still auto-orients from EXIF — .rotate() is unconditional for every preset", async () => {
    // The square output hides orientation in the DIMENSIONS, so the letterbox
    // is what reveals it. The fixture is stored 900x600 landscape but tagged
    // orientation 6, so it DISPLAYS 600x900 portrait: contained in a square box
    // that means transparent bars on the LEFT and RIGHT, and opaque pixels at
    // the vertical extremes. Drop the rotation and the bars swap axis.
    const [small] = await processImage(fixture, "logo");
    expect(small).toBeDefined();

    expect((await pixelAt(small!.body, 1, 64)).a).toBe(0);
    expect((await pixelAt(small!.body, 126, 64)).a).toBe(0);
    expect((await pixelAt(small!.body, 64, 1)).a).toBeGreaterThan(0);
    expect((await pixelAt(small!.body, 64, 126)).a).toBeGreaterThan(0);
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
