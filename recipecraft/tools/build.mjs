#!/usr/bin/env node
/**
 * RecipeCraft data builder
 * ------------------------
 * Turns the official Minecraft vanilla datapack into `data/recipes.json`,
 * the single file the site loads at runtime.
 *
 * Usage:
 *   node tools/build.mjs                # builds the version in DEFAULT_VERSION
 *   node tools/build.mjs 26.2           # builds a specific version
 *   node tools/build.mjs 26.2 --fresh   # ignores the local cache and re-downloads
 *
 * Source: github.com/misode/mcmeta (automatic mirror of the vanilla jar data).
 * Requires: Node 18+ and `tar` (built into Windows 10+, macOS and Linux).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CACHE = path.join(HERE, ".cache");

// "latest" = newest snapshot, "latest-release" = newest stable version,
// or any exact version such as "26.2" / "26.3-snapshot-9".
const DEFAULT_VERSION = "latest";
const args = process.argv.slice(2);
const ASKED = args.find((a) => !a.startsWith("--")) || DEFAULT_VERSION;
const FRESH = args.includes("--fresh");
let VERSION = ASKED;

const log = (...a) => console.log(...a);

/** turns "latest" / "latest-release" into a real version id */
async function resolveVersion(asked) {
  if (asked !== "latest" && asked !== "latest-release") return asked;
  const res = await fetch("https://raw.githubusercontent.com/misode/mcmeta/summary/versions/data.min.json");
  if (!res.ok) throw new Error("cannot read the version list (" + res.status + ")");
  const list = await res.json();
  const pick = asked === "latest-release" ? list.find((v) => v.type === "release") : list[0];
  if (!pick) throw new Error("no matching version found");
  log("Resolved " + asked + " -> " + pick.id);
  return pick.id;
}

/* ------------------------------------------------------------------ */
/* 1. Fetch the vanilla data (cached)                                  */
/* ------------------------------------------------------------------ */

async function download(url, dest) {
  log("  下 " + url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status + " " + res.statusText + " on " + url);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function ensureData() {
  VERSION = await resolveVersion(ASKED);
  const dir = path.join(CACHE, VERSION);
  const dataDir = path.join(dir, "data");
  if (FRESH) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(dataDir)) {
    const tgz = path.join(dir, "data.tar.gz");
    log("Downloading vanilla datapack " + VERSION + "...");
    await download(
      "https://codeload.github.com/misode/mcmeta/tar.gz/refs/tags/" + VERSION + "-data",
      tgz
    );
    log("  extracting...");
    // run from inside the cache folder and use relative paths only:
    // GNU tar reads "C:\..." as a remote host and refuses to extract.
    execFileSync(
      "tar",
      [
        "-xzf", "data.tar.gz", "--strip-components=1",
        "mcmeta-" + VERSION + "-data/data/minecraft/recipe",
        "mcmeta-" + VERSION + "-data/data/minecraft/tags",
      ],
      { cwd: dir, stdio: "inherit" }
    );
    fs.rmSync(tgz, { force: true });
  }

  const lang = path.join(dir, "en_us.json");
  if (!fs.existsSync(lang)) {
    log("Downloading en_us.json...");
    await download(
      "https://raw.githubusercontent.com/misode/mcmeta/" + VERSION + "-assets/assets/minecraft/lang/en_us.json",
      lang
    );
  }

  const reg = path.join(dir, "registries.json");
  if (!fs.existsSync(reg)) {
    log("Downloading registries...");
    await download(
      "https://raw.githubusercontent.com/misode/mcmeta/" + VERSION + "-summary/registries/data.min.json",
      reg
    );
  }
  return { dataDir, lang, reg };
}

/* ------------------------------------------------------------------ */
/* 2. Helpers                                                          */
/* ------------------------------------------------------------------ */

const readJSON = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const bare = (id) => String(id).replace(/^minecraft:/, "");

/**
 * Widest side of an image, read straight from its header (png / gif / webp).
 * The site needs it to tell a 16/32 px game sprite from a 300 px render: the
 * first kind is blown up by a whole factor and kept hard-edged, the second is
 * only scaled down. Either way nothing ever blurs.
 */
