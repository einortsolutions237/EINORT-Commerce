import "server-only";

/**
 * THIS MODULE IMPORTS SHARP, SO EVERY ROUTE OR ACTION THAT REACHES IT RUNS IN
 * THE NODE.JS RUNTIME AND MUST NEVER EXPORT A `runtime` CONST SET TO EDGE.
 *
 * That is not a performance preference. Sharp is a binding over libvips, a
 * native C library; the Edge runtime cannot load native binaries at all. The
 * failure is a hard crash on the first request that touches this file — not a
 * slower path, not a degraded image — and it will not appear in a typecheck, a
 * lint run or a local `next dev` session that never exercises the route. Node is
 * the Next.js default, so the correct action is to add nothing (T-03-26).
 *
 * ---------------------------------------------------------------------------
 * WHY A PRESET REGISTRY AND NOT A FUNCTION PER SURFACE (D-07).
 * ---------------------------------------------------------------------------
 * Phase 4's ONB-03 merchant logo needs the same three steps this phase's
 * product images need — presign, direct PUT, derive — differing only in target
 * sizes, fit and background. Written as `processProductImage()` today, that
 * becomes `processLogoImage()` in four weeks, and the second copy is where the
 * EXIF rotation quietly does not get applied. Written as a registry, Phase 4 is
 * a row. The `logo` row is already present and already unused on purpose.
 */

import sharp from "sharp";

/**
 * The registry. One row per surface; the row is the whole specification.
 *
 * `ratio: 1` means the target is `size x size`. `ratio: null` means `size` is
 * the long edge and the aspect ratio is preserved — which is why `claim` uses
 * it: a payment-claim screenshot is evidence, and a square crop can remove the
 * transaction reference the merchant has to read off it.
 *
 * `sizes` is a FIXED list, not a dynamic parameter. `next/image` already handles
 * display-time width variation from a stored original; a pipeline that accepts
 * arbitrary sizes stores an unbounded number of objects per upload and gives an
 * attacker a cheap way to multiply the bucket.
 *
 * `labels` lives in the row rather than in a lookup table beside it, so adding
 * a preset stays a single edit. Labels are the stable public names — they end up
 * in object keys like `{prefix}/card.webp`, so renaming one orphans stored
 * objects rather than moving them.
 *
 * `enhance` says whether the photographic finishing chain (`.normalise()`,
 * `.modulate()`, `.sharpen()`) runs, and it also selects the WebP mode: lossy at
 * `WEBP_QUALITY` when true, lossless when false. It is stated per row for the
 * same reason everything else here is — the row is the whole specification, so
 * `processImage` reads this flag and NEVER branches on the preset's name.
 * Comparing the preset argument against a name literal would put the
 * specification in two places, and the second place is where a future preset
 * silently inherits the wrong treatment.
 */
export const IMAGE_PRESETS = {
  product: {
    sizes: [400, 800, 1600],
    labels: ["thumb", "card", "detail"],
    fit: "cover",
    ratio: 1,
    format: "webp",
    enhance: true,
  },
  claim: {
    sizes: [1200],
    labels: ["full"],
    fit: "inside",
    ratio: null,
    format: "webp",
    enhance: true,
  },
  /**
   * The D-07 Phase-4 slot (ONB-03). Unused in Phase 3 — do NOT delete it as
   * dead code; its existence is the contract that the logo upload adds data
   * rather than a second implementation of this file.
   *
   * THE FALSE ENHANCE FLAG BELOW IS THIS ROW'S WHOLE POINT — DO NOT "RESTORE
   * CONSISTENCY" BY SETTING IT TRUE.
   *
   * The three enhancement steps are tuned for an under-lit phone photo of a
   * product taken indoors. A brand logo is the opposite input: already flat,
   * already correctly exposed, and authored in colours the merchant chose
   * deliberately. On that input `.normalise()` stretches the luminance histogram
   * and shifts the brand's own colours to something adjacent, `.sharpen()` halos
   * the flat edges of a wordmark, and a lossy WebP encode fringes the
   * semi-transparent pixels around it. Each is subtle on its own; together they
   * hand the merchant a logo that looks wrong in a way nobody can name and
   * nobody can file a bug about.
   */
  logo: {
    sizes: [128, 512],
    labels: ["small", "large"],
    fit: "contain",
    ratio: 1,
    format: "webp",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    enhance: false,
  },
} as const;

export type ImagePresetName = keyof typeof IMAGE_PRESETS;

export interface DerivedImage {
  /** Stable public name; becomes the object's basename (`card.webp`). */
  label: string;
  /** The width the bytes ACTUALLY have, read back from the encoder. */
  width: number;
  /** The height the bytes ACTUALLY have, read back from the encoder. */
  height: number;
  contentType: "image/webp";
  body: Buffer;
}

