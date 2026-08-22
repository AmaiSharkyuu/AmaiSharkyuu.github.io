#!/usr/bin/env node
/**
 * RecipeCraft icon fetcher
 * ------------------------
 * Downloads the missing inventory icons into assets/items/<item_id>.png.
 * Icons that already exist are never touched, so any texture you added by
 * hand stays exactly as it is.
 *
 * Waxed copper is handled first and never hits the network: in game it looks
 * exactly like un-waxed copper, so waxed_<x> always copies <x>'s icon.
 *
 * For everything else, sources are tried in order:
 *   1. minecraft.wiki inventory sprite   Invicon_<Item_Name>.png   (best looking)
 *   2. the same file as an animated .gif (only if it is small)
 *   3. the vanilla texture from mcmeta   textures/item|block/<id>.png
 *      (animation strips are cropped down to their first frame)
 *   4. a local alias - a slab falls back to its block, every banner pattern
 *      shares one texture, and so on
 *
 * Usage:
 *   node tools/build.mjs        # first: refresh the data + the missing list
 *   node tools/fetch-icons.mjs  # then: download what is missing
 *   node tools/fetch-icons.mjs --dry   # only report, download nothing
 *
 * Anything still missing afterwards is listed in tools/missing-icons.txt -
 * drop a PNG named <item_id>.png in assets/items/ and re-run tools/build.mjs.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const ICONS = path.join(ROOT, "assets", "items");
const UA = "AmaiCraft-RecipeCraft/1.0 (static Minecraft fan site)";
const CONCURRENCY = 4;
const MAX_GIF = 60 * 1024; // bigger animated sprites are not worth the bandwidth
const DRY = process.argv.includes("--dry");

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "recipes.json"), "utf8"));
const items = data.items;
const MC = data.version;
const TEX = `https://raw.githubusercontent.com/misode/mcmeta/${MC}-assets/assets/minecraft/textures`;

/* ------------------------------------------------------------------ */
/* PNG helpers - crop an animation strip down to its first frame       */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, body) {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "ascii");
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Returns the first square frame of a vertical animation strip, or the buffer unchanged. */
function cropFirstFrame(buf) {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return buf;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (height <= width || interlace !== 0 || !CHANNELS[colorType]) return buf;

  const keep = [];
  const idat = [];
  let pos = 8;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IDAT") idat.push(body);
    else if (type === "PLTE" || type === "tRNS") keep.push(chunk(type, body));
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!idat.length) return buf;

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bitsPerPixel = CHANNELS[colorType] * bitDepth;
  const stride = 1 + Math.ceil((width * bitsPerPixel) / 8);
  const rows = Math.min(width, height);
  if (raw.length < stride * rows) return buf;

  const ihdr = Buffer.from(buf.subarray(16, 29));
  ihdr.writeUInt32BE(rows, 4); // new height

  return Buffer.concat([
    buf.subarray(0, 8),
    chunk("IHDR", ihdr),
    ...keep,
    chunk("IDAT", zlib.deflateSync(raw.subarray(0, stride * rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* Candidate URLs                                                      */
/* ------------------------------------------------------------------ */

const titleFromId = (id) =>
  id.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("_");

function wikiNames(id, name) {
  // extended / level II potions look exactly like the base potion
  const plain = name.replace(/ \((extended|level II)\)$/, "");
  const out = [plain.replace(/ /g, "_")];

  // armour trim templates are all called "Smithing Template" in game
  const trim = /^(.*)_smithing_template$/.exec(id);
  if (trim) out.push(titleFromId(trim[1]));

  // "Awkward Potion" <-> "Potion of Awkwardness"
  const suffix = /^(.*) Potion$/.exec(name);
  if (suffix) out.push(("Potion of " + suffix[1]).replace(/ /g, "_"));
  if (/^Potion of /.test(name)) out.push((name.replace(/^Potion of /, "") + " Potion").replace(/ /g, "_"));

  out.push(titleFromId(id));
  return [...new Set(out)];
}

/** vanilla texture paths worth trying for an item id */
function texturePaths(id) {
  const out = [`item/${id}`, `block/${id}`];
  if (/_banner_pattern$/.test(id)) out.push("item/banner_pattern");
  if (id === "tipped_arrow") out.push("item/arrow");
  const pot = /^(lingering_potion|splash_potion|potion)_/.exec(id);
  if (pot) out.push("item/" + pot[1], "item/potion");
  if (/_potion$/.test(id) || id === "potion") out.push("item/potion");
  if (/^music_disc_/.test(id)) out.push("item/music_disc");
  if (/_map$/.test(id)) out.push("item/filled_map", "item/map");
  return out;
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

async function get(url, maxBytes = Infinity) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100 || buf.length > maxBytes) return null;
  return buf;
}

const isPNG = (b) => b && b[0] === 0x89 && b[1] === 0x50;
const isGIF = (b) => b && b.toString("ascii", 0, 3) === "GIF";

async function findIcon(id, name) {
  for (const n of wikiNames(id, name)) {
    const url = `https://minecraft.wiki/images/Invicon_${encodeURIComponent(n)}.png`;
    const buf = await get(url).catch(() => null);
    if (isPNG(buf)) return { buf, ext: "png" };
  }
  for (const n of wikiNames(id, name)) {
    const url = `https://minecraft.wiki/images/Invicon_${encodeURIComponent(n)}.gif`;
    const buf = await get(url, MAX_GIF).catch(() => null);
    if (isGIF(buf)) return { buf, ext: "gif" };
  }
  for (const p of texturePaths(id)) {
    const buf = await get(`${TEX}/${p}.png`).catch(() => null);
    if (isPNG(buf)) {
      try {
        return { buf: cropFirstFrame(buf), ext: "png" };
      } catch {
        return { buf, ext: "png" };
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Mirrors: items that are visually identical to another item          */
/* ------------------------------------------------------------------ */

/** Waxed copper looks exactly like un-waxed copper, so it reuses that icon. */
const mirrorOf = (id) => (/^waxed_/.test(id) ? id.replace(/^waxed_/, "") : null);

const fileFor = (id) => {
  for (const ext of ["png", "webp", "gif"]) {
    const f = path.join(ICONS, id + "." + ext);
    if (fs.existsSync(f)) return f;
  }
  return null;
};

/** copies the base icon onto every mirrored id whose icon is missing or stale */
function applyMirrors(ids) {
  let n = 0;
  for (const id of ids) {
    const base = mirrorOf(id);
    if (!base) continue;
    const src = fileFor(base);
    if (!src) continue;
    const dest = path.join(ICONS, id + path.extname(src));
    const cur = fileFor(id);
    if (cur && cur === dest && fs.readFileSync(cur).equals(fs.readFileSync(src))) continue;
    if (cur && cur !== dest) fs.rmSync(cur); // stale copy under another extension
    fs.copyFileSync(src, dest);
    n++;
  }
  return n;
}

const have = new Set(
  fs.existsSync(ICONS)
    ? fs.readdirSync(ICONS).map((f) => f.replace(/\.(png|webp|gif)$/i, ""))
    : []
);

// mirrored ids never hit the network: they always follow their base item
const todo = Object.keys(items).filter(
  (id) => !have.has(id) && !items[id].h && !mirrorOf(id)
);
console.log(`${todo.length} icons missing (Minecraft ${MC})`);
if (DRY) {
  console.log(todo.join("\n"));
  process.exit(0);
}
fs.mkdirSync(ICONS, { recursive: true });

let ok = 0;
const failed = [];
let cursor = 0;

async function worker() {
  while (cursor < todo.length) {
    const id = todo[cursor++];
    const found = await findIcon(id, items[id].n);
    if (found) {
      fs.writeFileSync(path.join(ICONS, id + "." + found.ext), found.buf);
      ok++;
    } else {
      failed.push(id);
    }
    const done = ok + failed.length;
    if (done % 50 === 0) process.stdout.write(`  ${done}/${todo.length}\r`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

/* last resort: reuse an icon we already have locally.
   Waxed copper looks exactly like un-waxed copper, a slab shows the block
   texture, an enchanted golden apple is a golden apple with a glint. */
function aliasIds(id) {
  const out = [];
  const strip = /^(.*?)(_slab|_stairs|_wall|_fence|_button|_pressure_plate|_bulb)$/.exec(id);
  if (strip) out.push(strip[1]);
  if (id === "enchanted_golden_apple") out.push("golden_apple");
  // extended / level II potions reuse the base potion icon
  const pot = /^((?:lingering_potion|splash_potion|potion)_)(?:long_|strong_)(.*)$/.exec(id);
  if (pot) out.push(pot[1] + pot[2]);
  return out;
}

const mirrored = applyMirrors(Object.keys(items).filter((id) => !items[id].h));
if (mirrored) console.log(`\n${mirrored} waxed icons copied from their un-waxed twin`);

const stillMissing = [];
for (const id of failed) {
  let done = false;
  for (const alias of aliasIds(id)) {
    for (const ext of ["png", "webp", "gif"]) {
      const src = path.join(ICONS, alias + "." + ext);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(ICONS, id + "." + ext));
        ok++;
        done = true;
        break;
      }
    }
    if (done) break;
  }
  if (!done) stillMissing.push(id);
}
failed.length = 0;
failed.push(...stillMissing);

fs.writeFileSync(
  path.join(HERE, "missing-icons.txt"),
  failed.sort().map((i) => i + "\t" + items[i].n).join("\n")
);

console.log(`\ndownloaded ${ok} icons`);
console.log(`${failed.length} still missing -> tools/missing-icons.txt`);
console.log("Re-run `node tools/build.mjs` so the site picks the new files up.");