function imageWidth(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const b = Buffer.alloc(32);
    fs.readSync(fd, b, 0, 32, 0);

    if (b.readUInt32BE(0) === 0x89504e47) return Math.max(b.readUInt32BE(16), b.readUInt32BE(20));
    if (b.toString("ascii", 0, 3) === "GIF") return Math.max(b.readUInt16LE(6), b.readUInt16LE(8));

    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const kind = b.toString("ascii", 12, 16);
      if (kind === "VP8X") return Math.max(1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3));
      if (kind === "VP8 ") return Math.max(b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff);
      if (kind === "VP8L") {
        const bits = b.readUInt32LE(21);
        return Math.max((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
      }
    }
  } catch {
    /* unreadable header: treat it as a big render, i.e. only scaled down */
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return 0;
}

/** every .json file under a folder, recursively */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. Item tags (resolved recursively)                                 */
/* ------------------------------------------------------------------ */

function loadTags(dataDir) {
  const raw = {};
  for (const kind of ["block", "item"]) {
    const base = path.join(dataDir, "minecraft", "tags", kind);
    if (!fs.existsSync(base)) continue;
    for (const f of walk(base)) {
      const name = path.relative(base, f).replace(/\\/g, "/").replace(/\.json$/, "");
      raw[name] = readJSON(f).values || []; // item tags overwrite block tags
    }
  }

  const cache = new Map();
  function resolve(name, seen = new Set()) {
    if (cache.has(name)) return cache.get(name);
    if (seen.has(name)) return [];
    seen.add(name);
    const out = [];
    for (let v of raw[name] || []) {
      if (v && typeof v === "object") v = v.id;
      if (typeof v !== "string") continue;
      if (v.startsWith("#")) out.push(...resolve(bare(v.slice(1)), seen));
      else out.push(bare(v));
    }
    const uniq = [...new Set(out)];
    cache.set(name, uniq);
    return uniq;
  }

  const resolved = {};
  for (const name of Object.keys(raw)) resolved[name] = resolve(name);
  return resolved;
}

/* ------------------------------------------------------------------ */
/* 4. Ingredients                                                      */
/* ------------------------------------------------------------------ */

/**
 * Normalises every ingredient shape vanilla uses into either
 *   "item_id"                     a single item
 *   { t: "tag", i: [ids] }        a tag - the UI cycles through the items
 *   { i: [ids] }                  an explicit list of alternatives
 */
function makeIngredient(value, tags, usedTags) {
  if (value == null) return null;

  if (Array.isArray(value)) {
    const ids = value.flatMap((v) => {
      const n = makeIngredient(v, tags, usedTags);
      if (!n) return [];
      return typeof n === "string" ? [n] : n.i;
    });
    const uniq = [...new Set(ids)];
    return uniq.length === 1 ? uniq[0] : { i: uniq };
  }

  if (typeof value === "object") {
    if (value.item) return makeIngredient(value.item, tags, usedTags);
    if (value.tag) return makeIngredient("#" + value.tag, tags, usedTags);
    return null;
  }

  const s = String(value);
  if (s.startsWith("#")) {
    const name = bare(s.slice(1));
    const items = tags[name] || [];
    if (!items.length) return null;
    if (items.length === 1) return items[0];
    usedTags.add(name);
    return { t: name, i: items };
  }
  return bare(s);
}

/* ------------------------------------------------------------------ */
/* 5. Categories (mirror of the creative-inventory tabs)               */
/* ------------------------------------------------------------------ */

const COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"];
const WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "bamboo", "crimson", "warped"];

const CATEGORIES = [
  { id: "building", name: "Building Blocks", icon: "bricks" },
  { id: "colored", name: "Colored Blocks", icon: "cyan_wool" },
  { id: "natural", name: "Natural Blocks", icon: "grass_block" },
  { id: "functional", name: "Functional", icon: "crafting_table" },
  { id: "redstone", name: "Redstone", icon: "redstone" },
  { id: "transport", name: "Transport", icon: "minecart" },
  { id: "tools", name: "Tools", icon: "iron_pickaxe" },
  { id: "combat", name: "Combat", icon: "iron_sword" },
  { id: "food", name: "Food & Drinks", icon: "golden_apple" },
  { id: "ingredients", name: "Ingredients", icon: "iron_ingot" },
  { id: "misc", name: "Miscellaneous", icon: "name_tag" },
];

