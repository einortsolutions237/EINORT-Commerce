// Rerunnable generator for the platform's favicon/icon/apple-icon files.
//
// The master brand asset (src/assets/brand/einort-logo.png) is the single
// source of truth for every derived icon. This script is not a one-off: it
// exists so a future re-export of the master mark (new colors, a redraw)
// regenerates every derivative from one command rather than three manual
// exports. It sanity-checks the master's shape before deriving anything,
// and self-verifies the hand-built favicon.ico before exiting, so a silently
// wrong master asset fails loudly here instead of shipping a corrupt icon.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const masterPath = fileURLToPath(new URL("../src/assets/brand/einort-logo.png", import.meta.url));
const iconPath = fileURLToPath(new URL("../src/app/icon.png", import.meta.url));
const appleIconPath = fileURLToPath(new URL("../src/app/apple-icon.png", import.meta.url));
const faviconPath = fileURLToPath(new URL("../src/app/favicon.ico", import.meta.url));

const masterMeta = await sharp(masterPath).metadata();
if (masterMeta.width !== 645 || masterMeta.height !== 606 || !masterMeta.hasAlpha) {
  console.error(
    `[generate-brand-icons] master asset shape check failed: got ${masterMeta.width}x${masterMeta.height}, hasAlpha=${masterMeta.hasAlpha} — expected 645x606 with an alpha channel.`,
  );
  process.exitCode = 1;
}

if (process.exitCode === 1) {
  // Stop here — do not derive icons from an unexpectedly-shaped master.
} else {
  /**
   * Resize the master onto a transparent square of the given pixel size.
   * `fit: "contain"` letterboxes rather than crops, preserving the full
   * faceted mark and its keyhole cutout instead of risking a sliced corner.
   */
  async function squareIcon(size) {
    return sharp(masterPath)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  const iconBuffer = await squareIcon(64);
  writeFileSync(iconPath, iconBuffer);

  const appleIconBuffer = await squareIcon(180);
  writeFileSync(appleIconPath, appleIconBuffer);

  const faviconPngBuffer = await squareIcon(32);

  // ICONDIR header — 6 bytes, all fields little-endian uint16.
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0); // reserved
  iconDir.writeUInt16LE(1, 2); // imageType: 1 = icon
  iconDir.writeUInt16LE(1, 4); // imageCount

  // ICONDIRENTRY — 16 bytes.
  const iconDirEntry = Buffer.alloc(16);
  iconDirEntry.writeUInt8(32, 0); // width
  iconDirEntry.writeUInt8(32, 1); // height
  iconDirEntry.writeUInt8(0, 2); // colorCount: 0 = no palette
  iconDirEntry.writeUInt8(0, 3); // reserved
  iconDirEntry.writeUInt16LE(1, 4); // colorPlanes
  iconDirEntry.writeUInt16LE(32, 6); // bitsPerPixel: 32 (RGBA)
  iconDirEntry.writeUInt32LE(faviconPngBuffer.length, 8); // sizeInBytes
  iconDirEntry.writeUInt32LE(22, 12); // imageOffset: 6 + 16

  const favicon = Buffer.concat([iconDir, iconDirEntry, faviconPngBuffer]);
  writeFileSync(faviconPath, favicon);

  // Self-verify the written favicon.ico before exiting.
  const written = readFileSync(faviconPath);
  const header = [...written.subarray(0, 6)];
  const expectedHeader = [0, 0, 1, 0, 1, 0];
  const headerOk = header.every((byte, i) => byte === expectedHeader[i]);
  if (!headerOk) {
    console.error(
      `[generate-brand-icons] favicon.ico header bytes are [${header.join(",")}], expected [${expectedHeader.join(",")}].`,
    );
    process.exitCode = 1;
  }

  const pngSig = [...written.subarray(22, 26)];
  const expectedPngSig = [0x89, 0x50, 0x4e, 0x47];
  const pngSigOk = pngSig.every((byte, i) => byte === expectedPngSig[i]);
  if (!pngSigOk) {
    console.error(
      `[generate-brand-icons] favicon.ico has no PNG signature at offset 22 — got [${pngSig.join(",")}], expected [${expectedPngSig.join(",")}].`,
    );
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    console.log(`[generate-brand-icons] wrote ${iconPath} (${iconBuffer.length} bytes)`);
    console.log(`[generate-brand-icons] wrote ${appleIconPath} (${appleIconBuffer.length} bytes)`);
    console.log(`[generate-brand-icons] wrote ${faviconPath} (${favicon.length} bytes)`);
  }
}