/**
 * 50 megapixels — roughly a 8660x5773 photograph.
 *
 * Comfortably above any phone or consumer camera a Douala merchant will use,
 * and far below the point where decoding costs real money. Sharp's own default
 * is ~268 MP, which is high enough that a hand-crafted header declaring 80 MP
 * sails past it while expanding to a quarter-gigabyte of pixel buffer inside a
 * serverless function. Setting this explicitly is what turns a decompression
 * bomb into a fast, cheap error (T-03-25).
 */
const LIMIT_INPUT_PIXELS = 50_000_000;

/** Merchant photos are usually flat and slightly under-saturated; this is a nudge, not a filter. */
const SATURATION_BOOST = 1.06;

/** High enough that text on a claim screenshot stays legible, low enough to stay cheap. */
const WEBP_QUALITY = 82;

/**
 * Derive every stored representation of one uploaded image.
 *
 * The chain order below is load-bearing, top to bottom:
 *
 *   `.rotate()` with NO ARGUMENTS, FIRST. It auto-orients from the EXIF tag the
 *      camera wrote. Phone photos are the single most common source of sideways
 *      product images, and a `resize` applied before the rotation crops along
 *      the wrong axis — producing a plausible image with the product half out of
 *      frame, which nobody notices until a customer does. Passing an angle here
 *      would replace the automatic behaviour with a fixed one; leave it empty.
 *   `.resize(...)`  the crop/scale, per the preset.
 *   `.normalise()`  stretches luminance across the 1st–99th percentile. This is
 *      the single biggest visual win on a photo shot indoors on a mid-range
 *      phone, which is the realistic input for this product. ONLY when the row
 *      says `enhance`.
 *   `.modulate(...)`, `.sharpen()`  gentle, default-parameter finishing, under
 *      the same flag.
 *   `.webp(...)`    the re-encode, lossy for an enhanced row and lossless for an
 *      unenhanced one. This is also the security control: the object this
 *      platform serves is Sharp's output, never the bytes that were uploaded, so
 *      a polyglot or a script-carrying payload in the original cannot survive
 *      into anything public (T-03-24) — and that holds in both modes, because
 *      lossless still means re-encoded.
 *
 * Only the finishing steps are conditional. `.rotate()` is FIRST AND
 * UNCONDITIONAL for every preset, present and future: a logo is unlikely to
 * carry an EXIF orientation tag, but "unlikely" is not a reason to build a
 * second code path that would not apply it if it did.
 *
 * Dimensions are read back from the encoder's own `info`, never assumed from
 * the requested numbers. For `fit: "inside"` they genuinely differ, and
 * `ProductImage.width`/`height` must record what was actually stored.
 */
export async function processImage(
  input: Buffer,
  preset: ImagePresetName,
): Promise<DerivedImage[]> {
  const spec = IMAGE_PRESETS[preset];
  const background = "background" in spec ? spec.background : undefined;

  const derived: DerivedImage[] = [];

  for (const [index, size] of spec.sizes.entries()) {
    const label = spec.labels[index]!;

    /*
     * For `ratio: 1` the target is a square box. For `ratio: null` the box is
     * still square, but `fit: "inside"` means the image is scaled to fit within
     * it — so the box's edge becomes the long edge and the aspect is preserved.
     */
    /*
     * Held in a local rather than written as one fluent expression, because two
     * of the steps below are per-preset and Sharp's builder cannot express a
     * conditional inline. The alternative — a second `processLogoImage()` — is
     * the exact duplication the registry header rejects, and it is where the
     * EXIF rotation quietly stops being applied.
     */
    let pipeline = sharp(input, {
      limitInputPixels: LIMIT_INPUT_PIXELS,
    })
      .rotate()
      .resize(size, size, {
        fit: spec.fit,
        // `attention` is a cover-only strategy: it picks the crop window with
        // the most detail, which on a product photo is the product. It is not a
        // valid position for `contain` or `inside`, where placement is centred.
        ...(spec.fit === "cover" ? { position: "attention" } : {}),
        ...(background ? { background } : {}),
      });

    if (spec.enhance) {
      pipeline = pipeline
        .normalise()
        .modulate({ saturation: SATURATION_BOOST })
        .sharpen();
    }

    /*
     * Lossless is not a quality preference, it is the other half of an
     * unenhanced row: a lossy encode fringes the semi-transparent pixels
     * around a wordmark and dithers a flat fill, which would undo the fidelity
     * the skipped finishing steps just preserved. A logo is two small
     * derivatives of a mostly-flat image, so lossless WebP is also SMALLER here
     * than the lossy encode would be — there is nothing being traded.
     */
    const { data, info } = await (spec.enhance
      ? pipeline.webp({ quality: WEBP_QUALITY })
      : pipeline.webp({ lossless: true })
    ).toBuffer({ resolveWithObject: true });

    derived.push({
      label,
      width: info.width,
      height: info.height,
      contentType: "image/webp",
      body: data,
    });
  }

  return derived;
}