/** technical / unobtainable items - kept searchable but out of the browse grid */
const HIDDEN = /^(air|cave_air|void_air|barrier|bedrock|light|structure_void|structure_block|jigsaw|debug_stick|command_block|chain_command_block|repeating_command_block|command_block_minecart|spawner|trial_spawner|vault|end_portal_frame|reinforced_deepslate|budding_amethyst|infested_.*|knowledge_book|farmland|dirt_path|frogspawn|petrified_oak_slab|.*_wall_.*|water|lava|fire|soul_fire|nether_portal|end_portal|end_gateway|moving_piston|piston_head|bubble_column|test_block|test_instance_block)$/;

const rule = (re, cat) => ({ re, cat });
const RULES = [
  rule(/_sword$|_spear$|_nautilus_armor$|^shield$|^bow$|^crossbow$|^arrow$|^spectral_arrow$|^tipped_arrow$|^trident$|^mace$|_helmet$|_chestplate$|_leggings$|_boots$|_horse_armor$|^wolf_armor$|^totem_of_undying$|^tnt$|^wind_charge$|^fire_charge$|^sulfur_spike$/, "combat"),
  rule(/_pickaxe$|_axe$|_shovel$|_hoe$|^shears$|^flint_and_steel$|^fishing_rod$|^carrot_on_a_stick$|^warped_fungus_on_a_stick$|^brush$|^spyglass$|^clock$|^compass$|^recovery_compass$|^lead$|^name_tag$|^bucket$|_bucket$|^saddle$|^elytra$|^firework_rocket$|^goat_horn$|^map$|^filled_map$|^flint$/, "tools"),
  rule(/^minecart$|_minecart$|_boat$|_chest_boat$|_raft$|_chest_raft$|^rail$|_rail$/, "transport"),
  rule(/^map$|_map$/, "tools"),
  rule(/^(redstone|redstone_torch|redstone_block|repeater|comparator|piston|sticky_piston|observer|dropper|dispenser|hopper|lever|light_weighted_pressure_plate|heavy_weighted_pressure_plate|tripwire_hook|daylight_detector|target|note_block|redstone_lamp|slime_block|honey_block|iron_door|iron_trapdoor|lightning_rod|calibrated_sculk_sensor|crafter)$|_button$|_pressure_plate$|_door$|_trapdoor$|_fence_gate$|copper_bulb$/, "redstone"),
  rule(/^(crafting_table|furnace|blast_furnace|smoker|smithing_table|fletching_table|cartography_table|loom|stonecutter|grindstone|anvil|chipped_anvil|damaged_anvil|brewing_stand|cauldron|composter|barrel|chest|trapped_chest|ender_chest|shulker_box|bookshelf|chiseled_bookshelf|lectern|enchanting_table|beacon|conduit|bell|campfire|soul_campfire|jukebox|respawn_anchor|lodestone|scaffolding|ladder|torch|soul_torch|lantern|soul_lantern|chain|end_crystal|flower_pot|decorated_pot|armor_stand|item_frame|glow_item_frame|painting|candle|beehive|dried_ghast|sculk_shrieker|end_rod|tinted_glass|copper_golem_statue)$|_shulker_box$|_sign$|_hanging_sign$|_bed$|_candle$|_shelf$|_lantern$|_torch$|_chain$|_chest$|_head$|_skull$|_golem_statue$/, "functional"),
  rule(/_wool$|_wool_stairs$|_wool_slab$|_carpet$|_cushion$|_stained_glass$|_stained_glass_pane$|^concrete$|_concrete$|_concrete_stairs$|_concrete_slab$|_concrete_powder$|_terracotta$|_terracotta_stairs$|_terracotta_slab$|_glazed_terracotta$|_banner$|_bundle$|^bundle$|^terracotta$/, "colored"),
  rule(/_dye$|^bone_meal$|^ink_sac$|^glow_ink_sac$|^cocoa_beans$|^lapis_lazuli$/, "ingredients"),
  rule(/_banner_pattern$|^(glowstone_dust|sulfur|potent_sulfur|cinnabar|heavy_core|ominous_bottle|trial_key|ominous_trial_key|raw_iron|raw_gold|raw_copper|snowball|clay_ball|amethyst_shard|prismarine_shard)$/, "ingredients"),
  rule(/^(lilac|peony|rose_bush|sunflower|wildflowers|open_eyeblossom|closed_eyeblossom|pitcher_pod|golden_dandelion|short_dry_grass|tall_dry_grass|pale_hanging_moss|sea_pickle|creaking_heart|bee_nest|ancient_debris|amethyst_cluster|small_amethyst_bud|medium_amethyst_bud|large_amethyst_bud|ochre_froglight|verdant_froglight|pearlescent_froglight)$|_stem$|_hyphae$/, "natural"),
  rule(/^(andesite|diorite|granite|sandstone|cobbled_deepslate|gilded_blackstone|copper_bars)$/, "building"),
  rule(/^(apple|golden_apple|enchanted_golden_apple|bread|cake|cookie|melon_slice|pumpkin_pie|carrot|golden_carrot|potato|baked_potato|poisonous_potato|beetroot|beetroot_soup|mushroom_stew|rabbit_stew|suspicious_stew|dried_kelp|honey_bottle|milk_bucket|potion|splash_potion|lingering_potion|glow_berries|sweet_berries|chorus_fruit|popped_chorus_fruit|water_bottle|awkward_potion)$|^cooked_|^raw_(beef|porkchop|mutton|chicken|rabbit|cod|salmon)$|^(beef|porkchop|mutton|chicken|rabbit|cod|salmon|tropical_fish|pufferfish)$/, "food"),
  rule(/^(iron_ingot|gold_ingot|copper_ingot|netherite_ingot|netherite_scrap|diamond|emerald|quartz|amethyst_shard|coal|charcoal|stick|string|leather|paper|book|writable_book|written_book|enchanted_book|knowledge_book|feather|gunpowder|blaze_rod|blaze_powder|breeze_rod|ghast_tear|magma_cream|fermented_spider_eye|spider_eye|glistering_melon_slice|rabbit_foot|rabbit_hide|phantom_membrane|nether_wart|glass_bottle|dragon_breath|nether_star|heart_of_the_sea|nautilus_shell|prismarine_shard|prismarine_crystals|turtle_scute|armadillo_scute|shulker_shell|echo_shard|disc_fragment_5|resin_brick|resin_clump|slime_ball|honeycomb|clay_ball|brick|nether_brick|firework_star|sugar|wheat|bowl|bone|rotten_flesh|ender_pearl|ender_eye|iron_nugget|gold_nugget|copper_nugget|experience_bottle|blue_egg|brown_egg|egg|blaze_powder)$|_seeds$|_pottery_sherd$|_smithing_template$|^music_disc_|^goat_horn$/, "ingredients"),
  rule(/^(grass_block|dirt|coarse_dirt|rooted_dirt|podzol|mycelium|mud|clay|gravel|sand|red_sand|mushroom_stem|ice|packed_ice|blue_ice|snow|snow_block|magma_block|obsidian|crying_obsidian|netherrack|soul_sand|soul_soil|bone_block|amethyst_block|budding_amethyst|moss_block|moss_carpet|pale_moss_block|pale_moss_carpet|sponge|wet_sponge|sculk|sculk_vein|sculk_catalyst|sculk_sensor|dripstone_block|pointed_dripstone|hay_block|melon|pumpkin|carved_pumpkin|jack_o_lantern|kelp|seagrass|turtle_egg|sniffer_egg|frogspawn|cobweb|nether_wart_block|warped_wart_block|shroomlight|glowstone|sea_lantern|dried_kelp_block|packed_mud|suspicious_sand|suspicious_gravel|dandelion|poppy|allium|azure_bluet|oxeye_daisy|cornflower|wither_rose|torchflower|pitcher_plant|spore_blossom|glow_lichen|hanging_roots|big_dripleaf|small_dripleaf|azalea|flowering_azalea|lily_of_the_valley|lily_pad|vine|weeping_vines|twisting_vines|cactus|sugar_cane|bamboo|chorus_flower|chorus_plant|crimson_fungus|warped_fungus|nether_sprouts|dead_bush|fern|large_fern|tall_grass|short_grass|bush|firefly_bush|leaf_litter|cactus_flower)$|_log$|_wood$|_leaves$|_sapling$|_propagule$|_mushroom$|_mushroom_block$|_ore$|_coral$|_coral_block$|_coral_fan$|_tulip$|_orchid$|_petals$|_roots$|_nylium$|_egg$/, "natural"),
  rule(/_planks$|_stairs$|_slab$|_wall$|_fence$|_bricks$|^bricks$|_brick_|_tiles$|_tile_|^stone$|^cobblestone$|^smooth_|^polished_|^chiseled_|^cut_|^cracked_|^mossy_|_sandstone$|^quartz_|^purpur_|^prismarine|^dark_prismarine|^end_stone|^nether_brick|^red_nether_brick|^deepslate|^tuff|^calcite$|^basalt$|^blackstone$|^glass$|^glass_pane$|^iron_bars$|^mud_brick|^resin_|^bamboo_mosaic|copper$|copper_grate$|_copper_grate$|^waxed_|^exposed_|^weathered_|^oxidized_|_block$|^scaffolding$/, "building"),
];

