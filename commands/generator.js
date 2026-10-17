/* AmaiCraft : générateur de commandes (/give, /tellraw, /title).
   Les listes (items, enchantements, effets, attributs, potions) sont dans data.js,
   généré par tools/build-data.mjs depuis les fichiers du jeu. */
(function () {
  'use strict';

  const D = window.CMD_DATA;
  const ITEMS = new Map(D.items.map(([id, n, x, o]) => [id, { id, n, x, o }]));
  const ENCH = new Map(D.enchantments.map(([id, n, max, curse, since]) => [id, { id, n, max, curse, since }]));
  const EFFECTS = new Map(D.effects.map(([id, n, bad, num, since]) => [id, { id, n, bad, num, since }]));
  const ATTRS = new Map(D.attributes.map(([id, n, since, prefix]) => [id, { id, n, since, prefix }]));
  const POTIONS = new Map(D.potions.map(([id, n, since]) => [id, { id, n, since }]));
  const MOBS = new Map(D.mobs.map(([id, n, since, old]) => [id, { id, n, since, old }]));

  // Each bucket changes how the command is written. 0 and 1 use the old NBT tags,
  // 2 and up use item components.
  const VERSIONS = ['1.16 – 1.20.1', '1.20.2 – 1.20.4', '1.20.5 – 1.20.6', '1.21 – 1.21.1',
    '1.21.2 – 1.21.3', '1.21.4', `1.21.5 – ${D.version}`];
  const LATEST = VERSIONS.length - 1;
  const SINCE = ['1.16', '1.20.2', '1.20.5', '1.21', '1.21.2', '1.21.4', '1.21.5'];

  // 1.12.2 is v = -1: before the 1.13 "flattening", with numeric enchantment ids,
  // camelCase attributes and § color codes instead of JSON text
  const V112 = -1;
  const verLabel = (v) => (v === V112 ? '1.12.2' : VERSIONS[v]);
  const ENCH_112 = { protection: 0, fire_protection: 1, feather_falling: 2, blast_protection: 3,
    projectile_protection: 4, respiration: 5, aqua_affinity: 6, thorns: 7, depth_strider: 8, frost_walker: 9,
    binding_curse: 10, sharpness: 16, smite: 17, bane_of_arthropods: 18, knockback: 19, fire_aspect: 20,
    looting: 21, sweeping_edge: 22, efficiency: 32, silk_touch: 33, unbreaking: 34, fortune: 35, power: 48,
    punch: 49, flame: 50, infinity: 51, luck_of_the_sea: 61, lure: 62, mending: 70, vanishing_curse: 71 };
  const ATTR_112 = { max_health: 'maxHealth', follow_range: 'followRange', knockback_resistance: 'knockbackResistance',
    movement_speed: 'movementSpeed', flying_speed: 'flyingSpeed', attack_damage: 'attackDamage',
    attack_speed: 'attackSpeed', armor: 'armor', armor_toughness: 'armorToughness', luck: 'luck' };
  // when the things missing from 1.12.2 came out (the buckets above only start at 1.16)
  const ADDED = { impaling: '1.13', loyalty: '1.13', riptide: '1.13', channeling: '1.13', multishot: '1.14',
    piercing: '1.14', quick_charge: '1.14', soul_speed: '1.16', swift_sneak: '1.19', slow_falling: '1.13',
    long_slow_falling: '1.13', conduit_power: '1.13', dolphins_grace: '1.13', bad_omen: '1.14',
    hero_of_the_village: '1.14', darkness: '1.19', attack_knockback: '1.14', turtle_master: '1.13',
    long_turtle_master: '1.13', strong_turtle_master: '1.13' };
  const LEGACY_CODE = { black: '0', dark_blue: '1', dark_green: '2', dark_aqua: '3', dark_red: '4',
    dark_purple: '5', gold: '6', gray: '7', dark_gray: '8', blue: '9', green: 'a', aqua: 'b', red: 'c',
    light_purple: 'd', yellow: 'e', white: 'f' };

  const COLORS = {
    black: '#000000', dark_blue: '#0000AA', dark_green: '#00AA00', dark_aqua: '#00AAAA',
    dark_red: '#AA0000', dark_purple: '#AA00AA', gold: '#FFAA00', gray: '#AAAAAA',
    dark_gray: '#555555', blue: '#5555FF', green: '#55FF55', aqua: '#55FFFF',
    red: '#FF5555', light_purple: '#FF55FF', yellow: '#FFFF55', white: '#FFFFFF',
  };
  const RARITY = { common: 'white', uncommon: 'yellow', rare: 'aqua', epic: 'light_purple' };
  const SLOTS = [
    ['any', 'Any slot', 'When equipped:', 0], ['mainhand', 'Main hand', 'When in Main Hand:', 0],
    ['offhand', 'Off hand', 'When in Off Hand:', 0], ['head', 'Head', 'When on Head:', 0],
    ['chest', 'Chest', 'When on Body:', 0], ['legs', 'Legs', 'When on Legs:', 0],
    ['feet', 'Feet', 'When on Feet:', 0], ['hand', 'Either hand', 'When in Hand:', 2],
    ['armor', 'Any armor slot', 'When worn:', 2], ['body', 'Body (horse, wolf)', 'When equipped:', 2],
  ];
  const OPS = [['add_value', '+ Add'], ['add_multiplied_base', '+ % of base'], ['add_multiplied_total', '× % of total']];
  const FORMATS = [['b', 'B', 'Bold'], ['i', 'I', 'Italic'], ['u', 'U', 'Underlined'],
    ['s', 'S', 'Strikethrough'], ['o', 'O', 'Obfuscated (scrambled letters)']];
  // what "Other info" hides in 1.21.5+, where every tooltip part is hidden one by one
  const OTHER_TOOLTIP = ['potion_contents', 'stored_enchantments', 'trim', 'jukebox_playable',
    'fireworks', 'firework_explosion', 'banner_patterns', 'written_book_content'];
  const POTION_ITEMS = { potion: 'Potion of ', splash_potion: 'Splash Potion of ',
    lingering_potion: 'Lingering Potion of ', tipped_arrow: 'Arrow of ' };

  // ---------- état ----------
  const seg = (t = '', c = '', more) => Object.assign({ t, c, c2: '#FFFFFF', g: '', b: 0, i: 0, u: 0, s: 0, o: 0 }, more);
  const rid = () => Math.random().toString(36).slice(2, 7);
  const ruuid = () => Array.from({ length: 4 }, () => (Math.random() * 0x100000000) | 0);

  const freshGive = () => ({
    v: LATEST, target: '@p', item: 'diamond_sword', count: 1,
    name: [seg()], lore: [], ench: [], attr: [],
    unbreakable: false, glider: false, glint: '', rarity: '', stack: '', fire: false, model: '', dye: '',
    potion: { base: '', color: '', effects: [] },
    hide: { ench: false, attr: false, unb: false, dye: false, other: false, all: false },
  });
  const freshText = () => ({ target: '@a', kind: 'tellraw', line: [seg('Hello ', 'gold'), seg('world!', '', { g: 'rainbow', b: 1 })] });

  let st = freshGive();
  let tx = freshText();
  const freshMob = () => ({
    mode: 'spawner', target: '@p', mob: 'zombie', name: [seg()], showName: false,
    variant: '', health: '', scale: '', baby: false, noai: false, silent: false, glow: false, invul: false, persist: false, nograv: false,
    gear: { mainhand: '', head: '', chest: '', legs: '', feet: '' },
    sp: { count: '', nearby: '', range: '', area: '', min: '', max: '' },
  });
  let mb = freshMob();
  let tab = 'give';

  // ---------- petits outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    el.append(...kids.flat().filter((k) => k != null && k !== false));
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v);
    }
    return el;
  }
  function select(options, value, onchange, cls = 'cg-input') {
    const el = h('select', { class: cls }, options.map(([v, label, disabled]) => h('option', { value: v, text: label, disabled })));
    el.value = value;
    el.addEventListener('change', () => onchange(el.value));
    return el;
  }
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const clampInt = (v, lo, hi, def) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && String(v).trim() !== '' ? Math.min(hi, Math.max(lo, n)) : def;
  };
  const num = (v) => (String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const fmt = (n) => String(Math.round(n * 1000) / 1000);
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const roman = (n) => ROMAN[n] || String(n);
  const hexOf = (c, def) => (!c ? def : COLORS[c] || c.toUpperCase());
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const toHex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();
  const intColor = (hex) => parseInt(hex.slice(1), 16);
  const shade = (hex) => toHex(...rgb(hex).map((x) => x / 4));
  function hsl(hue) {
    const s = 1, l = 0.62, a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + hue / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return toHex(f(0), f(8), f(4));
  }
  const vanilla = (id) => !id.includes(':') || id.startsWith('minecraft:');
  const shortId = (id) => id.replace(/^minecraft:/, '');
  const iconUrl = (id) => {
    const it = ITEMS.get(shortId(id));
    return it && it.x ? `../recipecraft/assets/items/${it.id}.${it.x}` : '../assets/ui/command_block.png';
  };
  const itemName = (id) => (ITEMS.get(shortId(id)) || { n: id }).n;
  const isDyeable = (id) => /^leather_(helmet|chestplate|leggings|boots|horse_armor)$/.test(id) || id === 'wolf_armor';
  const isPotion = (id) => id in POTION_ITEMS;
  // items that shine in game without any enchantment
  const NATURAL_GLINT = new Set(['debug_stick', 'enchanted_golden_apple', 'enchanted_book', 'experience_bottle', 'nether_star', 'end_crystal']);
  // closest of the 16 chat colors, for versions without hex colors
  function nearest(hex) {
    if (COLORS[hex]) return hex;
    const [r, g, b] = rgb(hex);
    let best = 'white', dist = Infinity;
    for (const [name, h2] of Object.entries(COLORS)) {
      const [r2, g2, b2] = rgb(h2);
      const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
      if (d < dist) { dist = d; best = name; }
    }
    return best;
  }
  // '' when the enchantment, effect, attribute or potion exists in version v, otherwise
  // the first version that has it
  function need(kind, info, v = st.v) {
    if (v === V112) {
      const ok = kind === 'ench' ? info.id in ENCH_112 : kind === 'effect' ? info.num > 0 && info.num <= 27
        : kind === 'attr' ? info.id in ATTR_112 : info.since === 0 && !(info.id in ADDED);
      return ok ? '' : ADDED[info.id] || SINCE[info.since];
    }
    if (info.since <= v) return '';
    return info.since === LATEST ? 'newest' : SINCE[info.since];
  }
  // things added after 1.21.5 (spear, waypoints...) are only marked as "newest"
  const came = (n) => (n === 'newest' ? 'only in the newest versions' : n === 'later' ? 'added in a later version' : `needs ${n} or newer`);
  const missing = (n) => `Not in ${verLabel(st.v)}: ${came(n)}.`;
  const needTag = (n) => (!n ? '' : n === 'newest' ? ' (newest versions only)' : n === 'later' ? ' (not in 1.12.2)' : ` (needs ${n}+)`);
  function needMob(info, v = st.v) {
    if (v === V112) return info.old ? '' : 'later';
    if (info.since <= v) return '';
    return info.since === LATEST ? 'newest' : SINCE[info.since];
  }
  // signed 64-bit long from two 32-bit ints, for the UUIDMost / UUIDLeast of 1.12.2
  const long = (hi, lo) => BigInt.asIntN(64, (BigInt(hi) << 32n) | BigInt(lo >>> 0)).toString();
  function guessSlot(id) {
    if (/(_helmet|_skull|_head|carved_pumpkin)$/.test(id)) return 'head';
    if (/(_chestplate|^elytra)$/.test(id)) return 'chest';
    if (/_leggings$/.test(id)) return 'legs';
    if (/_boots$/.test(id)) return 'feet';
    if (/(horse_armor|wolf_armor)$/.test(id)) return 'body';
    if (id === 'shield' || id === 'totem_of_undying') return 'offhand';
    return 'mainhand';
  }

  // ---------- texte : modèle -> composant JSON / SNBT ----------
  // gradient and rainbow parts: one color per letter, spaces stick to the previous letter
  function colorRuns(s, defHex) {
    const chars = [...s.t];
    const visible = chars.filter((c) => c.trim()).length;
    const from = rgb(hexOf(s.c, defHex)), to = rgb(hexOf(s.c2, '#FFFFFF'));
    const runs = [];
    let k = 0;
    for (const ch of chars) {
      if (!ch.trim() && runs.length) { runs[runs.length - 1].text += ch; continue; }
      const t = visible > 1 ? k / (visible - 1) : 0;
      const color = s.g === 'rainbow' ? hsl((visible ? k / visible : 0) * 360)
        : toHex(...from.map((a, i) => a + (to[i] - a) * t));
      if (ch.trim()) k++;
      const last = runs[runs.length - 1];
      if (last && last.color === color) last.text += ch;
      else runs.push({ text: ch, color });
    }
    return runs;
  }

  function segParts(s, defHex) {
    const style = {};
    if (s.b) style.bold = true;
    if (s.i) style.italic = true;
    if (s.u) style.underlined = true;
    if (s.s) style.strikethrough = true;
    if (s.o) style.obfuscated = true;
    if (!s.g) return [Object.assign({ text: s.t }, s.c ? { color: COLORS[s.c] ? s.c : s.c.toUpperCase() } : {}, style)];
    const runs = colorRuns(s, defHex);
    if (runs.length === 1) return [Object.assign({ text: runs[0].text, color: runs[0].color }, style)];
    const letters = runs.map((r) => ({ text: r.text, color: r.color }));
    if (!Object.keys(style).length) return letters;
    return [Object.assign({ text: '' }, style, { extra: letters })];
  }

  // itemText: names and lore are italic by default in game, so the root turns it off
  function textComponent(segs, itemText, defHex) {
    const parts = segs.filter((s) => s.t !== '').flatMap((s) => segParts(s, defHex));
    if (!parts.length) return { text: '' };
    if (parts.length === 1) {
      const p = parts[0];
      if (itemText && !('italic' in p)) p.italic = false;
      return p;
    }
    return itemText ? { text: '', italic: false, extra: parts } : { text: '', extra: parts };
  }

  const q = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  const sq = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  function toSNBT(o) {
    if (Array.isArray(o)) return '[' + o.map(toSNBT).join(',') + ']';
    if (o && typeof o === 'object') return '{' + Object.entries(o).map(([k, v]) => k + ':' + toSNBT(v)).join(',') + '}';
    if (typeof o === 'string') return q(o);
    return String(o);
  }
  const hasText = (segs) => segs.some((s) => s.t !== '');
  const isStyled = (segs) => segs.some((s) => s.t && (s.c || s.g || s.b || s.i || s.u || s.s || s.o));

  // 1.12.2 item names and lore are plain text with § codes. A color code also cancels
  // bold, italic..., so each part starts with its color, then its styles. Without any
  // style the text is left as is (the game then shows it in italic, like in an anvil).
  function legacyText(segs, defName, defHex) {
    if (!isStyled(segs)) return segs.map((s) => s.t).join('');
    let out = '', prev = '';
    for (const s of segs) {
      if (!s.t) continue;
      const runs = s.g ? colorRuns(s, defHex) : [{ text: s.t, color: s.c }];
      const styles = (s.o ? '§k' : '') + (s.b ? '§l' : '') + (s.s ? '§m' : '') + (s.u ? '§n' : '') + (s.i ? '§o' : '');
      for (const r of runs) {
        const code = '§' + (r.color ? LEGACY_CODE[nearest(hexOf(r.color, defHex))] : defName) + styles;
        out += (code === prev ? '' : code) + r.text;
        prev = code;
      }
    }
    return out;
  }
  const usesHex = (segs) => segs.some((s) => s.t && (s.g || (s.c && !COLORS[s.c])));

  // JSON text for versions without hex colors (1.12.2): closest chat color instead
  function namedColors(o) {
    if (Array.isArray(o)) return o.map(namedColors);
    if (o && typeof o === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(o)) out[k] = k === 'color' && v.startsWith('#') ? nearest(v) : namedColors(v);
      return out;
    }
    return o;
  }

  // ---------- /give ----------
  function buildGive() {
    const v = st.v;
    const notes = [];
    const comp = v >= 2;
    const raw = (st.item || 'stone').trim().toLowerCase();
    const item = vanilla(raw) ? shortId(raw) : raw;
    const isBook = item === 'enchanted_book';
    const txt = (o) => (v >= 6 ? toSNBT(o) : sq(JSON.stringify(o)));
    const hide = st.hide;
    const old = v === V112;
    const tooNew = (what, needV) => notes.push(`${what} doesn't exist in ${verLabel(v)} (${came(needV)}), so it was left out.`);

    const name = hasText(st.name) ? textComponent(st.name, true, '#FFFFFF') : null;
    const lore = st.lore.map((line) => textComponent(line, true, COLORS.dark_purple));

    const encMap = new Map();
    for (const e of st.ench) {
      const info = ENCH.get(e.id);
      if (!info) continue;
      const nd = need('ench', info, v);
      if (nd) { tooNew(info.n, nd); continue; }
      encMap.set(e.id, clampInt(e.lvl, 1, 255, 1));
    }
    const encs = [...encMap];

    const mods = [];
    st.attr.forEach((a) => {
      const info = ATTRS.get(a.id);
      const amount = num(a.amt);
      if (!info || amount === null) return;
      const nd = need('attr', info, v);
      if (nd) { tooNew(info.n, nd); return; }
      let slot = a.slot;
      if (!comp && ['hand', 'armor', 'body'].includes(slot)) {
        notes.push(`The "${SLOTS.find((x) => x[0] === slot)[1]}" slot needs 1.20.5 or newer: ${info.n} applies to any slot instead.`);
        slot = 'any';
      }
      const op = OPS.findIndex((o) => o[0] === a.op);
      if (v >= 3) {
        const type = v >= 4 ? a.id : `${info.prefix}.${a.id}`;
        mods.push(`{type:"${type}",amount:${fmt(amount)},operation:"${a.op}"${slot !== 'any' ? `,slot:"${slot}"` : ''},id:"${a.r}"}`);
      } else if (v === 2) {
        mods.push(`{type:"${info.prefix}.${a.id}"${slot !== 'any' ? `,slot:"${slot}"` : ''},uuid:[I;${a.u.join(',')}],name:"${a.r}",amount:${fmt(amount)},operation:"${a.op}"}`);
      } else if (old) {
        mods.push(`{AttributeName:"generic.${ATTR_112[a.id]}",Name:"${a.r}",Amount:${fmt(amount)},Operation:${op},` +
          `UUIDMost:${long(a.u[0], a.u[1])}L,UUIDLeast:${long(a.u[2], a.u[3])}L${slot !== 'any' ? `,Slot:"${slot}"` : ''}}`);
      } else {
        mods.push(`{AttributeName:"generic.${a.id}",Name:"${a.r}",Amount:${fmt(amount)},Operation:${op},UUID:[I;${a.u.join(',')}]${slot !== 'any' ? `,Slot:"${slot}"` : ''}}`);
      }
    });
    if (mods.length) notes.push('Custom attributes replace the item\'s own ones (damage, attack speed, armor): add them back if you still want them.');

    const dye = isDyeable(item) && st.dye ? intColor(st.dye) : null;

    const pot = isPotion(item) ? st.potion : null;
    const effects = [];
    if (pot) {
      for (const e of pot.effects) {
        const info = EFFECTS.get(e.id);
        if (!info) continue;
        const nd = need('effect', info, v);
        if (nd) { tooNew(info.n, nd); continue; }
        const amp = clampInt(e.lvl, 1, 256, 1) - 1;
        // 1.12.2 has no infinite effects: the longest duration possible (about 3 years)
        const dur = e.inf ? (old ? 2147483647 : -1) : clampInt(e.dur, 1, 1e6, 30) * 20;
        if (comp) effects.push(`{id:"${e.id}",amplifier:${amp},duration:${dur}${e.hide ? ',show_particles:false,show_icon:false' : ''}}`);
        else {
          const byte = amp > 127 ? amp - 256 : amp;
          if (v === 1) effects.push(`{id:"${e.id}",amplifier:${byte}b,duration:${dur}${e.hide ? ',show_particles:0b,show_icon:0b' : ''}}`);
          else if (info.num > 0) effects.push(`{Id:${info.num}b,Amplifier:${byte}b,Duration:${dur}${e.hide ? ',ShowParticles:0b,ShowIcon:0b' : ''}}`);
          else tooNew(info.n, SINCE[2]);
        }
      }
      if (effects.some((e) => e.includes(':-1'))) {
        if (v === 0) notes.push('Infinite effects work from 1.19.4 only.');
      }
      if (old && pot.effects.some((e) => e.inf)) {
        notes.push('1.12.2 has no infinite effects: "Infinite" lasts about 3 years instead.');
      }
    }
    const potBase = pot && pot.base && POTIONS.get(pot.base) ? pot.base : '';
    const potNeed = potBase ? need('potion', POTIONS.get(potBase), v) : '';
    if (potNeed) tooNew(POTIONS.get(potBase).n, potNeed);
    const usePotBase = potBase && !potNeed;
    const potColor = pot && pot.color ? intColor(pot.color) : null;

    const model = st.model !== '' ? clampInt(st.model, -2147483648, 2147483647, null) : null;
    let count = clampInt(st.count, 1, 6400, 1);
    if (old && count > 64) { count = 64; notes.push('In 1.12.2, /give gives at most 64 items at once.'); }
    let out;

    if (comp) {
      const C = [];
      if (name) C.push('custom_name=' + txt(name));
      if (lore.length) C.push('lore=[' + lore.map(txt).join(',') + ']');
      if (encs.length) {
        const key = isBook ? 'stored_enchantments' : 'enchantments';
        const map = '{' + encs.map(([id, l]) => `${id}:${l}`).join(',') + '}';
        C.push(v >= 6 ? `${key}=${map}` : `${key}={levels:${map}${hide.ench ? ',show_in_tooltip:false' : ''}}`);
      }
      if (mods.length) {
        C.push(v >= 6 ? `attribute_modifiers=[${mods.join(',')}]`
          : `attribute_modifiers={modifiers:[${mods.join(',')}]${hide.attr ? ',show_in_tooltip:false' : ''}}`);
      } else if (hide.attr && v < 6 && !hide.all) {
        notes.push('In this version, "Hide attributes" only works on custom attributes: add one, or pick 1.21.5+.');
      }
      if (st.unbreakable) C.push(v >= 6 || !hide.unb ? 'unbreakable={}' : 'unbreakable={show_in_tooltip:false}');
      if (dye !== null) C.push(v >= 6 ? `dyed_color=${dye}` : `dyed_color={rgb:${dye}${hide.dye ? ',show_in_tooltip:false' : ''}}`);
      if (pot && (usePotBase || potColor !== null || effects.length)) {
        const p = [];
        if (usePotBase) p.push(`potion:"${potBase}"`);
        if (potColor !== null) p.push(`custom_color:${potColor}`);
        if (effects.length) p.push(`custom_effects:[${effects.join(',')}]`);
        C.push(`potion_contents={${p.join(',')}}`);
      }
      if (st.glint) C.push(`enchantment_glint_override=${st.glint === 'on'}`);
      if (st.rarity) C.push(`rarity="${st.rarity}"`);
      if (st.stack !== '') C.push(`max_stack_size=${clampInt(st.stack, 1, 99, 64)}`);
      if (st.fire) C.push(v >= 4 ? 'damage_resistant={types:"#is_fire"}' : 'fire_resistant={}');
      if (st.glider) {
        if (v >= 4) C.push('glider={}');
        else notes.push('Gliding like an elytra needs Minecraft 1.21.2 or newer, so it was left out.');
      }
      if (model !== null) C.push(v >= 5 ? `custom_model_data={floats:[${model}]}` : `custom_model_data=${model}`);
      if (v >= 6) {
        if (hide.all) C.push('tooltip_display={hide_tooltip:true}');
        else {
          const hidden = [];
          if (hide.ench) hidden.push(isBook ? 'stored_enchantments' : 'enchantments');
          if (hide.attr) hidden.push('attribute_modifiers');
          if (hide.unb) hidden.push('unbreakable');
          if (hide.dye) hidden.push('dyed_color');
          if (hide.other) hidden.push(...OTHER_TOOLTIP.filter((c) => !hidden.includes(c)));
          if (hidden.length) C.push(`tooltip_display={hidden_components:[${hidden.map((c) => `"${c}"`).join(',')}]}`);
        }
      } else {
        if (hide.all) C.push('hide_tooltip={}');
        else if (hide.other) C.push('hide_additional_tooltip={}');
      }
      out = `/give ${st.target} ${item}${C.length ? `[${C.join(',')}]` : ''}`;
    } else {
      const T = [];
      const display = [];
      if (old) {
        if (name) display.push('Name:' + q(legacyText(st.name, 'r', '#FFFFFF')));
        if (lore.length) display.push('Lore:[' + st.lore.map((l) => q(legacyText(l, '5', COLORS.dark_purple))).join(',') + ']');
      } else {
        if (name) display.push('Name:' + txt(name));
        if (lore.length) display.push('Lore:[' + lore.map(txt).join(',') + ']');
      }
      if (dye !== null) display.push(`color:${dye}`);
      if (display.length) T.push(`display:{${display.join(',')}}`);
      let flags = 0;
      if (old) {
        // numeric ids; a fake empty enchantment gives the shine, its tooltip line is hidden
        if (encs.length) T.push(`${isBook ? 'StoredEnchantments' : 'ench'}:[${encs.map(([id, l]) => `{id:${ENCH_112[id]}s,lvl:${l}s}`).join(',')}]`);
        else if (st.glint === 'on') { T.push('ench:[{}]'); flags |= 1; }
      } else if (encs.length) T.push(`${isBook ? 'StoredEnchantments' : 'Enchantments'}:[${encs.map(([id, l]) => `{id:"${id}",lvl:${l}s}`).join(',')}]`);
      else if (st.glint === 'on') T.push('Enchantments:[{}]');
      if (st.glint === 'off') notes.push('"Never glowing" needs 1.20.5 or newer.');
      if (mods.length) T.push(`AttributeModifiers:[${mods.join(',')}]`);
      if (st.unbreakable) T.push('Unbreakable:1b');
      if (usePotBase) T.push(`Potion:"${potBase}"`);
      if (potColor !== null) T.push(`CustomPotionColor:${potColor}`);
      if (effects.length) T.push(`${v === 1 ? 'custom_potion_effects' : 'CustomPotionEffects'}:[${effects.join(',')}]`);
      if (model !== null) {
        if (old) notes.push('Custom model data needs 1.14 or newer, so it was left out.');
        else T.push(`CustomModelData:${model}`);
      }
      if (hide.all) flags = old ? 63 : 255;
      else {
        if (hide.ench) flags |= 1;
        if (hide.attr) flags |= 2;
        if (hide.unb) flags |= 4;
        if (hide.other) flags |= 32;
        if (hide.dye) {
          if (old) notes.push('Hiding the leather color needs 1.16.2 or newer.');
          else flags |= 64;
        }
      }
      if (flags) T.push(`HideFlags:${flags}`);
      if (st.glider) notes.push('Gliding like an elytra needs Minecraft 1.21.2 or newer, so it was left out.');
      if (st.rarity || st.stack !== '' || st.fire) notes.push('Rarity, max stack size and fire resistance need 1.20.5 or newer, so they were left out.');
      if (old) {
        // 1.12.2: /give <player> <item> [count] [data value] [nbt]
        out = `/give ${st.target} ${item}` + (T.length ? ` ${count} 0 {${T.join(',')}}` : count > 1 ? ` ${count}` : '');
        if (isStyled(st.name) || st.lore.some(isStyled)) {
          notes.unshift('1.12.2 deletes the § sign typed in chat and in command blocks, so the colors and styles only work from a function file (.mcfunction) or a server plugin.');
          if (usesHex(st.name) || st.lore.some(usesHex)) notes.push('1.12.2 only has the 16 chat colors: gradients and custom colors use the closest ones.');
        }
        if (vanilla(raw) && ITEMS.has(item) && !ITEMS.get(item).o) notes.unshift(`${itemName(item)} doesn't exist in 1.12.2 with this id (many items were renamed in 1.13).`);
      } else out = `/give ${st.target} ${item}${T.length ? `{${T.join(',')}}` : ''}`;
    }
    if (count > 1 && !old) out += ' ' + count;
    if (out.length > 256) notes.unshift(`This command has ${out.length} characters, the chat only takes 256: paste it in a command block instead.`);
    return { cmd: out, notes };
  }

  function buildText() {
    let obj = textComponent(tx.line, false, '#FFFFFF');
    if (st.v === V112) obj = namedColors(obj);
    const t = st.v >= 6 ? toSNBT(obj) : JSON.stringify(obj);
    const cmd = tx.kind === 'tellraw' ? `/tellraw ${tx.target} ${t}` : `/title ${tx.target} ${tx.kind} ${t}`;
    const notes = [];
    if (st.v === V112 && usesHex(tx.line)) notes.push('1.12.2 only has the 16 chat colors: gradients and custom colors use the closest ones.');
    if (cmd.length > 256) notes.push(`This command has ${cmd.length} characters, the chat only takes 256: paste it in a command block instead.`);
    if (tx.kind !== 'tellraw') notes.push('Titles stay about 3.5 seconds. Change it with /title @a times 10 70 20 (fade in, stay, fade out, in ticks).');
    return { cmd, notes };
  }

  // ---------- aperçu ----------
  function mcSpan(text, hex, s) {
    if (st.v === V112) hex = COLORS[nearest(hex)];
    const sp = h('span', { text });
    const dark = shade(hex);
    sp.style.color = hex;
    sp.style.textShadow = s.b ? `2px 0 0 ${hex}, 2px 2px 0 ${dark}, 4px 2px 0 ${dark}` : `2px 2px 0 ${dark}`;
    if (s.b) sp.style.letterSpacing = '2px';
    if (s.i) sp.style.fontStyle = 'italic';
    const deco = [s.u && 'underline', s.s && 'line-through'].filter(Boolean).join(' ');
    if (deco) sp.style.textDecoration = deco;
    if (s.o) { sp.classList.add('cg-obf'); sp.dataset.t = text; }
    return sp;
  }
  // italic: 1.12.2 shows names and lore without any style in italic
  function renderSegs(segs, defHex, italic) {
    const line = h('div', { class: 'cg-tip-line' });
    for (const s of segs) {
      if (!s.t) continue;
      const runs = s.g ? colorRuns(s, defHex) : [{ text: s.t, color: hexOf(s.c, defHex) }];
      for (const r of runs) line.append(mcSpan(r.text, r.color, italic ? Object.assign({}, s, { i: 1 }) : s));
    }
    if (!line.childNodes.length) line.append(' ');
    return line;
  }
  const plainLine = (text, color) => renderSegs([seg(text, color)], '#FFFFFF');

  function renderPreview() {
    const v = st.v;
    const item = shortId((st.item || 'stone').toLowerCase());
    const tip = $('#cg-tip');
    tip.replaceChildren();
    const icon = $('#cg-icon');
    icon.src = iconUrl(item);
    const real = st.ench.some((e) => ENCH.has(e.id) && !need('ench', ENCH.get(e.id)));
    const glint = st.glint === 'on' || (st.glint !== 'off' && (real || NATURAL_GLINT.has(item)));
    const slot = $('#cg-preview-slot');
    slot.classList.toggle('is-glint', glint);
    slot.style.setProperty('--icon', `url("${icon.src}")`);
    $('#cg-count-badge').textContent = clampInt(st.count, 1, 6400, 1) > 1 ? clampInt(st.count, 1, 6400, 1) : '';

    if (st.hide.all) {
      tip.append(h('div', { class: 'cg-tip-none', text: 'The tooltip is hidden: nothing shows when you hover the item.' }));
      return;
    }
    const enchanted = real && item !== 'enchanted_book';
    const rarity = v >= 2 && st.rarity ? st.rarity : (enchanted ? 'rare' : '');
    const nameHex = COLORS[RARITY[rarity] || 'white'];
    if (hasText(st.name)) tip.append(renderSegs(st.name, nameHex, v === V112 && !isStyled(st.name)));
    else {
      let n = itemName(item);
      if (isPotion(item) && st.potion.base && POTIONS.has(st.potion.base)) {
        const pn = POTIONS.get(st.potion.base).n;
        n = pn.startsWith('Potion of ') ? POTION_ITEMS[item] + pn.slice(10) : pn;
      }
      tip.append(plainLine(n, RARITY[rarity] || 'white'));
    }

    if (isPotion(item) && !(st.hide.other)) {
      const list = st.potion.effects.filter((e) => EFFECTS.has(e.id) && !need('effect', EFFECTS.get(e.id)));
      if (!list.length && !st.potion.base) tip.append(plainLine('No Effects', 'gray'));
      for (const e of list) {
        const info = EFFECTS.get(e.id);
        const lvl = clampInt(e.lvl, 1, 256, 1);
        const secs = clampInt(e.dur, 1, 1e6, 30);
        const time = e.inf ? '∞' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        tip.append(plainLine(`${info.n}${lvl > 1 ? ' ' + roman(lvl) : ''} (${time})`, info.bad ? 'red' : 'blue'));
      }
    }
    if (!st.hide.ench) {
      for (const e of st.ench) {
        const info = ENCH.get(e.id);
        if (!info || need('ench', info)) continue;
        const lvl = clampInt(e.lvl, 1, 255, 1);
        tip.append(plainLine(info.n + (info.max === 1 && lvl === 1 ? '' : ' ' + roman(lvl)), info.curse ? 'red' : 'gray'));
      }
    }
    if (isDyeable(item) && st.dye && !st.hide.dye && !st.hide.other && v < 6) tip.append(plainLine('Dyed', 'gray'));
    for (const line of st.lore) tip.append(renderSegs(line, COLORS.dark_purple, v === V112 && !isStyled(line)));

    if (!st.hide.attr) {
      const bySlot = new Map();
      for (const a of st.attr) {
        const info = ATTRS.get(a.id);
        const amount = num(a.amt);
        if (!info || amount === null || amount === 0 || need('attr', info)) continue;
        if (!bySlot.has(a.slot)) bySlot.set(a.slot, []);
        bySlot.get(a.slot).push([info, amount, a.op]);
      }
      for (const [slotId, list] of bySlot) {
        tip.append(plainLine('', 'gray'), plainLine(SLOTS.find((x) => x[0] === slotId)[2], 'gray'));
        for (const [info, amount, op] of list) {
          const value = op === 'add_value' ? fmt(Math.abs(amount)) : fmt(Math.abs(amount) * 100) + '%';
          tip.append(plainLine(`${amount > 0 ? '+' : '-'}${value} ${info.n}`, amount > 0 ? 'blue' : 'red'));
        }
      }
    }
    if (st.unbreakable && !st.hide.unb) tip.append(plainLine('Unbreakable', 'blue'));
  }

  function renderTextPreview() {
    const screen = $('#tx-screen');
    screen.className = 'cg-screen is-' + tx.kind;
    const box = $('#tx-out');
    box.replaceChildren(renderSegs(tx.line, '#FFFFFF'));
  }

  // letters of obfuscated text keep changing, like in game
  const OBF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&?!';
  setInterval(() => {
    document.querySelectorAll('.cg-obf').forEach((sp) => {
      sp.textContent = [...sp.dataset.t].map((c) => (c.trim() ? OBF[(Math.random() * OBF.length) | 0] : c)).join('');
    });
  }, 70);

  // ---------- éditeur de texte (nom, lore, tellraw) ----------
  const pop = h('div', { class: 'cg-pop', hidden: true, role: 'dialog', 'aria-label': 'Text color' });
  let popAnchor = null;
  function paintSwatch(el, s, defHex) {
    el.classList.toggle('is-default', !s.c && !s.g);
    el.style.background = s.g === 'rainbow' ? 'linear-gradient(90deg,#f55,#fa0,#ff5,#5f5,#5ff,#55f,#f5f)'
      : s.g === 'grad' ? `linear-gradient(90deg, ${hexOf(s.c, defHex)}, ${hexOf(s.c2, '#FFFFFF')})`
        : hexOf(s.c, defHex);
  }
  function closePop() { pop.hidden = true; popAnchor = null; }
  function openColor(anchor, s, defHex, changed) {
    if (popAnchor === anchor) { closePop(); return; }
    popAnchor = anchor;
    const redraw = () => openColorBody(s, defHex, () => { changed(); redraw(); });
    redraw();
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - w - 8)) + 'px';
    pop.style.top = window.scrollY + r.bottom + 6 + 'px';
  }
  function openColorBody(s, defHex, changed) {
    const modeBtn = (g, label) => h('button', { type: 'button', class: 'cg-mode', text: label, 'aria-pressed': String(s.g === g),
      onclick: () => { s.g = g; changed(); } });
    const pal = h('div', { class: 'cg-pal' },
      h('button', { type: 'button', class: 'cg-pal-sw is-default', title: 'Default color', 'aria-pressed': String(!s.c),
        style: `background:${defHex}`, onclick: () => { s.c = ''; changed(); } }),
      Object.entries(COLORS).map(([name, hex]) => h('button', { type: 'button', class: 'cg-pal-sw', title: name.replace('_', ' '),
        'aria-pressed': String(s.c === name), style: `background:${hex}`, onclick: () => { s.c = name; changed(); } })));
    const custom = h('input', { type: 'color', value: hexOf(s.c, defHex).toLowerCase(), 'aria-label': 'Custom color' });
    custom.addEventListener('input', () => { s.c = custom.value.toUpperCase(); changed(); });
    const body = [
      h('div', { class: 'cg-modes' }, modeBtn('', 'Solid'), modeBtn('grad', 'Gradient'), modeBtn('rainbow', 'Rainbow')),
    ];
    if (s.g !== 'rainbow') {
      body.push(h('p', { class: 'cg-pop-label', text: s.g === 'grad' ? 'From' : 'Color' }), pal,
        h('label', { class: 'cg-pop-custom' }, custom, h('span', { text: 'Any color (hex): ' + hexOf(s.c, defHex) })));
    }
    if (s.g === 'grad') {
      const to = h('input', { type: 'color', value: hexOf(s.c2, '#FFFFFF').toLowerCase(), 'aria-label': 'Gradient end color' });
      to.addEventListener('input', () => { s.c2 = to.value.toUpperCase(); changed(); });
      const toPal = h('div', { class: 'cg-pal' }, Object.entries(COLORS).map(([name, hex]) => h('button', { type: 'button', class: 'cg-pal-sw',
        title: name.replace('_', ' '), 'aria-pressed': String(hexOf(s.c2, '') === hex), style: `background:${hex}`,
        onclick: () => { s.c2 = hex; changed(); } })));
      body.push(h('p', { class: 'cg-pop-label', text: 'To' }), toPal, h('label', { class: 'cg-pop-custom' }, to, h('span', { text: 'Any color (hex): ' + hexOf(s.c2, '#FFFFFF') })));
    }
    if (s.g) body.push(h('p', { class: 'cg-pop-note', text: 'Each letter gets its own color, so the command gets longer.' }));
    // keep focus on the same control after a redraw
    const focused = document.activeElement && pop.contains(document.activeElement) ? [...pop.querySelectorAll('button,input')].indexOf(document.activeElement) : -1;
    pop.replaceChildren(...body);
    if (focused >= 0) { const again = pop.querySelectorAll('button,input')[focused]; if (again && again.type !== 'color') again.focus(); }
  }
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== popAnchor) closePop(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { const a = popAnchor; closePop(); a && a.focus(); } });

  function textEditor(segs, opts) {
    const wrap = h('div', { class: 'cg-text' });
    const draw = (focusLast) => {
      wrap.replaceChildren();
      segs.forEach((s, i) => {
        const input = h('input', { class: 'cg-input', type: 'text', value: s.t, placeholder: i ? 'More text' : opts.placeholder,
          'aria-label': i ? `Text part ${i + 1}` : opts.label, spellcheck: false });
        input.addEventListener('input', () => { s.t = input.value; opts.onChange(); });
        const sw = h('button', { type: 'button', class: 'cg-swatch', title: 'Color, gradient or rainbow', 'aria-label': 'Color' });
        paintSwatch(sw, s, opts.def);
        sw.addEventListener('click', (e) => { e.stopPropagation(); openColor(sw, s, opts.def, () => { paintSwatch(sw, s, opts.def); opts.onChange(); }); });
        const fmts = h('div', { class: 'cg-fmt' }, FORMATS.map(([k, label, title]) => {
          const b = h('button', { type: 'button', class: 'cg-fmt-' + k, text: label, title, 'aria-label': title, 'aria-pressed': String(!!s[k]) });
          b.addEventListener('click', () => { s[k] = s[k] ? 0 : 1; b.setAttribute('aria-pressed', String(!!s[k])); opts.onChange(); });
          return b;
        }));
        const row = h('div', { class: 'cg-seg' }, input, sw, fmts);
        if (segs.length > 1) row.append(h('button', { type: 'button', class: 'cg-x', text: '×', title: 'Remove this part', 'aria-label': 'Remove this part',
          onclick: () => { segs.splice(i, 1); draw(); opts.onChange(); } }));
        wrap.append(row);
      });
      wrap.append(h('button', { type: 'button', class: 'cg-add', text: '+ Add a part with another style',
        onclick: () => { segs.push(seg('', segs[segs.length - 1].c)); draw(true); opts.onChange(); } }));
      if (focusLast) wrap.querySelectorAll('.cg-seg input')[segs.length - 1].focus();
    };
    draw();
    return wrap;
  }

  // ---------- éditeur /give ----------
  function itemPicker() {
    const box = $('#cg-item');
    const img = h('img', { alt: '', onerror: () => { img.src = '../assets/ui/command_block.png'; } });
    const input = h('input', { class: 'cg-input', id: 'cg-item-input', type: 'text', autocomplete: 'off', spellcheck: false,
      placeholder: 'Search: sword, potion, elytra...', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'cg-item-list' });
    const list = h('div', { class: 'cg-list', id: 'cg-item-list', role: 'listbox', hidden: true });
    box.append(h('span', { class: 'cg-slot cg-slot-small' }, img), h('div', { class: 'cg-combo' }, input, list));
    let matches = [], active = 0;
    const show = () => {
      const qy = norm(input.value).replace(/^minecraft:/, '');
      const starts = [], has = [];
      for (const it of ITEMS.values()) {
        const n = norm(it.n);
        if (!qy || n.startsWith(qy) || it.id.startsWith(qy.replace(/ /g, '_'))) starts.push(it);
        else if (n.includes(qy) || it.id.includes(qy.replace(/ /g, '_'))) has.push(it);
      }
      matches = starts.concat(has).slice(0, 80).map((it) => it.id);
      if (/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(qy) && !qy.startsWith('minecraft:')) matches.unshift(qy);
      active = 0;
      list.replaceChildren(...matches.map((id, i) => h('div', { class: 'cg-opt', role: 'option', id: 'cg-opt-' + i, 'aria-selected': String(i === 0),
        onmousedown: (e) => { e.preventDefault(); choose(id); } },
      h('img', { src: iconUrl(id), alt: '', loading: 'lazy', onerror: (e) => { e.target.style.visibility = 'hidden'; } }),
      h('span', { text: ITEMS.has(id) ? itemName(id) : 'Modded item' }), h('small', { text: id + (st.v === V112 && ITEMS.has(id) && !ITEMS.get(id).o ? ' · not in 1.12.2' : '') }))));
      if (!matches.length) list.append(h('div', { class: 'cg-opt-empty', text: 'No item found. You can also type a full id like create:wrench.' }));
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };
    const hide = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.value = itemName(st.item); };
    const move = (d) => {
      if (!matches.length) return;
      list.children[active].setAttribute('aria-selected', 'false');
      active = (active + d + matches.length) % matches.length;
      const el = list.children[active];
      el.setAttribute('aria-selected', 'true');
      el.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', el.id);
    };
    function choose(id) {
      const before = st.item;
      st.item = id;
      hide();
      input.blur();
      setItem();
      // armor gets its slot right away
      if (before !== id) st.attr.forEach((a) => { if (a.slot === guessSlot(before)) a.slot = guessSlot(id); });
      renderAttr();
      update();
    }
    input.addEventListener('focus', () => { input.select(); show(); });
    input.addEventListener('input', show);
    input.addEventListener('blur', () => setTimeout(hide, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) choose(matches[active]); }
      else if (e.key === 'Escape') { hide(); }
    });
    function setItem() { img.src = iconUrl(st.item); input.value = itemName(st.item); }
    return setItem;
  }

  function addPicker(placeholder, options, onpick) {
    const el = select([['', placeholder]].concat(options), '', (v) => { if (v) { onpick(v); el.value = ''; } }, 'cg-input cg-adder');
    return el;
  }

  function renderEnch() {
    const box = $('#cg-ench');
    box.replaceChildren();
    st.ench.forEach((e, i) => {
      const info = ENCH.get(e.id);
      if (!info) return;
      const lvl = h('input', { class: 'cg-input cg-num', type: 'number', min: 1, max: 255, value: e.lvl, 'aria-label': info.n + ' level' });
      lvl.addEventListener('input', () => { e.lvl = lvl.value; update(); });
      const set = (n) => { e.lvl = n; lvl.value = n; update(); };
      const nd = need('ench', info);
      box.append(h('div', { class: 'cg-row' + (nd ? ' is-off' : '') },
        h('span', { class: 'cg-row-name' + (info.curse ? ' is-curse' : ''), text: info.n }),
        h('label', { class: 'cg-mini' }, 'Level', lvl),
        h('button', { type: 'button', class: 'cg-chip', text: 'Max ' + roman(info.max), onclick: () => set(info.max) }),
        h('button', { type: 'button', class: 'cg-chip', text: '255', title: 'The highest level the game accepts', onclick: () => set(255) }),
        h('button', { type: 'button', class: 'cg-x', text: '×', 'aria-label': 'Remove ' + info.n, onclick: () => { st.ench.splice(i, 1); renderEnch(); update(); } }),
        nd ? h('span', { class: 'cg-need', text: missing(nd) }) : null));
    });
    const used = new Set(st.ench.map((e) => e.id));
    box.append(h('div', { class: 'cg-adders' },
      addPicker('+ Add an enchantment', D.enchantments.filter(([id]) => !used.has(id)).map(([id, n]) =>
        [id, n + needTag(need('ench', ENCH.get(id)))]), (id) => { st.ench.push({ id, lvl: ENCH.get(id).max }); renderEnch(); update(); }),
      st.ench.length ? h('button', { type: 'button', class: 'cg-chip', text: 'All to 255', onclick: () => { st.ench.forEach((e) => { e.lvl = 255; }); renderEnch(); update(); } }) : null));
  }

  const ATTR_DEFAULT = { attack_damage: 10, max_health: 20, movement_speed: 0.05, armor: 10, armor_toughness: 5,
    attack_speed: 4, scale: 1, knockback_resistance: 1, step_height: 1, jump_strength: 0.5, luck: 10 };
  function renderAttr() {
    const box = $('#cg-attr');
    box.replaceChildren();
    st.attr.forEach((a, i) => {
      const info = ATTRS.get(a.id);
      if (!info) return;
      const amt = h('input', { class: 'cg-input cg-num', type: 'number', step: 'any', value: a.amt, 'aria-label': info.n + ' amount' });
      amt.addEventListener('input', () => { a.amt = amt.value; update(); });
      const nd = need('attr', info);
      box.append(h('div', { class: 'cg-row cg-row-attr' + (nd ? ' is-off' : '') },
        h('span', { class: 'cg-row-name', text: info.n }),
        h('label', { class: 'cg-mini' }, 'Amount', amt),
        select(OPS.map(([v, l]) => [v, l]), a.op, (v) => { a.op = v; update(); }),
        select(SLOTS.map(([v, l, , since]) => [v, l + (since > st.v ? ' (1.20.5+)' : '')]), a.slot, (v) => { a.slot = v; update(); }),
        h('button', { type: 'button', class: 'cg-x', text: '×', 'aria-label': 'Remove ' + info.n, onclick: () => { st.attr.splice(i, 1); renderAttr(); update(); } }),
        nd ? h('span', { class: 'cg-need', text: missing(nd) }) : null));
    });
    box.append(h('div', { class: 'cg-adders' }, addPicker('+ Add an attribute', D.attributes.map(([id, n]) =>
      [id, n + needTag(need('attr', ATTRS.get(id)))]), (id) => {
      st.attr.push({ id, amt: ATTR_DEFAULT[id] ?? 1, op: 'add_value', slot: guessSlot(st.item), r: 'a' + rid(), u: ruuid() });
      renderAttr(); update();
    })));
  }

  function renderPotion() {
    const box = $('#cg-potion-body');
    box.replaceChildren();
    const p = st.potion;
    const color = h('input', { type: 'color', value: (p.color || '#FFAA00').toLowerCase(), 'aria-label': 'Potion color' });
    color.addEventListener('input', () => { p.color = color.value.toUpperCase(); colorOn.checked = true; update(); });
    const colorOn = h('input', { type: 'checkbox', checked: !!p.color });
    colorOn.addEventListener('change', () => { p.color = colorOn.checked ? color.value.toUpperCase() : ''; update(); });
    box.append(h('div', { class: 'cg-grid2' },
      h('label', { class: 'cg-field' }, h('span', { text: 'Base potion' }),
        select([['', 'None (only custom effects)']].concat(D.potions.map(([id, n]) => [id, n + needTag(need('potion', POTIONS.get(id)))])),
          p.base, (v) => { p.base = v; update(); })),
      h('div', { class: 'cg-field' }, h('span', { text: 'Liquid color' }),
        h('div', { class: 'cg-inline' }, h('label', { class: 'cg-check' }, colorOn, h('span', { text: 'Custom' })), color))));
    p.effects.forEach((e, i) => {
      const info = EFFECTS.get(e.id);
      if (!info) return;
      const lvl = h('input', { class: 'cg-input cg-num', type: 'number', min: 1, max: 256, value: e.lvl, 'aria-label': info.n + ' level' });
      lvl.addEventListener('input', () => { e.lvl = lvl.value; update(); });
      const dur = h('input', { class: 'cg-input cg-num', type: 'number', min: 1, value: e.dur, disabled: !!e.inf, 'aria-label': info.n + ' duration in seconds' });
      dur.addEventListener('input', () => { e.dur = dur.value; update(); });
      const inf = h('input', { type: 'checkbox', checked: !!e.inf });
      inf.addEventListener('change', () => { e.inf = inf.checked; dur.disabled = inf.checked; update(); });
      const hid = h('input', { type: 'checkbox', checked: !!e.hide });
      hid.addEventListener('change', () => { e.hide = hid.checked; update(); });
      const nd = need('effect', info);
      box.append(h('div', { class: 'cg-row cg-row-effect' + (nd ? ' is-off' : '') },
        h('span', { class: 'cg-row-name' + (info.bad ? ' is-curse' : ''), text: info.n }),
        h('label', { class: 'cg-mini' }, 'Level', lvl),
        h('label', { class: 'cg-mini' }, 'Seconds', dur),
        h('label', { class: 'cg-check' }, inf, h('span', { text: 'Infinite' })),
        h('label', { class: 'cg-check' }, hid, h('span', { text: 'No particles' })),
        h('button', { type: 'button', class: 'cg-x', text: '×', 'aria-label': 'Remove ' + info.n, onclick: () => { p.effects.splice(i, 1); renderPotion(); update(); } }),
        nd ? h('span', { class: 'cg-need', text: missing(nd) }) : null));
    });
    box.append(h('div', { class: 'cg-adders' }, addPicker('+ Add an effect', D.effects.map(([id, n]) =>
      [id, n + needTag(need('effect', EFFECTS.get(id)))]), (id) => {
      p.effects.push({ id, lvl: 1, dur: 60, inf: false, hide: false }); renderPotion(); update();
    })));
  }

  function renderLore() {
    const box = $('#cg-lore');
    box.replaceChildren();
    st.lore.forEach((line, i) => {
      box.append(h('div', { class: 'cg-lore-line' },
        h('div', { class: 'cg-lore-head' }, h('span', { text: 'Line ' + (i + 1) }),
          h('button', { type: 'button', class: 'cg-x', text: '×', 'aria-label': 'Remove line ' + (i + 1), onclick: () => { st.lore.splice(i, 1); renderLore(); update(); } })),
        textEditor(line, { def: COLORS.dark_purple, placeholder: 'A line of description', label: 'Lore line ' + (i + 1), onChange: update })));
    });
    box.append(h('button', { type: 'button', class: 'cg-add', text: '+ Add a lore line', onclick: () => {
      const last = st.lore[st.lore.length - 1];
      st.lore.push([seg('', last ? last[0].c : 'gray')]);
      renderLore(); update();
      const inputs = box.querySelectorAll('.cg-lore-line:last-of-type .cg-seg input');
      if (inputs.length) inputs[0].focus();
    } }));
  }

  let setItemDisplay = () => {};
  function renderGive() {
    $('#cg-name').replaceChildren(textEditor(st.name, { def: '#FFFFFF', placeholder: 'Leave empty to keep the normal name', label: 'Item name', onChange: update }));
    setItemDisplay();
    renderLore();
    renderEnch();
    renderAttr();
    renderPotion();
    $('#cg-target').value = ['@p', '@s', '@a', '@r'].includes(st.target) ? st.target : 'name';
    $('#cg-player').value = ['@p', '@s', '@a', '@r'].includes(st.target) ? '' : st.target;
    $('#cg-count').value = st.count;
    $('#cg-dye').value = (st.dye || '#A06540').toLowerCase();
    $('#cg-unbreakable').checked = st.unbreakable;
    $('#cg-glint').value = st.glint;
    $('#cg-rarity').value = st.rarity;
    $('#cg-stack').value = st.stack;
    $('#cg-fire').checked = st.fire;
    $('#cg-glider').checked = st.glider;
    $('#cg-model').value = st.model;
    document.querySelectorAll('[data-hide]').forEach((c) => { c.checked = !!st.hide[c.dataset.hide]; });
    applyVersion();
  }

  function applyVersion() {
    $('#cg-version').value = st.v;
    document.querySelectorAll('[data-since]').forEach((el) => {
      const off = st.v < Number(el.dataset.since);
      const needV = el.dataset.need || SINCE[el.dataset.since];
      el.classList.toggle('is-off', off);
      // says why the option is greyed out, not just "1.20.5+"
      const tag = el.querySelector('em');
      if (tag) {
        tag.textContent = off ? missing(needV) : needV + '+';
        tag.classList.toggle('cg-need', off);
      }
      el.querySelectorAll('input,select').forEach((c) => { c.disabled = off; });
    });
    $('#cg-glint').querySelector('[value="off"]').disabled = st.v < 2;
    $('#cg-player').hidden = $('#cg-target').value !== 'name';
  }


  // ---------- mobs : spawner, /summon, œuf ----------
  const GEAR = [['mainhand', 'Main hand'], ['head', 'Head'], ['chest', 'Chest'], ['legs', 'Legs'], ['feet', 'Feet']];
  // [field, NBT tag, label, default, max]
  const SPAWNER = [['count', 'SpawnCount', 'Mobs per spawn', 4, 100], ['nearby', 'MaxNearbyEntities', 'Max mobs around it', 6, 1000],
    ['range', 'RequiredPlayerRange', 'Works when a player is within', 16, 1000], ['area', 'SpawnRange', 'Spawn area', 4, 100]];
  // colors of the mobs that have some, by the number of their Variant tag
  const VARIANTS = { axolotl: ['Pink (Lucy)', 'Brown (Wild)', 'Gold', 'Cyan', 'Blue (the rare one)'] };
  const eggOf = (id) => (ITEMS.has(id + '_spawn_egg') ? id + '_spawn_egg' : 'pig_spawn_egg');
  const mobIcon = (id) => iconUrl(ITEMS.has(id + '_spawn_egg') ? id + '_spawn_egg' : 'spawner');

  function buildMob() {
    const v = st.v, old = v === V112, notes = [];
    const info = MOBS.get(mb.mob);
    const nd = needMob(info);
    if (nd) notes.unshift(`The ${info.n} doesn't exist in ${verLabel(v)} (${came(nd)}): the game will refuse this command.`);
    const eid = old ? info.old || info.id : info.id;
    const T = [];
    if (hasText(mb.name)) {
      if (old) {
        T.push('CustomName:' + q(legacyText(mb.name, 'f', '#FFFFFF')));
        if (isStyled(mb.name)) notes.push('1.12.2 deletes the § sign typed in chat and in command blocks, so the name colors only work from a function file (.mcfunction) or a server plugin.');
      } else {
        const obj = textComponent(mb.name, false, '#FFFFFF');
        T.push('CustomName:' + (v >= 6 ? toSNBT(obj) : sq(JSON.stringify(obj))));
      }
      if (mb.showName) T.push('CustomNameVisible:1b');
    }
    const health = num(mb.health), scale = num(mb.scale);
    const attrs = [];
    if (health !== null && health > 0) {
      const hp = Math.min(1024, health);
      T.push(`Health:${fmt(hp)}f`);
      attrs.push(['max_health', 'maxHealth', hp]);
    }
    if (scale !== null && scale > 0 && scale !== 1) {
      if (v >= 2) attrs.push(['scale', '', Math.min(16, Math.max(0.0625, scale))]);
      else notes.push(`Changing the size doesn't exist in ${verLabel(v)} (needs 1.20.5 or newer), so it was left out.`);
    }
    if (attrs.length) {
      if (v >= 4) T.push(`attributes:[${attrs.map(([id, , b]) => `{id:"${id}",base:${fmt(b)}}`).join(',')}]`);
      else if (v >= 2) T.push(`attributes:[${attrs.map(([id, , b]) => `{id:"generic.${id}",base:${fmt(b)}}`).join(',')}]`);
      else T.push(`Attributes:[${attrs.map(([id, o, b]) => `{Name:"generic.${old ? o : id}",Base:${fmt(b)}}`).join(',')}]`);
    }
    // IsBaby for zombies and the like, Age for animals: each mob ignores the other one
    if (VARIANTS[info.id] && mb.variant !== '') T.push(`Variant:${clampInt(mb.variant, 0, VARIANTS[info.id].length - 1, 0)}`);
    if (mb.baby) T.push('IsBaby:1b', 'Age:-2147483648');
    if (mb.noai) T.push('NoAI:1b');
    if (mb.silent) T.push('Silent:1b');
    if (mb.glow) T.push('Glowing:1b');
    if (mb.invul) T.push('Invulnerable:1b');
    if (mb.persist) T.push('PersistenceRequired:1b');
    if (mb.nograv) T.push('NoGravity:1b');

    const gear = {};
    for (const [slot] of GEAR) {
      const raw = (mb.gear[slot] || '').trim().toLowerCase();
      if (!raw) continue;
      const id = vanilla(raw) ? shortId(raw) : raw;
      gear[slot] = id;
      if (old && ITEMS.has(id) && !ITEMS.get(id).o) notes.push(`${itemName(id)} doesn't exist in 1.12.2 with this id.`);
    }
    const stack = (id) => (v >= 6 ? `{id:"${id}"}` : v >= 2 ? `{id:"${id}",count:1}` : `{id:"${id}",Count:1b}`);
    if (Object.keys(gear).length) {
      if (v >= 6) T.push(`equipment:{${Object.entries(gear).map(([k, id]) => `${k}:${stack(id)}`).join(',')}}`);
      else {
        if (gear.mainhand) T.push(`HandItems:[${stack(gear.mainhand)},{}]`);
        if (gear.head || gear.chest || gear.legs || gear.feet) {
          T.push(`ArmorItems:[${['feet', 'legs', 'chest', 'head'].map((k) => (gear[k] ? stack(gear[k]) : '{}')).join(',')}]`);
        }
      }
    }

    const entity = `{id:"${eid}"${T.length ? ',' + T.join(',') : ''}}`;
    let cmd;
    if (mb.mode === 'summon') {
      cmd = `/summon ${eid} ~ ~ ~${T.length ? ` {${T.join(',')}}` : ''}`;
    } else if (mb.mode === 'egg') {
      const egg = eggOf(info.id);
      if (old) cmd = `/give ${mb.target} spawn_egg 1 0 {EntityTag:${entity}}`;
      else if (v >= 2) cmd = `/give ${mb.target} ${egg}[entity_data=${entity}]`;
      else cmd = `/give ${mb.target} ${egg}{EntityTag:${entity}}`;
    } else {
      const S = [old ? `SpawnData:${entity}` : `SpawnData:{entity:${entity}}`];
      for (const [k, tag, , , max] of SPAWNER) {
        if (mb.sp[k] !== '') S.push(`${tag}:${clampInt(mb.sp[k], k === 'nearby' ? 0 : 1, max, 1)}s`);
      }
      // the wait is random between both, so they always go together
      if (mb.sp.min !== '' || mb.sp.max !== '') {
        let lo = mb.sp.min !== '' ? clampInt(mb.sp.min, 0, 1600, 10) * 20 : 200;
        let hi = mb.sp.max !== '' ? clampInt(mb.sp.max, 0, 1600, 40) * 20 : 800;
        if (lo > hi) [lo, hi] = [hi, lo];
        S.push(`MinSpawnDelay:${lo}s`, `MaxSpawnDelay:${Math.max(hi, 1)}s`, `Delay:${lo}s`);
      }
      if (old) cmd = `/give ${mb.target} mob_spawner 1 0 {BlockEntityTag:{${S.join(',')}}}`;
      else if (v >= 2) cmd = `/give ${mb.target} spawner[block_entity_data={id:"mob_spawner",${S.join(',')}}]`;
      else cmd = `/give ${mb.target} spawner{BlockEntityTag:{${S.join(',')}}}`;
      if (v === 0) notes.push('This spawner uses the 1.18+ format: in 1.16 and 1.17 it would stay a pig spawner.');
      notes.push('Place the spawner in Creative mode or as an operator, otherwise it turns back into a pig spawner.');
    }
    if (Object.keys(gear).length) notes.push('Only mobs that can hold items show them (zombies, skeletons, piglins...). Any block works on the head.');
    if (cmd.length > 256) notes.unshift(`This command has ${cmd.length} characters, the chat only takes 256: paste it in a command block instead.`);
    return { cmd, notes };
  }

  function renderMobPreview() {
    const info = MOBS.get(mb.mob);
    $('#mb-icon').src = mb.mode === 'spawner' ? iconUrl('spawner') : mobIcon(info.id);
    $('#mb-mob-icon').src = mobIcon(info.id);
    const tip = $('#mb-tip');
    tip.replaceChildren(hasText(mb.name) ? renderSegs(mb.name, '#FFFFFF') : plainLine(info.n, 'white'));
    const line = (t, c = 'gray') => tip.append(plainLine(t, c));
    line(mb.mode === 'spawner' ? 'Spawner' : mb.mode === 'egg' ? 'Spawn egg' : 'Spawns right where you stand', 'dark_gray');
    if (hasText(mb.name)) line(info.n + (mb.showName ? ', name always shown' : ''));
    if (VARIANTS[info.id] && mb.variant !== '') line(`Color: ${VARIANTS[info.id][mb.variant]}`, 'light_purple');
    const health = num(mb.health), scale = num(mb.scale);
    if (health) line(`Health: ${fmt(Math.min(1024, health))} (${fmt(Math.min(1024, health) / 2)} hearts)`, 'red');
    if (scale && scale !== 1 && st.v >= 2) line(`Size: ×${fmt(scale)}`, 'aqua');
    const flags = [['baby', 'Baby'], ['noai', 'Frozen'], ['silent', 'Silent'], ['glow', 'Glowing'], ['invul', 'Invulnerable'],
      ['persist', 'Never despawns'], ['nograv', 'No gravity']].filter(([k]) => mb[k]).map(([, l]) => l);
    if (flags.length) line(flags.join(', '), 'blue');
    for (const [slot, label] of GEAR) {
      const id = (mb.gear[slot] || '').trim();
      if (id) line(`${label}: ${itemName(id)}`, 'gold');
    }
    if (mb.mode === 'spawner') {
      const n = mb.sp.count || 4, lo = Number(mb.sp.min || 10), hi = Number(mb.sp.max || 40);
      line(`${n} at a time, every ${Math.min(lo, hi)} to ${Math.max(lo, hi)} s`, 'green');
      line(`Stops at ${mb.sp.nearby || 6} around, works within ${mb.sp.range || 16} blocks`, 'green');
    }
  }

  function renderMob() {
    const sel = $('#mb-mob');
    sel.replaceChildren(...D.mobs.map(([id, n]) => h('option', { value: id, text: n + needTag(needMob(MOBS.get(id))) })));
    sel.value = mb.mob;
    $('#mb-name').replaceChildren(textEditor(mb.name, { def: '#FFFFFF', placeholder: 'Leave empty for no name', label: 'Mob name', onChange: update }));
    document.querySelectorAll('input[name="mb-mode"]').forEach((r) => { r.checked = r.value === mb.mode; });
    $('#mb-target').value = ['@p', '@s', '@a', '@r'].includes(mb.target) ? mb.target : 'name';
    $('#mb-player').value = $('#mb-target').value === 'name' ? mb.target : '';
    $('#mb-player').hidden = $('#mb-target').value !== 'name';
    document.querySelectorAll('[data-mb]').forEach((c) => {
      const [group, key] = c.dataset.mb.includes('.') ? c.dataset.mb.split('.') : [null, c.dataset.mb];
      const obj = group ? mb[group] : mb;
      if (c.type === 'checkbox') c.checked = !!obj[key]; else c.value = obj[key];
    });
  }

  const MOB_PRESETS = [
    { icon: 'zombie_spawn_egg', name: 'Zombie King', mb: { mode: 'summon', mob: 'zombie', name: [seg('Zombie King', 'dark_red', { b: 1 })], showName: true,
      health: 200, scale: 2, persist: true, gear: { mainhand: 'netherite_sword', head: 'golden_helmet', chest: 'netherite_chestplate' } } },
    { icon: 'spawner', name: 'Fast Spawner', mb: { mode: 'spawner', mob: 'zombie',
      sp: { count: 8, nearby: 30, range: 32, area: 6, min: 1, max: 5 } } },
    { icon: 'villager_spawn_egg', name: 'Statue', mb: { mode: 'summon', mob: 'villager', name: [seg('Statue', 'gray')], showName: true,
      noai: true, silent: true, invul: true, persist: true } },
    { icon: 'axolotl_bucket', name: 'Blue Axolotl', mb: { mode: 'egg', mob: 'axolotl', variant: '4' } },
    { icon: 'creeper_spawn_egg', name: 'Tiny Creeper', mb: { mode: 'egg', mob: 'creeper', name: [seg('Tiny Creeper', 'green')], scale: 0.3, glow: true } },
    { icon: 'zombie_spawn_egg', name: 'Giant', mb: { mode: 'egg', mob: 'giant', name: [seg('Giant', 'gold', { b: 1 })], showName: true, health: 300, persist: true } },
  ];
  function applyMobPreset(p) {
    keep('mob', `${p.name} replaced your mob.`);
    const target = mb.target;
    mb = sanitizeMob(JSON.parse(JSON.stringify(p.mb)));
    mb.target = target;
    renderMob();
    showUndo();
    update();
  }

  // ---------- sortie ----------
  function showOut(prefix, res) {
    const out = $(`#${prefix}-cmd`);
    out.textContent = res.cmd;
    $(`#${prefix}-len`).textContent = res.cmd.length + ' characters';
    $(`#${prefix}-len`).classList.toggle('is-long', res.cmd.length > 256);
    $(`#${prefix}-notes`).replaceChildren(...res.notes.map((n) => h('li', { text: n })));
  }

  let last = { give: '', text: '', mob: '' };
  function update() {
    const item = shortId((st.item || '').toLowerCase());
    $('#cg-potion').hidden = !isPotion(item);
    $('#cg-dye-box').hidden = !isDyeable(item);
    const g = buildGive();
    last.give = g.cmd;
    showOut('cg', g);
    renderPreview();
    const t = buildText();
    last.text = t.cmd;
    showOut('tx', t);
    renderTextPreview();
    $('#mb-spawner-box').hidden = mb.mode !== 'spawner';
    $('#mb-target-box').hidden = mb.mode === 'summon';
    $('#mb-variant-box').hidden = !VARIANTS[mb.mob];
    const m = buildMob();
    last.mob = m.cmd;
    showOut('mb', m);
    renderMobPreview();
    save();
  }

  // ---------- sauvegarde, lien de partage ----------
  const KEY = 'amaicraft-commands';
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ give: st, text: tx, mob: mb, tab, undo })); } catch (e) { /* stockage bloqué */ }
  }
  const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  const fixSegs = (segs) => (Array.isArray(segs) && segs.length ? segs.map((s) => seg(String(s.t ?? ''), s.c || '', s)) : [seg()]);
  function sanitize(g) {
    const base = freshGive();
    const out = Object.assign(base, g);
    out.v = clampInt(out.v, V112, LATEST, LATEST);
    out.hide = Object.assign(freshGive().hide, g.hide);
    out.potion = Object.assign(freshGive().potion, g.potion);
    out.name = fixSegs(out.name);
    out.lore = Array.isArray(out.lore) ? out.lore.map(fixSegs) : [];
    out.ench = Array.isArray(out.ench) ? out.ench.filter((e) => ENCH.has(e.id)) : [];
    out.attr = Array.isArray(out.attr) ? out.attr.filter((a) => ATTRS.has(a.id)).map((a) => Object.assign({ op: 'add_value', slot: 'mainhand', r: 'a' + rid(), u: ruuid() }, a)) : [];
    out.potion.effects = Array.isArray(out.potion.effects) ? out.potion.effects.filter((e) => EFFECTS.has(e.id)) : [];
    return out;
  }
  function sanitizeMob(m) {
    const out = Object.assign(freshMob(), m);
    if (!MOBS.has(out.mob)) out.mob = 'zombie';
    out.name = fixSegs(out.name);
    out.gear = Object.assign(freshMob().gear, m.gear);
    out.sp = Object.assign(freshMob().sp, m.sp);
    return out;
  }
  const sanitizeText = (t) => Object.assign(freshText(), t, { line: fixSegs(t.line) });
  function load() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) {
        if (saved.give) st = sanitize(saved.give);
        if (saved.text) tx = sanitizeText(saved.text);
        if (saved.mob) mb = sanitizeMob(saved.mob);
        if (saved.tab) tab = saved.tab;
        if (saved.undo && saved.undo.data) undo = saved.undo;
      }
    } catch (e) { /* rien de sauvegardé */ }
    // a shared link replaces what this visitor had: that stays one click away (Undo),
    // and the link leaves the address bar so a refresh doesn't wipe the edits made since
    const m = location.hash.match(/^#([gtm])=(.+)$/);
    if (!m) return;
    try {
      const data = JSON.parse(unb64(m[2]));
      if (m[1] === 'g') { keep('give', 'You opened a shared item: yours was replaced.'); st = sanitize(data); tab = 'give'; }
      else if (m[1] === 'm') { keep('mob', 'You opened a shared mob: yours was replaced.'); mb = sanitizeMob(data); if (Number.isInteger(data.v)) st.v = clampInt(data.v, V112, LATEST, LATEST); tab = 'mob'; }
      else { tx = sanitizeText(data); if (Number.isInteger(data.v)) st.v = clampInt(data.v, V112, LATEST, LATEST); tab = 'text'; }
    } catch (e) { /* lien abîmé : on ignore */ }
    history.replaceState(null, '', location.pathname + location.search);
  }

  // ---------- annuler ----------
  // "Start over", presets and shared links replace everything. The previous version is
  // kept (in localStorage too, so it survives a refresh) and an Undo bar stays visible
  // until it is used or closed. Ctrl+Z works as well.
  let undo = null;
  const isBlank = (where) => (where === 'mob'
    ? JSON.stringify(Object.assign({}, mb, { target: '' })) === JSON.stringify(Object.assign(freshMob(), { target: '' }))
    : JSON.stringify(Object.assign({}, st, { v: 0, target: '' })) === JSON.stringify(Object.assign(freshGive(), { v: 0, target: '' })));
  function keep(where, msg) {
    if (isBlank(where)) return;
    undo = { tab: where, msg, data: JSON.parse(JSON.stringify(where === 'mob' ? mb : st)) };
  }
  function doUndo() {
    if (!undo) return;
    const u = undo;
    // undoing can itself be undone
    undo = null;
    keep(u.tab, `Your previous ${u.tab === 'mob' ? 'mob' : 'item'} is back.`);
    if (u.tab === 'mob') { mb = sanitizeMob(u.data); renderMob(); }
    else { st = sanitize(u.data); renderGive(); }
    showTab(u.tab);
    showUndo();
    update();
    say('Your previous ' + (u.tab === 'mob' ? 'mob' : 'item') + ' is back');
  }
  function showUndo() {
    for (const [where, prefix] of [['give', 'cg'], ['mob', 'mb']]) {
      const bar = $(`#${prefix}-undo`);
      const on = !!undo && undo.tab === where;
      bar.hidden = !on;
      if (on) bar.querySelector('span').textContent = undo.msg;
    }
  }

  const toast = $('#copyToast');
  let toastTimer;
  function say(msg) {
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2000);
  }
  function copy(text, msg) {
    const done = () => say(msg);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback(text, done));
    else fallback(text, done);
  }
  function fallback(text, done) {
    const ta = h('textarea', { value: text, style: 'position:fixed;opacity:0' });
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { say('Select the command and copy it by hand'); }
    ta.remove();
  }

  // ---------- préréglages ----------
  const S = (t, c = '', more) => seg(t, c, more);
  const PRESETS = [
    { icon: 'netherite_sword', name: 'God Sword', st: { item: 'netherite_sword',
      name: [S('God Sword', 'gold', { g: 'grad', c2: '#FFFF55', b: 1 })], lore: [[S('Forged by Amai in the Nether.', 'gray')]],
      ench: [['sharpness', 255], ['fire_aspect', 10], ['looting', 10], ['sweeping_edge', 10], ['knockback', 3]], unbreakable: true, rarity: 'epic' } },
    { icon: 'stick', name: 'Knockback Stick', st: { item: 'stick', name: [S('Knockback Stick', 'aqua', { b: 1 })],
      lore: [[S('Bonk.', 'gray', { i: 1 })]], ench: [['knockback', 255]] } },
    { icon: 'diamond_sword', name: 'Rainbow Blade', st: { item: 'diamond_sword', name: [S('Rainbow Blade', '', { g: 'rainbow', b: 1 })],
      lore: [[S('Every color, ', 'gray'), S('one', 'light_purple', { u: 1 }), S(' sword.', 'gray')]], ench: [['sharpness', 10], ['unbreaking', 10]] } },
    { icon: 'trident', name: "Zeus' Trident", st: { item: 'trident', name: [S("Zeus' Trident", 'yellow', { b: 1 })],
      lore: [[S('Throw it during a storm.', 'aqua', { i: 1 })]], ench: [['channeling', 1], ['loyalty', 10], ['impaling', 255]], unbreakable: true } },
    { icon: 'bow', name: 'Sniper Bow', st: { item: 'bow', name: [S('Sniper Bow', 'dark_green', { b: 1 })],
      lore: [[S('One shot, ', 'gray'), S('one kill', 'red')]], ench: [['power', 255], ['punch', 10], ['flame', 1], ['infinity', 1]], unbreakable: true } },
    { icon: 'leather_boots', name: 'Speed Boots', st: { item: 'leather_boots', name: [S('Speed Boots', 'aqua', { g: 'grad', c2: '#5555FF' })], dye: '#55FFFF',
      attr: [['movement_speed', 0.1, 'add_value', 'feet'], ['armor', 3, 'add_value', 'feet']], ench: [['feather_falling', 255]], unbreakable: true } },
    // boots that work like an elytra: jump, then jump again in the air. Low gravity makes the
    // glide last, and they cancel fall damage. Rockets still give the speed.
    { icon: 'netherite_boots', name: 'Flight Boots', st: { item: 'netherite_boots',
      name: [S('Flight Boots', 'aqua', { g: 'grad', c2: '#FFFFFF', b: 1 })],
      lore: [[S('Jump, then jump again in the air to fly.', 'gray')], [S('No fall damage.', 'gray', { i: 1 })]],
      glider: true, unbreakable: true, rarity: 'epic',
      attr: [['armor', 20, 'add_value', 'feet'], ['armor_toughness', 20, 'add_value', 'feet'], ['knockback_resistance', 1, 'add_value', 'feet'],
        ['gravity', -0.6, 'add_multiplied_base', 'feet'], ['fall_damage_multiplier', -1, 'add_multiplied_base', 'feet']],
      ench: [['protection', 10], ['feather_falling', 10]] } },
    { icon: 'netherite_chestplate', name: 'Tank Chestplate', st: { item: 'netherite_chestplate', name: [S('Tank Chestplate', 'dark_red', { b: 1 })],
      attr: [['max_health', 20, 'add_value', 'chest'], ['armor', 20, 'add_value', 'chest'], ['knockback_resistance', 1, 'add_value', 'chest']],
      ench: [['protection', 10]], rarity: 'epic' } },
    { icon: 'potion', name: 'Potion of the Gods', st: { item: 'potion', name: [S('Potion of the Gods', 'gold', { g: 'grad', c2: '#FF55FF' })],
      potion: { base: '', color: '#FFAA00', effects: [['strength', 5], ['regeneration', 3], ['resistance', 4], ['speed', 3], ['fire_resistance', 1], ['night_vision', 1]] } } },
    { icon: 'mace', name: 'Mace of Doom', st: { item: 'mace', name: [S('Mace of ', 'dark_purple'), S('Doom', 'dark_red', { b: 1 })],
      ench: [['density', 255], ['breach', 4], ['wind_burst', 3]], unbreakable: true } },
    { icon: 'paper', name: 'Mystery Item', st: { item: 'paper', name: [S('Mystery Item', 'light_purple', { o: 1 })],
      lore: [[S('Nobody knows what this does.', 'dark_gray', { i: 1 })]], glint: 'on' } },
  ];
  function applyPreset(p) {
    keep('give', `${p.name} replaced your item.`);
    const g = Object.assign(freshGive(), JSON.parse(JSON.stringify(p.st)));
    g.v = st.v;
    g.target = st.target;
    g.name = p.st.name.map((s) => seg(s.t, s.c, s));
    g.lore = (p.st.lore || []).map((line) => line.map((s) => seg(s.t, s.c, s)));
    g.ench = (p.st.ench || []).map(([id, lvl]) => ({ id, lvl }));
    g.attr = (p.st.attr || []).map(([id, amt, op, slot]) => ({ id, amt, op, slot, r: 'a' + rid(), u: ruuid() }));
    g.potion = Object.assign(freshGive().potion, p.st.potion || {});
    g.potion.effects = ((p.st.potion || {}).effects || []).map(([id, lvl]) => ({ id, lvl, dur: 60, inf: true, hide: true }));
    st = g;
    renderGive();
    update();
    showUndo();
  }

  // ---------- onglets ----------
  function showTab(name) {
    tab = name;
    document.querySelectorAll('.cg-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.cg-panel').forEach((p) => { p.hidden = p.id !== 'tab-' + name; });
    $('#cg-mobilebar').hidden = name === 'quick';
    save();
  }

  // ---------- démarrage ----------
  function init() {
    document.body.append(pop);
    load();

    $('#cg-version').replaceChildren(...VERSIONS.map((label, i) => h('option', { value: i, text: label + (i === LATEST ? ' (latest)' : '') })).reverse(),
      h('option', { value: V112, text: '1.12.2 (modded classic)' }));
    $('#cg-version').addEventListener('change', (e) => { st.v = Number(e.target.value); renderGive(); renderMob(); update(); });

    $('#cg-presets').append(...PRESETS.map((p) => h('button', { type: 'button', class: 'cg-preset', onclick: () => applyPreset(p) },
      h('img', { src: iconUrl(p.icon), alt: '' }), h('span', { text: p.name }))));

    setItemDisplay = itemPicker();

    const target = $('#cg-target'), player = $('#cg-player');
    target.addEventListener('change', () => {
      player.hidden = target.value !== 'name';
      st.target = target.value === 'name' ? (player.value.trim() || '@p') : target.value;
      if (target.value === 'name') player.focus();
      update();
    });
    player.addEventListener('input', () => { st.target = player.value.trim().replace(/\s+/g, '') || '@p'; update(); });
    $('#cg-count').addEventListener('input', (e) => { st.count = e.target.value; update(); });
    $('#cg-dye').addEventListener('input', (e) => { st.dye = e.target.value.toUpperCase(); update(); });
    $('#cg-dye-clear').addEventListener('click', () => { st.dye = ''; update(); });
    $('#cg-unbreakable').addEventListener('change', (e) => { st.unbreakable = e.target.checked; update(); });
    $('#cg-glint').addEventListener('change', (e) => { st.glint = e.target.value; update(); });
    $('#cg-rarity').addEventListener('change', (e) => { st.rarity = e.target.value; update(); });
    $('#cg-stack').addEventListener('input', (e) => { st.stack = e.target.value; update(); });
    $('#cg-fire').addEventListener('change', (e) => { st.fire = e.target.checked; update(); });
    $('#cg-glider').addEventListener('change', (e) => { st.glider = e.target.checked; update(); });
    $('#cg-model').addEventListener('input', (e) => { st.model = e.target.value; update(); });
    document.querySelectorAll('[data-hide]').forEach((c) => c.addEventListener('change', () => { st.hide[c.dataset.hide] = c.checked; update(); }));

    $('#cg-copy').addEventListener('click', () => copy(last.give, 'Command copied!'));
    $('#tx-copy').addEventListener('click', () => copy(last.text, 'Command copied!'));
    $('#cg-mobile-copy').addEventListener('click', () => copy(last[tab] || last.give, 'Command copied!'));
    $('#cg-share').addEventListener('click', () => copy(location.origin + location.pathname + '#g=' + b64(JSON.stringify(st)), 'Share link copied!'));
    $('#tx-share').addEventListener('click', () => copy(location.origin + location.pathname + '#t=' + b64(JSON.stringify(Object.assign({ v: st.v }, tx))), 'Share link copied!'));
    $('#cg-reset').addEventListener('click', () => {
      keep('give', 'Started over: your item was cleared.');
      const v = st.v, target = st.target;
      st = Object.assign(freshGive(), { v, target });
      renderGive(); showUndo(); update();
    });
    $('#mb-reset').addEventListener('click', () => {
      keep('mob', 'Started over: your mob was cleared.');
      mb = Object.assign(freshMob(), { mode: mb.mode, target: mb.target });
      renderMob(); showUndo(); update();
    });
    document.querySelectorAll('.cg-undo-btn').forEach((b) => b.addEventListener('click', doUndo));
    document.querySelectorAll('.cg-undo-close').forEach((b) => b.addEventListener('click', () => { undo = null; showUndo(); save(); }));
    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing && undo && undo.tab === tab) {
        e.preventDefault();
        doUndo();
      }
    });

    // mobs
    $('#mb-presets').append(...MOB_PRESETS.map((p) => h('button', { type: 'button', class: 'cg-preset', onclick: () => applyMobPreset(p) },
      h('img', { src: iconUrl(p.icon), alt: '' }), h('span', { text: p.name }))));
    $('#mb-tab-icon').src = iconUrl('spawner');
    $('#mb-items').append(...D.items.map(([id, n]) => h('option', { value: id, label: n })));
    $('#mb-mob').addEventListener('change', (e) => { mb.mob = e.target.value; update(); });
    document.querySelectorAll('input[name="mb-mode"]').forEach((r) => r.addEventListener('change', () => { mb.mode = r.value; update(); }));
    const mbTarget = $('#mb-target'), mbPlayer = $('#mb-player');
    mbTarget.addEventListener('change', () => {
      mbPlayer.hidden = mbTarget.value !== 'name';
      mb.target = mbTarget.value === 'name' ? (mbPlayer.value.trim() || '@p') : mbTarget.value;
      update();
    });
    mbPlayer.addEventListener('input', () => { mb.target = mbPlayer.value.trim().replace(/\s+/g, '') || '@p'; update(); });
    document.querySelectorAll('[data-mb]').forEach((c) => c.addEventListener(c.type === 'checkbox' ? 'change' : 'input', () => {
      const [group, key] = c.dataset.mb.includes('.') ? c.dataset.mb.split('.') : [null, c.dataset.mb];
      (group ? mb[group] : mb)[key] = c.type === 'checkbox' ? c.checked : c.value;
      update();
    }));
    $('#mb-copy').addEventListener('click', () => copy(last.mob, 'Command copied!'));
    $('#mb-share').addEventListener('click', () => copy(location.origin + location.pathname + '#m=' + b64(JSON.stringify(Object.assign({ v: st.v }, mb))), 'Share link copied!'));

    // /tellraw et /title
    $('#tx-editor').append(textEditor(tx.line, { def: '#FFFFFF', placeholder: 'Your message', label: 'Message', onChange: update }));
    const txTarget = $('#tx-target'), txPlayer = $('#tx-player');
    txTarget.value = ['@a', '@p', '@s', '@r'].includes(tx.target) ? tx.target : 'name';
    txPlayer.value = txTarget.value === 'name' ? tx.target : '';
    txPlayer.hidden = txTarget.value !== 'name';
    txTarget.addEventListener('change', () => {
      txPlayer.hidden = txTarget.value !== 'name';
      tx.target = txTarget.value === 'name' ? (txPlayer.value.trim() || '@a') : txTarget.value;
      update();
    });
    txPlayer.addEventListener('input', () => { tx.target = txPlayer.value.trim().replace(/\s+/g, '') || '@a'; update(); });
    document.querySelectorAll('input[name="tx-kind"]').forEach((r) => {
      r.checked = r.value === tx.kind;
      r.addEventListener('change', () => { tx.kind = r.value; update(); });
    });

    document.querySelectorAll('.cg-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
    document.querySelectorAll('.command-item').forEach((el) => {
      const run = () => copy(el.dataset.cmd, 'Command copied!');
      el.addEventListener('click', run);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } });
    });

    renderGive();
    renderMob();
    showTab(tab);
    showUndo();
    update();
  }

  init();
})();
