// Generates commands/data.js (items, enchantments, effects, attributes, potions) for the
// command generator, from the game files RecipeCraft already downloaded.
//
//   node commands/tools/build-data.mjs            # uses the newest version in the cache
//   node commands/tools/build-data.mjs 26.2       # or a given one
//
// Item names and icons come from recipecraft/data/recipes.json, so run RecipeCraft's
// tools first when a new Minecraft version comes out (see recipecraft/tools/README.md).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..', '..');
const CACHE = join(SITE, 'recipecraft', 'tools', '.cache');

const releases = readdirSync(CACHE).filter((v) => !v.includes('snapshot')).sort((a, b) =>
  a.localeCompare(b, 'en', { numeric: true }));
const version = process.argv[2] || releases[releases.length - 1];
const registries = JSON.parse(readFileSync(join(CACHE, version, 'registries.json'), 'utf8'));
const lang = JSON.parse(readFileSync(join(CACHE, version, 'en_us.json'), 'utf8'));
const recipes = JSON.parse(readFileSync(join(SITE, 'recipecraft', 'data', 'recipes.json'), 'utf8'));

// Version buckets used by the generator (index into VERSIONS in generator.js):
// 0 = 1.16-1.20.1, 1 = 1.20.2-1.20.4, 2 = 1.20.5-1.20.6, 3 = 1.21-1.21.1,
// 4 = 1.21.2-1.21.3, 5 = 1.21.4, 6 = 1.21.5 and newer.

// Normal max level (the generator still lets you go up to 255) and first version bucket.
const ENCHANT_MAX = {
  aqua_affinity: 1, bane_of_arthropods: 5, binding_curse: 1, blast_protection: 4, breach: 4,
  channeling: 1, density: 5, depth_strider: 3, efficiency: 5, feather_falling: 4, fire_aspect: 2,
  fire_protection: 4, flame: 1, fortune: 3, frost_walker: 2, impaling: 5, infinity: 1, knockback: 2,
  looting: 3, loyalty: 3, luck_of_the_sea: 3, lunge: 3, lure: 3, mending: 1, multishot: 1,
  piercing: 4, power: 5, projectile_protection: 4, protection: 4, punch: 2, quick_charge: 3,
  respiration: 3, riptide: 3, sharpness: 5, silk_touch: 1, smite: 5, soul_speed: 3,
  sweeping_edge: 3, swift_sneak: 3, thorns: 3, unbreaking: 3, vanishing_curse: 1, wind_burst: 3,
};
const ENCHANT_SINCE = { breach: 3, density: 3, wind_burst: 3, lunge: 6 };

// Numeric ids, only needed by the 1.16-1.20.1 potion format.
const EFFECT_NUM = [null, 'speed', 'slowness', 'haste', 'mining_fatigue', 'strength', 'instant_health',
  'instant_damage', 'jump_boost', 'nausea', 'regeneration', 'resistance', 'fire_resistance',
  'water_breathing', 'invisibility', 'blindness', 'night_vision', 'hunger', 'weakness', 'poison',
  'wither', 'health_boost', 'absorption', 'saturation', 'glowing', 'levitation', 'luck', 'unluck',
  'slow_falling', 'conduit_power', 'dolphins_grace', 'bad_omen', 'hero_of_the_village', 'darkness'];
const EFFECT_HARMFUL = new Set(['slowness', 'mining_fatigue', 'instant_damage', 'nausea', 'blindness',
  'hunger', 'weakness', 'poison', 'wither', 'levitation', 'unluck', 'darkness', 'infested', 'oozing',
  'weaving', 'wind_charged']);
const EFFECT_SINCE = { infested: 2, oozing: 2, weaving: 2, wind_charged: 2, trial_omen: 2, raid_omen: 2 };

// [first version bucket, prefix used by 1.20.5-1.21.1]. Attributes not listed here are
// recent ones: offered for the newest bucket only.
const ATTRIBUTES = {
  max_health: [0, 'generic'], follow_range: [0, 'generic'], knockback_resistance: [0, 'generic'],
  movement_speed: [0, 'generic'], flying_speed: [0, 'generic'], attack_damage: [0, 'generic'],
  attack_knockback: [0, 'generic'], attack_speed: [0, 'generic'], armor: [0, 'generic'],
  armor_toughness: [0, 'generic'], luck: [0, 'generic'],
  scale: [2, 'generic'], step_height: [2, 'generic'], gravity: [2, 'generic'],
  jump_strength: [2, 'generic'], safe_fall_distance: [2, 'generic'],
  fall_damage_multiplier: [2, 'generic'], max_absorption: [2, 'generic'],
  block_interaction_range: [2, 'player'], entity_interaction_range: [2, 'player'],
  block_break_speed: [2, 'player'],
  burning_time: [3, 'generic'], explosion_knockback_resistance: [3, 'generic'],
  movement_efficiency: [3, 'generic'], oxygen_bonus: [3, 'generic'],
  water_movement_efficiency: [3, 'generic'], mining_efficiency: [3, 'player'],
  sneaking_speed: [3, 'player'], submerged_mining_speed: [3, 'player'],
  sweeping_damage_ratio: [3, 'player'],
};
const ATTRIBUTE_SKIP = new Set(['spawn_reinforcements']);