function categorise(id) {
  for (const r of RULES) if (r.re.test(id)) return r.cat;
  if (COLORS.some((c) => id.startsWith(c + "_"))) return "colored";
  if (WOODS.some((w) => id.startsWith(w + "_"))) return "building";
  return "misc";
}

/* ------------------------------------------------------------------ */
/* 6. Build                                                            */
/* ------------------------------------------------------------------ */

const GRID_EMPTY = () => [null, null, null, null, null, null, null, null, null];

/* ---- potions: one item id + a potion_contents component ------------- */

const potionItems = new Set();

/** "minecraft:potion" + "minecraft:long_leaping" -> "potion_long_leaping" */
function potionId(base, potion) {
  if (!base || !potion) return null;
  return bare(base) + "_" + bare(potion);
}

/** "potion_long_leaping" -> { base: "potion", potion: "leaping", tier: " (extended)" } */
function splitPotion(id) {
  const m = /^(lingering_potion|splash_potion|potion)_(.*)$/.exec(id);
  if (!m) return null;
  let potion = m[2], tier = "";
  if (potion.startsWith("long_")) { potion = potion.slice(5); tier = " (extended)"; }
  else if (potion.startsWith("strong_")) { potion = potion.slice(7); tier = " (level II)"; }
  return { base: m[1], potion, tier };
}

function shapedGrid(recipe, tags, usedTags) {
  const grid = GRID_EMPTY();
  const pattern = recipe.pattern || [];
  for (let r = 0; r < pattern.length && r < 3; r++) {
    const row = pattern[r];
    for (let c = 0; c < row.length && c < 3; c++) {
      const ch = row[c];
      if (ch === " ") continue;
      grid[r * 3 + c] = makeIngredient(recipe.key[ch], tags, usedTags);
    }
  }
  return grid;
}

function shapelessGrid(list, tags, usedTags) {
  const grid = GRID_EMPTY();
  list.slice(0, 9).forEach((ing, i) => {
    grid[i] = makeIngredient(ing, tags, usedTags);
  });
  return grid;
}

function resolveExtra(v, tags, usedTags) {
  if (typeof v === "string" && v.startsWith("#")) return makeIngredient(v, tags, usedTags);
  return v;
}

async function main() {
  const { dataDir, lang, reg } = await ensureData();
  const tags = loadTags(dataDir);
  const L = readJSON(lang);
  const registries = readJSON(reg);
  const allItems = registries.item.map(bare);

  const recipeDir = path.join(dataDir, "minecraft", "recipe");
  const files = walk(recipeDir);
  log("Parsing " + files.length + " vanilla recipes (" + VERSION + ")...");

  const usedTags = new Set();
  const recipes = [];
  const skipped = [];

  for (const f of files) {
    const j = readJSON(f);
    const key = path.relative(recipeDir, f).replace(/\\/g, "/").replace(/\.json$/, "");
    const type = bare(j.type || "");
    const result = j.result && j.result.id ? bare(j.result.id) : null;
    const count = (j.result && j.result.count) || 1;
    const rec = { k: key };
    if (result) rec.r = result;
    if (count !== 1) rec.q = count;

    switch (type) {
      case "crafting_shaped":
        rec.t = "craft";
        rec.g = shapedGrid(j, tags, usedTags);
        break;

      case "crafting_shapeless":
        rec.t = "craft";
        rec.s = 1;
        rec.g = shapelessGrid(j.ingredients || [], tags, usedTags);
        break;

      case "crafting_transmute":
        rec.t = "craft";
        rec.s = 1;
        rec.g = shapelessGrid([j.input, j.material], tags, usedTags);
        break;

      case "crafting_dye":
        rec.t = "craft";
        rec.s = 1;
        rec.g = shapelessGrid([j.target, j.dye], tags, usedTags);
        rec.note = "Add up to 8 dyes at once to mix a custom colour.";
        break;

      case "crafting_imbue": {
        rec.t = "craft";
        const mat = makeIngredient(j.material, tags, usedTags);
        const src = makeIngredient(j.source, tags, usedTags);
        rec.g = [mat, mat, mat, mat, src, mat, mat, mat, mat];
        rec.note = "Any lingering potion works - the arrows keep the potion effect.";
        break;
      }

      case "crafting_decorated_pot": {
        rec.t = "craft";
        const g = GRID_EMPTY();
        g[1] = makeIngredient(j.back, tags, usedTags);
        g[3] = makeIngredient(j.left, tags, usedTags);
        g[5] = makeIngredient(j.right, tags, usedTags);
        g[7] = makeIngredient(j.front, tags, usedTags);
        rec.g = g;
        rec.note = "Each sherd decorates one side. Plain bricks can replace any sherd.";
        break;
      }

      case "smelting":
      case "blasting":
      case "smoking":
        rec.t = type;
        rec.in = makeIngredient(j.ingredient, tags, usedTags);
        if (j.experience) rec.xp = j.experience;
        break;

      case "campfire_cooking":
        rec.t = "campfire";
        rec.in = makeIngredient(j.ingredient, tags, usedTags);
        if (j.experience) rec.xp = j.experience;
        break;

      case "stonecutting":
        rec.t = "stonecutting";
        rec.in = makeIngredient(j.ingredient, tags, usedTags);
        break;

      /* Since 26.3 the brewing stand is data driven. A potion is one item id
         plus a potion_contents component, so each variant becomes a virtual
         item: potion_strength, splash_potion_long_leaping, ... */
      case "brewing": {
        const inId = potionId(j.input?.item, j.input?.potion_contents?.potions);
        const outId = potionId(
          j.output?.id,
          j.output?.components?.["minecraft:potion_contents"]?.potion
        );
        if (!inId || !outId) { skipped.push(type); continue; }
        potionItems.add(inId);
        potionItems.add(outId);
        rec.t = "brewing";
        rec.r = outId;
        rec.in = inId;
        rec.add = makeIngredient(j.reagent?.item, tags, usedTags);
        break;
      }

      case "smithing_transform":
        rec.t = "smithing";
        rec.tpl = makeIngredient(j.template, tags, usedTags);
        rec.base = makeIngredient(j.base, tags, usedTags);
        rec.add = makeIngredient(j.addition, tags, usedTags);
        break;

      case "smithing_trim":
        rec.t = "trim";
        rec.tpl = makeIngredient(j.template, tags, usedTags);
        rec.base = makeIngredient(j.base, tags, usedTags);
        rec.add = makeIngredient(j.addition, tags, usedTags);
        rec.r = bare(j.template);
        rec.note = "Applies the " + bare(j.pattern || "").replace(/_/g, " ") + " trim to any armour piece.";
        break;

      default:
        skipped.push(type); // crafting_special_* - hand written in extra-recipes.json
        continue;
    }
    if (!rec.r) continue;
    recipes.push(rec);
  }

  /* extras: recipes hardcoded in the game, plus brewing */
  const extrasPath = path.join(ROOT, "data", "extra-recipes.json");
  let extraItems = {};
  if (fs.existsSync(extrasPath)) {
    const extrasFile = readJSON(extrasPath);
    // 26.3+ ships real brewing recipes: our hand-written stand is only a
    // fallback for older versions, so skip it when the game provides its own
    const vanillaBrewing = recipes.some((r) => r.t === "brewing");
    const extras = (extrasFile.recipes || []).filter(
      (e) => !(vanillaBrewing && e.t === "brewing")
    );
    extraItems = extrasFile.items || {};
    for (const e of extras) {
      if (e.g) e.g = e.g.map((s) => (s == null ? null : resolveExtra(s, tags, usedTags)));
      for (const f of ["in", "base", "add", "tpl"]) {
        if (e[f]) e[f] = resolveExtra(e[f], tags, usedTags);
      }
      recipes.push(e);
    }
    // notes attached to a vanilla recipe, keyed by its file name
    const notes = extrasFile.notes || {};
    for (const r of recipes) if (notes[r.k] && !r.note) r.note = notes[r.k];
    log("  + " + extras.length + " hand-written recipes (specials, brewing)");
  }

  /* ---------------- items ---------------- */
  /* png, webp and gif are all accepted. If the same item has several files
     the most recently modified one wins - dropping a new texture next to an
     old one just works - and the others are reported so nothing is silent. */
  const iconExt = {};
  const iconPixelArt = {};
  const iconDir = path.join(ROOT, "assets", "items");
  const iconTime = {};
  const iconClashes = [];

  if (fs.existsSync(iconDir)) {
    for (const f of fs.readdirSync(iconDir)) {
      const m = /^(.*)\.(png|webp|gif)$/i.exec(f);
      if (!m) continue;
      const id = m[1];
      const full = path.join(iconDir, f);
      const mtime = fs.statSync(full).mtimeMs;

      if (iconExt[id]) {
        iconClashes.push(id + " (." + iconExt[id] + " / ." + m[2].toLowerCase() + ")");
        if (mtime <= iconTime[id]) continue;
      }
      iconExt[id] = m[2].toLowerCase();
      iconTime[id] = mtime;
      // 48 px or less means a raw game texture: it is pixel art, not a render
      iconPixelArt[id] = imageWidth(full) <= 48;
    }
  }

  const titleCase = (id) =>
    id.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const nameOf = (id) => {
    const p = potionItems.has(id) && splitPotion(id);
    if (p) {
      const base = L["item.minecraft." + p.base + ".effect." + p.potion];
      return (base || titleCase(id)) + p.tier;
    }
    return (
      L["item.minecraft." + id] ||
      L["block.minecraft." + id] ||
      L["entity.minecraft." + id] ||
      titleCase(id)
    );
  };

  // extra items only count when a surviving recipe actually references them
  const mentioned = new Set([...allItems, ...potionItems]);
  const noteIds = (v) => {
    if (!v) return;
    if (typeof v === "string") mentioned.add(v);
    else if (Array.isArray(v)) v.forEach(noteIds);
    else if (v.i) v.i.forEach((x) => mentioned.add(x));
  };
  for (const r of recipes) {
    noteIds(r.r);
    if (r.g) r.g.forEach(noteIds);
    ["in", "base", "add", "tpl"].forEach((f) => noteIds(r[f]));
  }

  const items = {};
  for (const id of [...mentioned].sort()) {
    const ex = extraItems[id];
    const it = {
      n: ex ? ex.n : nameOf(id),
      c: potionItems.has(id) ? "food" : ex ? ex.c : categorise(id),
    };
    if (iconExt[id] && iconExt[id] !== "png") it.x = iconExt[id];
    if (iconPixelArt[id]) it.p = 1; // pixel art: upscale by a whole factor
    if (!iconExt[id]) it.m = 1;  // icon missing from assets/items
    if (HIDDEN.test(id)) it.h = 1; // technical item: searchable, but not browsed
    items[id] = it;
  }

  const tagOut = {};
  for (const t of usedTags) tagOut[t] = tags[t];

  const out = {
    version: VERSION,
    generated: new Date().toISOString().slice(0, 10),
    categories: CATEGORIES,
    items,
    tags: tagOut,
    recipes,
  };

  const dest = path.join(ROOT, "data", "recipes.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out));

  const missing = Object.keys(items).filter((i) => items[i].m);
  fs.writeFileSync(
    path.join(HERE, "missing-icons.txt"),
    missing.map((i) => i + "\t" + items[i].n).join("\n")
  );

  const byCat = {};
  for (const id of Object.keys(items)) byCat[items[id].c] = (byCat[items[id].c] || 0) + 1;

  log("");
  log("OK data/recipes.json  " + (fs.statSync(dest).size / 1024).toFixed(0) + " KB");
  log("   " + recipes.length + " recipes / " + Object.keys(items).length + " items / " + Object.keys(tagOut).length + " tags");
  log("   categories: " + Object.entries(byCat).map(([k, v]) => k + ":" + v).join(" "));
  if (skipped.length) {
    log("   skipped " + skipped.length + " code-only recipes -> covered by data/extra-recipes.json");
  }
  log("   " + missing.length + " items without an icon -> tools/missing-icons.txt");
  if (iconClashes.length) {
    log("   " + iconClashes.length + " items have more than one icon file, newest used: " +
        iconClashes.slice(0, 5).join(", ") + (iconClashes.length > 5 ? " ..." : ""));
  }
}

main().catch((e) => {
  console.error("\nbuild failed: " + e.message);
  process.exit(1);
});