// ids that already existed in 1.12.2 (before the 1.13 "flattening" renamed many of them)
const OLD_IDS = new Set(JSON.parse(readFileSync(join(HERE, 'ids-1.12.json'), 'utf8')).ids);

// the real extension of each icon, read from disk: recipes.json can be out of date
// (barrel.webp listed as .png) and has no entry for icons added since
const ICON_DIR = join(SITE, 'recipecraft', 'assets', 'items');
const iconExt = {};
for (const f of readdirSync(ICON_DIR)) {
  const m = /^(.+)\.(png|webp|gif)$/.exec(f);
  if (m && !iconExt[m[1]]) iconExt[m[1]] = m[2];
}

const items = Object.entries(recipes.items)
  .map(([id, it]) => [id, it.n, iconExt[id] || '', OLD_IDS.has(id) ? 1 : 0])
  .sort((a, b) => a[1].localeCompare(b[1]));

const enchantments = registries.enchantment.map((id) => [
  id, lang[`enchantment.minecraft.${id}`], ENCHANT_MAX[id] || 1, id.endsWith('_curse') ? 1 : 0,
  ENCHANT_SINCE[id] || 0,
]).sort((a, b) => a[1].localeCompare(b[1]));

const effects = registries.mob_effect.map((id) => [
  id, lang[`effect.minecraft.${id}`], EFFECT_HARMFUL.has(id) ? 1 : 0, EFFECT_NUM.indexOf(id),
  EFFECT_NUM.includes(id) ? 0 : (EFFECT_SINCE[id] ?? 6),
]).sort((a, b) => a[1].localeCompare(b[1]));

const attributes = registries.attribute
  .filter((id) => !ATTRIBUTE_SKIP.has(id) && lang[`attribute.name.${id}`])
  .map((id) => {
    const [since, prefix] = ATTRIBUTES[id] || [6, ''];
    return [id, lang[`attribute.name.${id}`], since, prefix];
  }).sort((a, b) => a[1].localeCompare(b[1]));

const potionName = (id) => {
  const base = id.replace(/^(long|strong)_/, '');
  const name = lang[`item.minecraft.potion.effect.${base}`];
  if (id.startsWith('long_')) return `${name} (Long)`;
  if (id.startsWith('strong_')) return `${name} II`;
  return name;
};
const potions = registries.potion.map((id) => [
  id, potionName(id), ['infested', 'oozing', 'weaving', 'wind_charged'].includes(id) ? 2 : 0,
]).sort((a, b) => a[1].localeCompare(b[1]));

// mobs: everything with a spawn egg, plus the hidden ones
const ENTITIES = JSON.parse(readFileSync(join(HERE, 'entities.json'), 'utf8'));
const OLD_ENTITIES = new Set(ENTITIES['1.12']);
const KNOWN_1214 = new Set(ENTITIES['1.21.4']);
// bogged and breeze were behind an experiment in 1.20.5, the creaking in 1.21.2
const MOB_SINCE = { armadillo: 2, bogged: 3, breeze: 3, creaking: 5 };
// ids that changed in 1.13
const MOB_112 = { snow_golem: 'snowman', iron_golem: 'villager_golem', evoker: 'evocation_illager',
  vindicator: 'vindication_illager', illusioner: 'illusion_illager', zombified_piglin: 'zombie_pigman' };
const mobs = registries.entity_type
  .filter((id) => recipes.items[`${id}_spawn_egg`] || ['giant', 'illusioner'].includes(id))
  .map((id) => {
    const old = MOB_112[id] || id;
    return [id, lang[`entity.minecraft.${id}`] || id, MOB_SINCE[id] ?? (KNOWN_1214.has(id) ? 0 : 6),
      OLD_ENTITIES.has(old) ? old : ''];
  }).sort((a, b) => a[1].localeCompare(b[1]));

const data = { version, items, enchantments, effects, attributes, potions, mobs };
const out = join(SITE, 'commands', 'data.js');
writeFileSync(out, '// Generated by commands/tools/build-data.mjs, do not edit by hand.\n' +
  `window.CMD_DATA = ${JSON.stringify(data)};\n`);
console.log(`data.js: Minecraft ${version}, ${items.length} items, ${enchantments.length} enchantments, ` +
  `${effects.length} effects, ${attributes.length} attributes, ${potions.length} potions, ${mobs.length} mobs`);
