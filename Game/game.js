/* Bedrock Bound : le jeu de minage d'AmaiCraft.
   Monde en tuiles de 16 px vu de côté. Les textures, les créatures et les sons sont générés
   au chargement ; seules les icônes d'objets viennent de recipecraft/assets/items. */
(() => {
'use strict';

// ---------- CONSTANTES ----------
const TS = 16, VW = 400, VH = 225;
const W = 48, H = 318, SURF = 12;
const DEEPSLATE_Y = 126, OBSIDIAN_Y = 214, NETHER_Y = 222, BASALT_Y = 296;
const CORE_X = 24, CORE_Y = 305, BEDROCK_Y = 313;
const SPAWN_X = 14.2;
const GRAV = 36, REACH = 3.6;
const SAVE_KEY = 'bedrockbound_save_v1';
const ICONS = '../recipecraft/assets/items/';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const rnd = (a, b) => a + Math.random() * (b - a);
const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};

// ---------- HASARD ET BRUIT ----------
function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function hash2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.28 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.12;

// ---------- OBJETS ----------
const ITEMS = {
    coal:      { name: 'Coal', value: 2, icon: 'coal.webp' },
    copper:    { name: 'Raw Copper', value: 3, icon: 'raw_copper.webp' },
    iron:      { name: 'Raw Iron', value: 6, icon: 'raw_iron.png' },
    lapis:     { name: 'Lapis Lazuli', value: 8, icon: 'lapis_lazuli.png' },
    redstone:  { name: 'Redstone', value: 9, icon: 'redstone.png' },
    gold:      { name: 'Raw Gold', value: 15, icon: 'raw_gold.png' },
    amethyst:  { name: 'Amethyst Shard', value: 12, icon: 'amethyst_shard.png' },
    diamond:   { name: 'Diamond', value: 40, icon: 'diamond.webp' },
    quartz:    { name: 'Nether Quartz', value: 10, icon: 'nether_quartz.webp' },
    nugget:    { name: 'Gold Nugget', value: 7, icon: 'gold_nugget.webp' },
    glowdust:  { name: 'Glowstone Dust', value: 8, icon: 'glowstone_dust.png' },
    gunpowder: { name: 'Gunpowder', value: 6, icon: 'gunpowder.png' },
    cream:     { name: 'Magma Cream', value: 9, icon: 'magma_cream.png' },
    debris:    { name: 'Ancient Debris', value: 0, icon: 'ancient_debris.png', keep: true },
};

const PICKS = [
    { name: 'Wooden Pickaxe', icon: 'wooden_pickaxe.png', tier: 1, speed: 1, cost: 0, dmg: 2 },
    { name: 'Stone Pickaxe', icon: 'stone_pickaxe.png', tier: 2, speed: 1.5, cost: 30, dmg: 3, desc: 'Mines copper, iron and lapis.' },
    { name: 'Iron Pickaxe', icon: 'iron_pickaxe.png', tier: 3, speed: 2.2, cost: 160, dmg: 4, desc: 'Mines gold, redstone, diamonds and emeralds.' },
    { name: 'Diamond Pickaxe', icon: 'diamond_pickaxe.png', tier: 4, speed: 3.2, cost: 750, dmg: 5, desc: 'Breaks obsidian and ancient debris.' },
    { name: 'Netherite Pickaxe', icon: 'netherite_pickaxe.png', tier: 5, speed: 4.6, cost: 2400, debris: 4, dmg: 7, desc: 'Breaks reinforced deepslate. Needs 4 Ancient Debris.' },
];
const PACKS = [
    { name: 'Pouch', size: 10, cost: 0 },
    { name: 'Satchel', size: 18, cost: 50 },
    { name: 'Bundle', size: 28, cost: 220 },
    { name: 'Big Bundle', size: 42, cost: 700 },
    { name: 'Miner\'s Pack', size: 64, cost: 1600 },
];
const LANTERNS = [
    { name: 'Candle', level: 7, cost: 0 },
    { name: 'Lantern', level: 9, cost: 40 },
    { name: 'Bright Lantern', level: 11, cost: 250 },
    { name: 'Beacon Lamp', level: 13, cost: 900 },
];
const ARMORS = [
    { name: 'No Armor', hp: 20, cost: 0, icon: 'leather_chestplate.png' },
    { name: 'Leather Tunic', hp: 26, cost: 60, icon: 'leather_chestplate.png' },
    { name: 'Iron Chestplate', hp: 32, cost: 300, icon: 'iron_chestplate.png' },
    { name: 'Diamond Chestplate', hp: 40, cost: 1100, icon: 'diamond_chestplate.png' },
];
const SUPPLIES = [
    { id: 'ladder', name: 'Ladders', icon: 'ladder.webp', amount: 8, cost: 4, max: 99, key: 'L', desc: 'Climb back up. Auto-placed while climbing a shaft.' },
    { id: 'torch', name: 'Torches', icon: 'torch.webp', amount: 8, cost: 3, max: 99, key: 'T', desc: 'Light the way.' },
    { id: 'bread', name: 'Bread', icon: 'bread.png', amount: 1, cost: 3, max: 20, desc: 'Restores hunger.' },
    { id: 'tnt', name: 'TNT', icon: 'tnt.png', amount: 1, cost: 15, max: 20, desc: 'Blasts a hole and keeps the ores.' },
    { id: 'pearl', name: 'Ender Pearl', icon: 'ender_pearl.png', amount: 1, cost: 40, max: 10, desc: 'Teleports you home with your loot.' },
    { id: 'potion', name: 'Fire Resistance', icon: 'potion_fire_resistance.png', amount: 1, cost: 60, max: 5, desc: '45 seconds of lava swimming.' },
];
const ADVANCEMENTS = {
    stone_age:  ['Stone Age', 'Buy a Stone Pickaxe'],
    hardware:   ['Acquire Hardware', 'Buy an Iron Pickaxe'],
    diamonds:   ['Diamonds!', 'Find a diamond'],
    deep:       ['Deep Diver', 'Reach 100 m'],
    hot:        ['Hot Stuff', 'Touch lava and live'],
    boom:       ['Kaboom', 'Blow something up with TNT'],
    sneaky:     ['Not Today', 'Defeat a creeper'],
    rich:       ['Emerald Tycoon', 'Hold 500 emeralds'],
    nether:     ['We Need to Go Deeper', 'Break into the Nether'],
    debris:     ['Hidden in the Depths', 'Find Ancient Debris'],
    netherite:  ['Serious Dedication', 'Buy a Netherite Pickaxe'],
    core:       ['Bedrock Bound', 'Claim the Heart of the World'],
};

// ---------- TUILES ----------
const TILES = [], T = {};
function tile(key, p) {
    p = Object.assign({ solid: true, hard: 1, tier: 1, drop: null, light: 0, falls: false, blast: true, name: key, snd: 'stone' }, p);
    p.id = TILES.length; p.key = key; TILES.push(p); T[key] = p.id; return p;
}
tile('air', { solid: false, hard: 0, tier: 0 });
tile('grass', { hard: .3, tier: 0, name: 'Grass Block', snd: 'soft' });
tile('dirt', { hard: .3, tier: 0, name: 'Dirt', snd: 'soft' });
tile('sand', { hard: .25, tier: 0, name: 'Sand', falls: true, snd: 'soft' });
tile('gravel', { hard: .35, tier: 0, name: 'Gravel', falls: true, snd: 'soft' });
tile('stone', { hard: .75, name: 'Stone' });
tile('deepslate', { hard: 1.3, name: 'Deepslate' });
tile('netherrack', { hard: .35, name: 'Netherrack', snd: 'nether' });
tile('basalt', { hard: 1, name: 'Basalt' });
tile('blackstone', { hard: 1.1, name: 'Blackstone' });
tile('obsidian', { hard: 4.5, tier: 4, name: 'Obsidian', blast: false });
tile('bedrock', { hard: Infinity, tier: 99, name: 'Bedrock', blast: false });
tile('reinforced', { hard: 5, tier: 5, name: 'Reinforced Deepslate', blast: false });
tile('heart', { hard: 6, tier: 5, name: 'Heart of the World', light: 15, blast: false });
const ORE_DEFS = [
    ['coal', 1, .9], ['copper', 2, 1], ['iron', 2, 1.1], ['lapis', 2, 1.1],
    ['redstone', 3, 1.3], ['gold', 3, 1.3], ['diamond', 3, 1.6], ['emerald', 3, 1.6],
];
for (const [ore, tier, hard] of ORE_DEFS) {
    const name = ore[0].toUpperCase() + ore.slice(1) + ' Ore';
    tile(ore + '_ore', { hard, tier, drop: ore, name, ore });
    tile('deep_' + ore + '_ore', { hard: hard * 1.4, tier, drop: ore, name: 'Deepslate ' + name, ore, deep: true });
}
tile('quartz_ore', { hard: .7, drop: 'quartz', name: 'Nether Quartz Ore', ore: 'quartz', snd: 'nether' });
tile('ngold_ore', { hard: .6, drop: 'nugget', name: 'Nether Gold Ore', ore: 'ngold', snd: 'nether' });
tile('debris', { hard: 3.5, tier: 4, drop: 'debris', name: 'Ancient Debris', blast: false });
tile('glowstone', { hard: .3, tier: 0, drop: 'glowdust', name: 'Glowstone', light: 14, snd: 'soft' });
tile('magma', { hard: .6, name: 'Magma Block', light: 5 });
tile('amethyst', { hard: 1, drop: 'amethyst', name: 'Amethyst Block' });
tile('tnt', { hard: .05, tier: 0, name: 'TNT', snd: 'soft' });
tile('chest', { hard: .4, tier: 0, name: 'Chest', snd: 'wood', blast: false });
tile('grave', { hard: .4, tier: 0, name: 'Your Lost Backpack', snd: 'wood', blast: false, light: 4 });
tile('lava', { solid: false, hard: 0, tier: 99, light: 11, liquid: true });
tile('ladder', { solid: false, hard: .1, tier: 0, deco: true, snd: 'wood' });
tile('torch', { solid: false, hard: .05, tier: 0, deco: true, light: 13, snd: 'wood' });
tile('log', { solid: false, hard: 0, tier: 99, deco: true });
tile('leaves', { solid: false, hard: 0, tier: 99, deco: true });
tile('tallgrass', { solid: false, hard: 0, tier: 99, deco: true });
tile('flower', { solid: false, hard: 0, tier: 99, deco: true });
const ORE_TILE = {};
for (const [ore] of ORE_DEFS) ORE_TILE[ore] = [T[ore + '_ore'], T['deep_' + ore + '_ore']];
const isSolidId = id => TILES[id].solid;

// ---------- TEXTURES ----------
const PAL = {
    dirt: ['#5d3f29', '#6c4a31', '#7b5739', '#8a6443', '#966f4b'],
    stone: ['#636363', '#6e6e6e', '#7a7a7a', '#858585', '#919191'],
    deepslate: ['#2f2f35', '#38383f', '#414149', '#4b4b53', '#56565e'],
    netherrack: ['#4e1d1d', '#5e2424', '#6e2b2b', '#7d3333', '#8e3d3d'],
    sand: ['#c9bc86', '#d4c891', '#dcd19c', '#e3d9a7', '#ece3b6'],
    gravel: ['#4f4847', '#6e6766', '#807978', '#958d8a', '#aba49f', '#776355'],
    obsidian: ['#0d0a14', '#130e1d', '#1a1428', '#231a35', '#3b2b5c'],
    bedrock: ['#161616', '#303030', '#4f4f4f', '#707070', '#8f8f8f'],
    basalt: ['#3b3b41', '#45454c', '#505057', '#5b5b62', '#686870'],
    blackstone: ['#1d191e', '#252027', '#2d2730', '#363039', '#423b45'],
    glowstone: ['#6a4c22', '#a67b3b', '#d6a95a', '#f1cd7a', '#fff0b5'],
    lava: ['#a92f08', '#cc4a0c', '#e46a16', '#f39326', '#fbc146', '#ffe27a'],
    amethyst: ['#4f337f', '#6545a0', '#7c5bbd', '#9677d6', '#b79af0'],
    debris: ['#35211c', '#462c25', '#57382f', '#6b483d', '#82604f'],
    leaves: ['#2a5418', '#356620', '#41792a', '#4e8c33'],
    log: ['#3f2d14', '#4f3a1b', '#604824', '#6f552c'],
    planks: ['#7d5f31', '#8f6e3b', '#a07d46', '#b08b51'],
};
const ORE_COL = {
    coal: ['#4a4a4a', '#232323', '#0e0e0e'], copper: ['#f0ad75', '#c76d3e', '#7a3f22'],
    iron: ['#f1d3b3', '#d4a884', '#946b50'], lapis: ['#5a88ee', '#2249b8', '#132b75'],
    redstone: ['#ff6a55', '#d61414', '#760505'], gold: ['#fff590', '#f0c21e', '#9c740c'],
    diamond: ['#c2fff6', '#4fe3d7', '#1b8a82'], emerald: ['#95ffb8', '#18d55b', '#08752f'],
    quartz: ['#ffffff', '#e7ddd0', '#ad9f8e'], ngold: ['#fff590', '#f0c21e', '#9c740c'],
};
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function pix(fn) {
    const px = [];
    for (let i = 0; i < 256; i++) px.push(null);
    fn((x, y, c, a = 255) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) px[y * 16 + x] = c ? (typeof c === 'string' ? [...rgb(c), a] : [c[0], c[1], c[2], c[3] == null ? a : c[3]]) : null; }, px);
    return px;
}
function toCanvas(px, size = 16) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), img = g.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
        const p = px[i]; if (!p) continue;
        img.data.set([p[0], p[1], p[2], p[3] == null ? 255 : p[3]], i * 4);
    }
    g.putImageData(img, 0, 0); return c;
}
// mélange de bruit grossier et fin : donne l'aspect marbré des blocs de Minecraft
function mottled(pal, seed, sx = 1, sy = 1, grain = .45) {
    const r = mulberry(seed);
    return pix(set => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const v = vnoise(x / (4 * sx), y / (4 * sy), seed) * (1 - grain) + r() * grain;
            set(x, y, pal[clamp(Math.floor(v * pal.length), 0, pal.length - 1)]);
        }
    });
}
function addOre(px, cols, seed, count = 4) {
    const r = mulberry(seed);
    const shapes = [[[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], [[0, 0], [1, 1], [1, 0]], [[0, 0], [1, 0], [0, 1]]];
    for (let i = 0; i < count; i++) {
        const sh = shapes[Math.floor(r() * shapes.length)];
        const ox = 1 + Math.floor(r() * 12), oy = 1 + Math.floor(r() * 12);
        for (const [dx, dy] of sh) {
            const x = ox + dx, y = oy + dy;
            px[y * 16 + x] = [...rgb(cols[1]), 255];
            if (y + 1 < 16 && !sh.some(([a, b]) => a === dx && b === dy + 1)) px[(y + 1) * 16 + x] = [...rgb(cols[2]), 255];
        }
        px[oy * 16 + ox] = [...rgb(cols[0]), 255];
    }
    return px;
}
function shade(px, k, tint) {
    return px.map(p => p && [Math.round(p[0] * k + (tint ? tint[0] : 0)), Math.round(p[1] * k + (tint ? tint[1] : 0)), Math.round(p[2] * k + (tint ? tint[2] : 0)), p[3]]);
}

const TEX = {};   // clé -> tableau de canvas (variantes ou images d'animation)
const WALL = {};  // fonds de grotte
let CRACKS = [];
function buildTextures() {
    const variants = (key, gen, n = 3) => { TEX[key] = []; for (let i = 0; i < n; i++) TEX[key].push(toCanvas(gen(i))); };
    variants('dirt', i => mottled(PAL.dirt, 11 + i));
    variants('stone', i => mottled(PAL.stone, 21 + i));
    variants('deepslate', i => mottled(PAL.deepslate, 31 + i, 2.2, .5, .35));
    variants('netherrack', i => mottled(PAL.netherrack, 41 + i, .8, .8, .55));
    variants('sand', i => mottled(PAL.sand, 51 + i, 1, 1, .6));
    variants('gravel', i => mottled(PAL.gravel, 61 + i, .5, .5, .8));
    variants('obsidian', i => mottled(PAL.obsidian, 71 + i, 1.2, 1.2, .4));
    variants('bedrock', i => mottled(PAL.bedrock, 81 + i, .6, .6, .5));
    variants('basalt', i => mottled(PAL.basalt, 91 + i, .25, 3, .3));
    variants('blackstone', i => mottled(PAL.blackstone, 101 + i, 1, 1, .5));
    variants('amethyst', i => mottled(PAL.amethyst, 111 + i, .7, .7, .5));
    variants('glowstone', i => mottled(PAL.glowstone, 121 + i, .5, .5, .6));
    variants('grass', i => {
        const px = mottled(PAL.dirt, 131 + i), r = mulberry(140 + i);
        const greens = ['#4a7a25', '#5b8f2e', '#6aa338', '#79b443'];
        for (let x = 0; x < 16; x++) {
            const depth = 2 + Math.floor(r() * 3);
            for (let y = 0; y < depth; y++) px[y * 16 + x] = [...rgb(greens[Math.floor(r() * greens.length)]), 255];
        }
        return px;
    });
    for (const [ore] of ORE_DEFS) {
        variants(ore + '_ore', i => addOre(mottled(PAL.stone, 21 + i), ORE_COL[ore], 200 + ore.length * 7 + i));
        variants('deep_' + ore + '_ore', i => addOre(mottled(PAL.deepslate, 31 + i, 2.2, .5, .35), ORE_COL[ore], 300 + ore.length * 7 + i));
    }
    variants('quartz_ore', i => addOre(mottled(PAL.netherrack, 41 + i, .8, .8, .55), ORE_COL.quartz, 401 + i, 5));
    variants('ngold_ore', i => addOre(mottled(PAL.netherrack, 41 + i, .8, .8, .55), ORE_COL.ngold, 411 + i, 6));
    variants('debris', i => pix(set => {
        const r = mulberry(500 + i);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
            const v = (Math.floor(ring) % 3 === 0 ? .75 : .35) + r() * .3;
            set(x, y, PAL.debris[clamp(Math.floor(v * 5), 0, 4)]);
        }
    }), 2);
    variants('reinforced', () => pix(set => {
        const r = mulberry(520);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const edge = x < 2 || y < 2 || x > 13 || y > 13;
            const c = edge ? ['#8f8b80', '#b7b2a4', '#cfcabb'][Math.floor(r() * 3)] : PAL.deepslate[Math.floor(r() * 3)];
            set(x, y, c);
        }
        for (let i = 5; i < 11; i++) { set(i, 5, '#0f5f62'); set(i, 10, '#0f5f62'); set(5, i, '#0f5f62'); set(10, i, '#0f5f62'); }
        set(7, 7, '#2ad1c9'); set(8, 8, '#2ad1c9'); set(7, 8, '#169a96'); set(8, 7, '#169a96');
    }), 1);
    TEX.heart = [];
    for (let f = 0; f < 4; f++) TEX.heart.push(toCanvas(pix(set => {
        const r = mulberry(530);
        const k = .75 + .25 * Math.sin(f / 4 * Math.PI * 2);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
            if (d < 6.5) {
                const facet = (x < 8) !== (y < 8) ? .8 : 1;
                const base = d < 2.5 ? [235, 255, 255] : [80, 220, 230];
                set(x, y, [base[0] * k * facet, base[1] * k * facet, base[2] * facet].map(Math.round));
            } else set(x, y, PAL.obsidian[Math.floor(r() * 4)]);
        }
        set(5, 4, '#ffffff'); set(4, 5, '#ffffff');
    })));
    variants('magma', i => pix(set => {
        const r = mulberry(540 + i);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const n = vnoise(x / 3, y / 3, 540 + i);
            const crack = Math.abs(n - .5) < .07;
            set(x, y, crack ? (r() < .5 ? '#f7a73a' : '#d9631a') : ['#2b0b06', '#4a150a', '#6b230e'][Math.floor(r() * 3)]);
        }
    }), 2);
    TEX.lava = [];
    for (let f = 0; f < 6; f++) TEX.lava.push(toCanvas(pix(set => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const v = vnoise(x / 4, ((y + f * 16 / 6) % 16) / 4, 550) * .55 + vnoise(x / 2 + 30, y / 2, 551 + f) * .45;
            set(x, y, PAL.lava[clamp(Math.floor(v * 6), 0, 5)]);
        }
    })));
    TEX.tnt = [toCanvas(pix(set => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, (x % 4 === 0) ? '#a5180f' : (y < 2 || y > 13) ? '#8e1a10' : '#db2b1f');
        for (let x = 0; x < 16; x++) for (let y = 5; y < 11; y++) set(x, y, '#e4e4e4');
        const L = ['###.#..#.###', '.#..##.#..#.', '.#..#.##..#.', '.#..#..#..#.'];
        for (let y = 0; y < 4; y++) for (let x = 0; x < 12; x++) if (L[y][x] === '#') set(x + 2, y + 6, '#1a1a1a');
    }))];
    const chestTex = (wood, dark, latch) => toCanvas(pix(set => {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const border = x === 0 || y === 0 || x === 15 || y === 15 || y === 6;
            set(x, y, border ? dark : ((y + (x >> 2)) % 5 === 0 ? dark : wood));
        }
        for (let y = 4; y < 9; y++) for (let x = 7; x < 9; x++) set(x, y, latch);
    }));
    TEX.chest = [chestTex('#a8742f', '#4a3014', '#c9c9c9')];
    TEX.grave = [chestTex('#2c6f6a', '#0e2b2a', '#f2d64b')];
    TEX.ladder = [toCanvas(pix(set => {
        for (let y = 0; y < 16; y++) { set(2, y, '#6b4a22'); set(3, y, '#8a6331'); set(12, y, '#6b4a22'); set(13, y, '#8a6331'); }
        for (const y of [2, 6, 10, 14]) for (let x = 4; x < 12; x++) { set(x, y, '#9c7340'); set(x, y + 1, '#5c3f1c'); }
    }))];
    TEX.torch = [];
    for (let f = 0; f < 3; f++) TEX.torch.push(toCanvas(pix(set => {
        for (let y = 7; y < 16; y++) { set(7, y, '#6b4a22'); set(8, y, '#8a6331'); }
        set(7, 6, '#ffd84a'); set(8, 6, '#ffb52a'); set(7, 5, '#fff3a0'); set(8, 5, '#ffd84a');
        set(7 + (f === 1 ? 1 : 0), 4, '#ffe680'); if (f === 2) set(8, 3, '#ffd84a');
    })));
    variants('log', i => mottled(PAL.log, 600 + i, .2, 3, .3), 1);
    variants('leaves', i => pix(set => {
        const r = mulberry(610 + i);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (r() > .14) set(x, y, PAL.leaves[Math.floor(r() * 4)]);
    }), 2);
    variants('planks', () => pix(set => {
        const r = mulberry(620);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, y % 4 === 3 ? '#5a4322' : PAL.planks[Math.floor(r() * 4)]);
    }), 1);
    variants('tallgrass', i => pix(set => {
        const r = mulberry(630 + i);
        for (let k = 0; k < 6; k++) { const x = 2 + Math.floor(r() * 12), h = 3 + Math.floor(r() * 6); for (let y = 16 - h; y < 16; y++) set(x, y, y < 16 - h + 2 ? '#79b443' : '#5b8f2e'); }
    }), 2);
    variants('flower', i => pix(set => {
        for (let y = 9; y < 16; y++) set(7, y, '#4a7a25');
        set(6, 12, '#5b8f2e'); set(8, 11, '#5b8f2e');
        const c = i ? '#f2d43a' : '#e0312b';
        for (const [x, y] of [[7, 6], [6, 7], [8, 7], [7, 8], [7, 7]]) set(x, y, c);
        set(7, 7, i ? '#c77a14' : '#f7e55a');
    }), 2);
    // fonds de grotte : version sombre du bloc de la couche
    for (const k of ['dirt', 'stone', 'deepslate', 'netherrack', 'blackstone']) {
        WALL[k] = toCanvas(shade(mottled(PAL[k], 900 + k.length, k === 'deepslate' ? 2.2 : 1, k === 'deepslate' ? .5 : 1), .42));
    }
    // fissures de minage, 8 étapes de la même fissure qui grandit
    const r = mulberry(777), path = [];
    for (let b = 0; b < 5; b++) {
        let x = 7 + Math.floor(r() * 3) - 1, y = 7 + Math.floor(r() * 3) - 1;
        const dx = [1, -1, 0, 0, 1][b], dy = [0, 0, 1, -1, 1][b];
        for (let s = 0; s < 9; s++) { path.push([x, y, s + b]); x += dx + (r() < .4 ? Math.floor(r() * 3) - 1 : 0); y += dy + (r() < .4 ? Math.floor(r() * 3) - 1 : 0); }
    }
    path.sort((a, b) => a[2] - b[2]);
    CRACKS = [];
    for (let s = 0; s < 8; s++) {
        const n = Math.ceil(path.length * (s + 1) / 8);
        CRACKS.push(toCanvas(pix(set => { for (let i = 0; i < n; i++) set(path[i][0], path[i][1], [20, 20, 20], 200); })));
    }
}

// ---------- PETITS SPRITES ----------
function mapSprite(rows, colors, w) {
    const c = document.createElement('canvas'); c.width = w || rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (colors[ch]) { g.fillStyle = colors[ch]; g.fillRect(x, y, 1, 1); } }));
    return c;
}
const HEART_ROWS = ['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'];
const FOOD_ROWS = ['....kkk..', '...kbbbk.', '..kbbbbbk', '..kbbbbbk', '..kbbbbk.', '.kwkkkk..', 'kwk......', 'kwk......', '.k.......'];
function iconURL(rows, colors) { return mapSprite(rows, colors).toDataURL(); }
const UI_ICONS = {};
function buildUiIcons() {
    UI_ICONS.heart = iconURL(HEART_ROWS, { k: '#1b0000', r: '#e81818', w: '#ffb3b3' });
    UI_ICONS.heartEmpty = iconURL(HEART_ROWS, { k: '#1b0000', r: '#3d0d0d', w: '#3d0d0d' });
    UI_ICONS.heartHalf = iconURL(HEART_ROWS.map(r => r.slice(0, 5) + r.slice(5).replace(/[rw]/g, 'e')), { k: '#1b0000', r: '#e81818', w: '#ffb3b3', e: '#3d0d0d' });
    UI_ICONS.food = iconURL(FOOD_ROWS, { k: '#2a1200', b: '#c47a3a', w: '#efe3cc' });
    UI_ICONS.foodEmpty = iconURL(FOOD_ROWS, { k: '#2a1200', b: '#3a2410', w: '#3a2410' });
    UI_ICONS.foodHalf = iconURL(FOOD_ROWS.map(r => r.slice(0, 5).replace(/b/g, 'e') + r.slice(5)), { k: '#2a1200', b: '#c47a3a', w: '#efe3cc', e: '#3a2410' });
}

const SPR = {};
function buildCreatures() {
    const G = { g: '#57b947', h: '#7bd96a', d: '#3a8a2f', k: '#111111', e: '#2b5e22' };
    SPR.creeper = mapSprite([
        'hgggdggh', 'ggdgggdg', 'gkkggkkg', 'gkkggkkg', 'gddkkddg', 'ggkkkkgg', 'gdkkkkdg', 'ggkggkgg',
        '..gdhg..', '..ggdg..', '..dggg..', '..gghg..', '..gdgg..', '..ggdg..', '..hggg..', '..gdgg..', '..ggdg..', '..gggh..',
        '.ggddgg.', '.gdggdg.', '.gg..gg.', '.dg..gd.', '.gg..gg.', '.ee..ee.',
    ], G);
    const M = { k: '#1a0503', r: '#5c1407', o: '#e05a12', y: '#ffc23a', e: '#ffdf5a' };
    SPR.cube = mapSprite([
        'kkkkkkkkkkkk', 'krrrrrrrrrrk', 'kooooooooook', 'krrrrrrrrrrk', 'krryyrryyrrk', 'krryerryerrk',
        'kooooooooook', 'krrrrrrrrrrk', 'krrrrrrrrrrk', 'kooooooooook', 'krrrrrrrrrrk', 'kkkkkkkkkkkk',
    ], M);
    const V = { s: '#bd8b72', n: '#a5735c', b: '#5f3c26', r: '#7a4f33', d: '#4a2e1c', w: '#ffffff', g: '#3f7b3a', k: '#111' };
    SPR.villager = mapSprite([
        '.bbbbbb.', 'bssssssb', 'bssssssb', 'skgsskgs', 'sssnnsss', 'sssnnsss', 'ssbnnbss', '.sssnss.', '..ssss..',
        'rrrrrrrr', 'rrdrrdrr', 'rssssssr', 'rssssssr', 'rrrrrrrr', '.rrrrrr.', '.rrrrrr.', '.rrdrrr.', '.rrrrrr.',
        '.rrrrrr.', '.rrrrrr.', '.rrrrdr.', '.rrrrrr.', '.rrrrrr.', '.dd..dd.',
    ], V);
}

// le joueur est construit à partir du vrai skin d'Amai (skin slim 64x64), vu de profil
const PLAYER_PARTS = {};
function buildPlayer(skin) {
    const src = document.createElement('canvas'); src.width = src.height = 64;
    const sg = src.getContext('2d'); sg.drawImage(skin, 0, 0);
    const data = sg.getImageData(0, 0, 64, 64).data;
    const at = (x, y) => { const i = (y * 64 + x) * 4; return data[i + 3] ? [data[i], data[i + 1], data[i + 2], data[i + 3]] : null; };
    const part = (w, h, fn) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d');
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const p = fn(x, y); if (!p) continue;
            g.fillStyle = `rgba(${p[0]},${p[1]},${p[2]},${p[3] / 255})`; g.fillRect(x, y, 1, 1);
        }
        return c;
    };
    const ROWS10 = [0, 1, 2, 4, 5, 6, 7, 9, 10, 11]; // 12 rangées réduites à 10
    // tête vue de face (visage + calque du chapeau, où Amai porte son masque de chat), corps de profil
    PLAYER_PARTS.head = part(8, 8, (x, y) => at(40 + x, 8 + y) || at(8 + x, 8 + y));
    PLAYER_PARTS.body = part(4, 10, (x, y) => at(16 + x, 36 + ROWS10[y]) || at(16 + x, 20 + ROWS10[y]));
    PLAYER_PARTS.arm = part(4, 10, (x, y) => at(40 + x, 36 + ROWS10[y]) || at(40 + x, 20 + ROWS10[y]));
    PLAYER_PARTS.leg = part(4, 10, (x, y) => at(0 + x, 36 + ROWS10[y]) || at(0 + x, 20 + ROWS10[y]));
    PLAYER_PARTS.legBack = part(4, 10, (x, y) => { const p = at(0 + x, 20 + ROWS10[y]); return p && [p[0] * .7, p[1] * .7, p[2] * .7, p[3]]; });
    PLAYER_PARTS.armBack = part(4, 10, (x, y) => { const p = at(40 + x, 20 + ROWS10[y]); return p && [p[0] * .7, p[1] * .7, p[2] * .7, p[3]]; });
}
function buildPlayerFallback() {
    const f = (w, h, c) => { const k = document.createElement('canvas'); k.width = w; k.height = h; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h); return k; };
    PLAYER_PARTS.head = f(8, 8, '#c8996f'); PLAYER_PARTS.body = f(4, 10, '#2e3a4f'); PLAYER_PARTS.arm = f(4, 10, '#c8996f');
    PLAYER_PARTS.leg = f(4, 10, '#26262e'); PLAYER_PARTS.legBack = f(4, 10, '#1a1a20'); PLAYER_PARTS.armBack = f(4, 10, '#8c6b4d');
}

// icônes d'objets : les images de RecipeCraft font 16, 160 ou 300 px ; on les ramène à 16 px
const IMG = {};
function loadIcon(file) {
    if (IMG[file]) return IMG[file];
    const entry = { img: new Image(), small: null };
    entry.img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = entry.img.naturalWidth % 16 !== 0;
        g.drawImage(entry.img, 0, 0, 16, 16);
        entry.small = c;
    };
    entry.img.src = ICONS + file;
    IMG[file] = entry; return entry;
}

// ---------- SONS (synthétisés) ----------
const Sound = (() => {
    let ac = null, master = null, noise = null, muted = store.get('bedrockbound_muted') === '1';
    function init() {
        if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
        try {
            ac = new (window.AudioContext || window.webkitAudioContext)();
            master = ac.createGain(); master.gain.value = muted ? 0 : .5; master.connect(ac.destination);
            noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
            const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { ac = null; }
    }
    function burst(freq, dur, vol, type = 'bandpass', q = 1.2, sweep) {
        if (!ac) return;
        const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = noise; s.playbackRate.value = rnd(.8, 1.2);
        f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
        if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
        s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
    }
    function tone(freq, dur, vol, type = 'square', delay = 0, slide) {
        if (!ac) return;
        const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
    }
    const MAT = { soft: [500, .7], stone: [1500, 1.3], nether: [900, 1], wood: [700, 2.5] };
    return {
        init,
        get muted() { return muted; },
        toggle() { muted = !muted; store.set('bedrockbound_muted', muted ? '1' : '0'); if (master) master.gain.value = muted ? 0 : .5; return muted; },
        dig(m) { const [f, q] = MAT[m] || MAT.stone; burst(f * rnd(.9, 1.1), .07, .25, 'bandpass', q); },
        brk(m) { const [f, q] = MAT[m] || MAT.stone; burst(f * .8, .18, .45, 'bandpass', q, f * .4); },
        pop() { tone(rnd(700, 900), .08, .12, 'sine', 0, 1400); },
        coin() { [0, .07, .14, .21].forEach((d, i) => tone([988, 1319, 1568, 2093][i], .18, .1, 'square', d)); },
        hurt() { tone(220, .18, .2, 'square', 0, 90); burst(400, .12, .3, 'lowpass', .7); },
        boom() { burst(900, 1.1, 1, 'lowpass', .8, 60); tone(70, .6, .5, 'sine', 0, 30); },
        fuse() { burst(5000, .5, .15, 'highpass', .5); },
        clank() { tone(1800, .05, .08, 'square'); tone(1200, .07, .06, 'square', .03); },
        place() { burst(700, .06, .3, 'bandpass', 2); },
        eat() { [0, .1, .2].forEach(d => burst(rnd(900, 1300), .06, .25, 'bandpass', 1.5)); },
        step(m) { const [f] = MAT[m] || MAT.stone; burst(f * .6, .04, .07, 'bandpass', 1); },
        jump() { burst(500, .05, .08, 'bandpass', 1); },
        toast() { tone(784, .25, .1, 'triangle'); tone(1175, .4, .1, 'triangle', .12); },
        pearl() { tone(400, .5, .15, 'sine', 0, 1600); burst(3000, .4, .15, 'highpass', 1); },
        buy() { tone(660, .08, .1, 'square'); tone(990, .12, .1, 'square', .08); },
        deny() { tone(160, .15, .15, 'square'); },
        win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .5, .12, 'triangle', i * .14)); },
        cave() {
            if (!ac) return;
            const base = rnd(55, 90);
            tone(base, 3, .09, 'sine', 0, base * .7); tone(base * 1.51, 2.6, .05, 'sine', .4, base * 1.2);
            burst(300, 2.5, .05, 'lowpass', .5, 100);
        },
    };
})();

// ---------- GÉNÉRATION DU MONDE ----------
function surfaceHeights(seed) {
    const h = [];
    for (let x = 0; x < W; x++) h.push(x < 19 ? SURF : SURF + Math.round((vnoise(x * .15, .5, seed) - .5) * 3.2));
    return h;
}
function generate(seed) {
    const r = mulberry(seed), S = seed % 100000;
    const g = new Uint8Array(W * H);
    const sh = surfaceHeights(S);
    const id = (x, y) => g[y * W + x];
    const put = (x, y, v) => { if (x > 0 && x < W - 1 && y >= 0 && y < H) g[y * W + x] = v; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let v;
        const s = sh[x];
        if (y < s) v = T.air;
        else if (y === s) v = T.grass;
        else if (y < s + 4 + Math.floor(vnoise(x * .3, 3, S) * 2)) v = T.dirt;
        else if (y < OBSIDIAN_Y) v = y > DEEPSLATE_Y + vnoise(x * .25, 7, S) * 8 - 4 ? T.deepslate : T.stone;
        else if (y < NETHER_Y) {
            if (y < 216) v = r() < .6 ? T.obsidian : T.deepslate;
            else if (y < 220) v = T.obsidian;
            else v = r() < .6 ? T.obsidian : T.netherrack;
        }
        else if (y < BASALT_Y) v = T.netherrack;
        else v = vnoise(x * .4, y * .4, S + 5) > .5 ? T.basalt : T.blackstone;
        if (x === 0 || x === W - 1 || y >= BEDROCK_Y) v = T.bedrock;
        else if (y >= BEDROCK_Y - 2 && r() < .45) v = T.bedrock;
        g[y * W + x] = v;
    }
    // grottes : tunnels (bruit "en crête") et grandes salles
    for (let y = SURF + 10; y < OBSIDIAN_Y - 2; y++) for (let x = 1; x < W - 1; x++) {
        const n1 = fbm(x * .11, y * .16, S + 21);
        const worm = Math.abs(n1 - .5) < .034 + Math.min(.03, y / 6000);
        const cavern = fbm(x * .07 + 50, y * .1, S + 33) > .7 - Math.min(.05, y / 4000);
        if (worm || cavern) g[y * W + x] = T.air;
    }
    for (let y = NETHER_Y + 3; y < BASALT_Y + 2; y++) for (let x = 1; x < W - 1; x++) {
        if (fbm(x * .09, y * .12, S + 44) > .55) g[y * W + x] = T.air;
    }
    // filons
    const vein = (ore, y0, y1, count, s0, s1, hosts) => {
        for (let c = 0; c < count; c++) {
            let x = 1 + Math.floor(r() * (W - 2)), y = y0 + Math.floor(r() * (y1 - y0));
            const size = s0 + Math.floor(r() * (s1 - s0 + 1));
            for (let s = 0; s < size; s++) {
                if (x > 0 && x < W - 1 && y > 0 && y < H) {
                    const host = id(x, y);
                    if (hosts.includes(host)) g[y * W + x] = typeof ore === 'string' ? ORE_TILE[ore][host === T.deepslate ? 1 : 0] : ore;
                }
                if (r() < .5) x += r() < .5 ? -1 : 1; else y += r() < .5 ? -1 : 1;
            }
        }
    };
    const ROCK = [T.stone, T.deepslate];
    vein(T.gravel, SURF + 6, 200, 34, 4, 9, ROCK);
    vein(T.sand, SURF + 2, SURF + 7, 6, 3, 6, [T.dirt]);
    vein('coal', SURF + 5, 150, 46, 4, 8, ROCK);
    vein('copper', 22, 115, 30, 3, 6, ROCK);
    vein('iron', 32, 205, 38, 3, 5, ROCK);
    vein('lapis', 72, 205, 16, 2, 4, ROCK);
    vein('redstone', 100, 212, 20, 3, 6, ROCK);
    vein('gold', 88, 212, 20, 2, 4, ROCK);
    vein('diamond', 138, 212, 16, 1, 3, ROCK);
    vein('emerald', 118, 212, 9, 1, 1, ROCK);
    vein(T.amethyst, 150, 208, 6, 5, 9, ROCK);
    vein(T.tnt, 40, 210, 16, 1, 1, ROCK);
    const NR = [T.netherrack];
    vein(T.quartz_ore, NETHER_Y, BASALT_Y, 34, 2, 5, NR);
    vein(T.ngold_ore, NETHER_Y, BASALT_Y, 30, 2, 4, NR);
    vein(T.magma, NETHER_Y + 6, BASALT_Y, 22, 2, 5, NR);
    vein(T.debris, 238, BASALT_Y + 10, 16, 1, 1, [T.netherrack, T.basalt, T.blackstone]);
    // pierre lumineuse accrochée aux plafonds du Nether
    for (let y = NETHER_Y + 2; y < BASALT_Y; y++) for (let x = 1; x < W - 1; x++) {
        if (id(x, y) === T.air && isSolidId(id(x, y - 1)) && id(x, y - 1) !== T.lava && r() < .06) {
            put(x, y, T.glowstone); if (r() < .6) put(x + (r() < .5 ? 1 : -1), y, T.glowstone);
            if (id(x, y + 1) === T.air && r() < .5) put(x, y + 1, T.glowstone);
        }
    }
    // lave au fond des grottes profondes et des cavernes du Nether
    for (let y = 72; y < BASALT_Y + 2; y++) for (let x = 1; x < W - 1; x++) {
        if (id(x, y) !== T.air) continue;
        const nether = y > NETHER_Y;
        const floor = isSolidId(id(x, y + 1)) || (nether && isSolidId(id(x, y + 2)));
        if (floor && fbm(x * .2, y * .25, S + 55) > (nether ? .5 : .6)) g[y * W + x] = T.lava;
    }
    // coffres posés au sol des grottes
    let chests = 0;
    for (let tries = 0; tries < 4000 && chests < 16; tries++) {
        const x = 1 + Math.floor(r() * (W - 2)), y = 30 + Math.floor(r() * 265);
        if (id(x, y) === T.air && isSolidId(id(x, y + 1)) && id(x, y - 1) === T.air) { g[y * W + x] = T.chest; chests++; }
    }
    // la salle du Cœur, enfermée dans de l'ardoise renforcée
    let heartY = CORE_Y;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -8; dx <= 8; dx++) {
        const d = (dx / 6.5) ** 2 + (dy / 4.5) ** 2, x = CORE_X + dx, y = CORE_Y + dy;
        if (d < .62) put(x, y, T.air);
        else if (d < 1.05) put(x, y, T.reinforced);
    }
    for (let y = CORE_Y; y < CORE_Y + 6; y++) if (id(CORE_X, y) === T.air && id(CORE_X, y + 1) !== T.air) { heartY = y; break; }
    put(CORE_X, heartY, T.heart);
    // surface : herbes, fleurs et arbres
    for (let x = 1; x < W - 1; x++) {
        const s = sh[x];
        if (x > 2 && x < 12) continue; // l'étal du marchand
        const n = r();
        if (n < .28) put(x, s - 1, T.tallgrass);
        else if (n < .36) put(x, s - 1, T.flower);
    }
    for (const tx of [27, 35, 42]) {
        const s = sh[tx];
        for (let y = s - 4; y < s; y++) put(tx, y, T.log);
        for (let dy = -7; dy <= -4; dy++) for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) === 2 && (dy === -7 || r() < .3)) continue;
            if (id(tx + dx, s + dy) === T.air || (dx === 0 && dy === -4)) put(tx + dx, s + dy, dx === 0 && dy === -4 ? T.log : T.leaves);
        }
    }
    // la lave se pose avant que le joueur arrive
    for (let i = 0; i < 90; i++) lavaStep(g, 0, H);
    return g;
}

// lave "finie" : chaque tuile tombe, ou s'étale quand elle est poussée par une autre au-dessus
function lavaStep(g, y0, y1) {
    let moved = false;
    for (let y = Math.min(y1, H - 2); y >= Math.max(y0, 1); y--) {
        const dir = (y & 1) ? 1 : -1;
        for (let k = 0; k < W; k++) {
            const x = dir > 0 ? k : W - 1 - k, i = y * W + x;
            if (g[i] !== T.lava) continue;
            const below = g[i + W];
            if (!TILES[below].solid && below !== T.lava) { g[i + W] = T.lava; g[i] = T.air; moved = true; continue; }
            const pushed = g[i - W] === T.lava;
            for (const sx of [dir, -dir]) {
                const j = i + sx, side = g[j];
                if (x + sx <= 0 || x + sx >= W - 1 || TILES[side].solid || side === T.lava) continue;
                const fallsNext = !TILES[g[j + W]].solid && g[j + W] !== T.lava;
                if (pushed || fallsNext) { g[j] = T.lava; g[i] = T.air; moved = true; break; }
            }
        }
    }
    return moved;
}

// ---------- ÉTAT DU JEU ----------
let world = null, seed = 0, surf = [];
let player, wallet, gear, hot, cargo, stash, graves, stats, adv, won;
let entities = [], particles = [], floaters = [], pendingFalls = [];
let selected = 0, camX = 0, camY = 0, shake = 0, time = 0;
let mining = null, msg = { text: '', t: 0 }, state = 'title', paused = false;
let lavaTimer = 0, spawnTimer = 0, saveTimer = 0, caveTimer = 30, stepTimer = 0;

const get = (x, y) => (x < 0 || x >= W || y >= H) ? T.bedrock : y < 0 ? T.air : world[y * W + x];
const solidAt = (x, y) => isSolidId(get(x, y));
function setTile(x, y, v) {
    if (x <= 0 || x >= W - 1 || y < 0 || y >= H) return;
    world[y * W + x] = v;
    if (!isSolidId(v) && y > 0) queueFall(x, y - 1);
}
function queueFall(x, y) {
    if (TILES[get(x, y)].falls && !pendingFalls.some(f => f.x === x && f.y === y)) pendingFalls.push({ x, y, t: .2 });
}

function freshState(newSeed) {
    seed = newSeed;
    world = generate(seed);
    surf = surfaceHeights(seed % 100000);
    player = makePlayer();
    wallet = 0;
    gear = { pick: 0, pack: 0, lantern: 0, armor: 0 };
    hot = { ladder: 12, torch: 6, bread: 3, tnt: 0, pearl: 0, potion: 0 };
    cargo = {}; stash = { debris: 0 }; graves = [];
    stats = { mined: 0, deaths: 0, earned: 0, maxDepth: 0, time: 0, ores: 0 };
    adv = {}; won = false;
    entities = []; particles = []; floaters = []; pendingFalls = [];
}
function makePlayer() {
    return { x: SPAWN_X, y: SURF - 1.75, w: .6, h: 1.75, vx: 0, vy: 0, face: 1, onGround: false, onLadder: false,
        hp: 20, food: 20, invuln: 0, burn: 0, fireRes: 0, peak: null, swing: 0, walk: 0, lavaT: 0, starveT: 0, regenT: 0,
        touchedLava: false, dead: false, eatT: 0 };
}
const maxHp = () => ARMORS[gear.armor].hp;
const packSize = () => PACKS[gear.pack].size;
const cargoCount = () => Object.values(cargo).reduce((a, b) => a + b, 0);
const depthOf = p => Math.max(0, Math.floor(p.y + p.h) - SURF);

// ---------- SAUVEGARDE ----------
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function save() {
    if (!world || state === 'title') return;
    const p = player;
    store.set(SAVE_KEY, JSON.stringify({
        v: 1, seed, tiles: b64(world),
        player: p.dead ? { x: SPAWN_X, y: SURF - 1.75, hp: maxHp(), food: 20 } : { x: p.x, y: p.y, hp: p.hp, food: p.food },
        wallet, gear, hot, cargo, stash, graves, stats, adv, won,
    }));
}
function load() {
    const raw = store.get(SAVE_KEY); if (!raw) return false;
    try {
        const s = JSON.parse(raw);
        const tiles = unb64(s.tiles); if (tiles.length !== W * H) return false;
        seed = s.seed; world = tiles; surf = surfaceHeights(seed % 100000);
        player = makePlayer(); Object.assign(player, s.player);
        wallet = s.wallet | 0; gear = Object.assign({ pick: 0, pack: 0, lantern: 0, armor: 0 }, s.gear);
        hot = Object.assign({ ladder: 0, torch: 0, bread: 0, tnt: 0, pearl: 0, potion: 0 }, s.hot);
        cargo = s.cargo || {}; stash = s.stash || { debris: 0 }; graves = s.graves || [];
        stats = Object.assign({ mined: 0, deaths: 0, earned: 0, maxDepth: 0, time: 0, ores: 0 }, s.stats);
        adv = s.adv || {}; won = !!s.won;
        entities = []; particles = []; floaters = []; pendingFalls = [];
        return true;
    } catch (e) { return false; }
}
// l'ancien mini-jeu (clic sur un bloc) gardait un inventaire : on le reprend une fois en émeraudes
function legacyBonus() {
    if (store.get('bedrockbound_legacy')) return 0;
    store.set('bedrockbound_legacy', '1');
    const raw = store.get('amaicraft_inv'); if (!raw) return 0;
    const VALUE = { coal: 2, iron: 4, diamond: 15, amethyst: 8, ancient_debris: 30, obsidian: 8, bedrock: 40, end_stone: 1 };
    let total = 0;
    try {
        const inv = JSON.parse(raw);
        const list = Array.isArray(inv) ? inv.filter(Boolean) : Object.keys(inv).map(id => ({ id, count: inv[id] }));
        for (const s of list) total += (VALUE[s.id] || .25) * (s.count | 0);
    } catch (e) { return 0; }
    return Math.min(400, Math.floor(total));
}

// ---------- ENTRÉES ----------
const keys = { left: false, right: false, up: false, down: false, jump: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'jump' };
const mouse = { x: 0, y: 0, down: false, right: false, inside: false };
let active = false;

// ---------- PHYSIQUE ----------
function boxHits(x, y, w, h, test) {
    for (let ty = Math.floor(y); ty <= Math.floor(y + h - 1e-4); ty++)
        for (let tx = Math.floor(x); tx <= Math.floor(x + w - 1e-4); tx++) if (test(get(tx, ty), tx, ty)) return true;
    return false;
}
const boxSolid = (x, y, w, h) => boxHits(x, y, w, h, isSolidId);
function moveBody(e, dt) {
    let hitX = false, hitY = false;
    e.x += e.vx * dt;
    if (boxSolid(e.x, e.y, e.w, e.h)) {
        hitX = true;
        if (e.vx > 0) e.x = Math.floor(e.x + e.w) - e.w - .001; else e.x = Math.floor(e.x) + 1.001;
        e.vx = 0;
    }
    const wasGround = e.onGround;
    e.onGround = false;
    e.y += e.vy * dt;
    if (boxSolid(e.x, e.y, e.w, e.h)) {
        hitY = true;
        if (e.vy > 0) { e.y = Math.floor(e.y + e.h) - e.h - .001; e.onGround = true; } else e.y = Math.floor(e.y) + 1.001;
        e.vy = 0;
    } else if (e.vy >= 0 && boxSolid(e.x, e.y + .02, e.w, e.h)) e.onGround = true;
    e.landed = e.onGround && !wasGround;
    return { hitX, hitY };
}

function hurt(amount, cause, kx = 0) {
    const p = player;
    if (p.dead || p.invuln > 0 || amount <= 0) return;
    p.hp -= amount; p.invuln = .5; shake = Math.max(shake, .25);
    p.vx += kx; Sound.hurt();
    floaters.push({ x: p.x + p.w / 2, y: p.y, text: '-' + amount, color: '#ff5555', t: 1 });
    if (p.hp <= 0) die(cause);
}

function updatePlayer(dt) {
    const p = player;
    if (p.dead) return;
    p.invuln = Math.max(0, p.invuln - dt);
    p.fireRes = Math.max(0, p.fireRes - dt);
    p.eatT = Math.max(0, p.eatT - dt);
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir) p.face = dir;
    const cx = p.x + p.w / 2, col = Math.floor(cx);
    p.onLadder = boxHits(cx - .1, p.y + .05, .2, p.h - .1, id => id === T.ladder);
    const inLava = boxHits(p.x, p.y, p.w, p.h, id => id === T.lava);
    const top = Math.floor(p.y + .02), feet = Math.floor(p.y + p.h - .02);

    // --- ce que le joueur veut miner ---
    let want = null, suppressUp = false, stepped = false;
    const grounded = p.onGround || p.onLadder;
    if (mouse.down && state === 'play') {
        const t = mouseTarget();
        if (t && t.mob) attackMob(t.mob);
        else if (t) want = t;
    } else if (keys.down && grounded && solidAt(col, Math.floor(p.y + p.h + .05))) {
        want = { x: col, y: Math.floor(p.y + p.h + .05) };
    } else if (keys.up && grounded && solidAt(col, Math.floor(p.y - .3)) && p.y - Math.floor(p.y - .3) - 1 < .4) {
        want = { x: col, y: Math.floor(p.y - .3) }; suppressUp = true;
    } else if (dir && grounded) {
        const c = dir > 0 ? Math.floor(p.x + p.w + .03) : Math.floor(p.x - .03);
        const rows = []; for (let y = feet; y >= top; y--) rows.push(y);
        const blocked = rows.filter(y => solidAt(c, y));
        if (blocked.length) {
            const canStep = p.onGround && blocked.length === 1 && blocked[0] === feet && !solidAt(c, feet - 1) && !solidAt(c, feet - 2) && !solidAt(col, top - 1);
            if (canStep && !boxSolid(p.x + dir * .05, p.y - 1, p.w, p.h)) { p.y -= 1; stepped = true; }
            else want = { x: c, y: blocked[0] };
        }
    }
    // creuser vers le bas recentre le joueur sur la colonne, sinon il resterait accroché au bord
    if (want && want.y > feet && !mouse.down) p.x = approach(p.x, col + .5 - p.w / 2, dt * 6);
    mineTick(want, dt);
    // au fond d'un puits, monter pose la première échelle
    const shaftAbove = !solidAt(col, top - 1) && !solidAt(col, top - 2) && (solidAt(col - 1, top - 1) || solidAt(col + 1, top - 1)) && (solidAt(col - 1, top - 2) || solidAt(col + 1, top - 2));
    if (keys.up && p.onGround && !p.onLadder && hot.ladder <= 0 && shaftAbove && msg.t <= 0) say('Out of ladders! Dig a staircase, or use an Ender Pearl.');
    if (keys.up && !suppressUp && p.onGround && !p.onLadder && hot.ladder > 0 && shaftAbove && get(col, feet) === T.air) {
        setTile(col, feet, T.ladder); hot.ladder--; Sound.place(); p.onLadder = true;
        p.x = col + .5 - p.w / 2;
    }

    // --- déplacement ---
    const speed = 5 * (inLava ? .45 : 1) * (mining ? .3 : 1);
    p.vx = approach(p.vx, dir * speed, (p.onGround || p.onLadder ? 50 : 22) * dt);
    if (p.onLadder) {
        const climb = ((keys.up || keys.jump) && !suppressUp ? -1 : 0) + (keys.down ? 1 : 0);
        p.vy = climb * 4.4;
        // en remontant un puits, une échelle se pose toute seule au-dessus de la tête
        if (climb < 0 && hot.ladder > 0) {
            const above = Math.floor(p.y - .05);
            if (get(col, above) === T.air && (solidAt(col - 1, above) || solidAt(col + 1, above)) && !boxHits(cx - .1, p.y - .05, .2, .05, id => id === T.ladder)) {
                setTile(col, above, T.ladder); hot.ladder--; Sound.place();
            }
        }
        p.peak = null;
    } else {
        p.vy = Math.min(p.vy + GRAV * dt * (inLava ? .3 : 1), inLava ? 3 : 22);
        if ((keys.jump || (keys.up && !suppressUp)) && p.onGround) { p.vy = -9.4; Sound.jump(); }
    }
    moveBody(p, dt);
    if (p.onLadder || inLava) p.peak = null;
    else if (!p.onGround) p.peak = p.peak == null ? p.y : Math.min(p.peak, p.y);
    else {
        if (p.peak != null && p.y - p.peak > 3.6) hurt(Math.floor(p.y - p.peak - 3), 'fell from a high place');
        p.peak = null;
    }
    // pas
    if (p.onGround && Math.abs(p.vx) > 1) {
        p.walk += dt * Math.abs(p.vx) * 2.2;
        stepTimer -= dt;
        if (stepTimer <= 0) { stepTimer = .32; Sound.step(TILES[get(col, Math.floor(p.y + p.h + .1))].snd); }
    } else p.walk = 0;
    p.swing = mining ? p.swing + dt * 14 : 0;

    // --- dangers ---
    if (inLava) {
        p.touchedLava = true;
        if (p.fireRes <= 0) { p.lavaT -= dt; if (p.lavaT <= 0) { p.lavaT = .5; p.invuln = 0; hurt(3, 'tried to swim in lava'); } p.burn = 3; }
    } else if (p.burn > 0) {
        p.burn -= dt;
        if (p.fireRes > 0) p.burn = 0;
        else if (Math.floor(p.burn + dt) !== Math.floor(p.burn)) { p.invuln = 0; hurt(1, 'burned to a crisp'); }
        if (p.burn <= 0 && p.touchedLava && !p.dead) unlock('hot');
    }
    if (get(col, feet + 1) === T.magma && p.onGround && p.fireRes <= 0) { p.lavaT -= dt; if (p.lavaT <= 0) { p.lavaT = .8; hurt(1, 'discovered the floor was lava'); } }
    if (p.dead) return;
    // faim
    p.food = Math.max(0, p.food - dt * (.006 + (Math.abs(p.vx) > 1 ? .01 : 0)));
    if (p.food <= 0) { p.starveT -= dt; if (p.starveT <= 0) { p.starveT = 3; p.invuln = 0; hurt(1, 'starved'); } }
    else if (p.food > 14 && p.hp < maxHp()) { p.regenT -= dt; if (p.regenT <= 0) { p.regenT = 3.5; p.hp = Math.min(maxHp(), p.hp + 1); p.food -= .4; } }
    // au camp : on se soigne et on mange à sa faim
    if (atCamp()) { p.hp = Math.min(maxHp(), p.hp + dt * 10); p.food = Math.min(20, p.food + dt * 10); p.burn = 0; }
    const d = depthOf(p);
    if (d > stats.maxDepth) stats.maxDepth = d;
    if (d >= 100) unlock('deep');
    if (p.y > NETHER_Y) unlock('nether');
    if (wallet >= 500) unlock('rich');
}
const atCamp = () => player.y + player.h <= SURF + .1 && player.x < 19;
const nearTrader = () => atCamp() && player.x > 2 && player.x < 12;

function minable(x, y) {
    const id = get(x, y), t = TILES[id];
    if (!t.solid || t.hard === Infinity) return false;
    return true;
}
function mineTick(want, dt) {
    if (!want) { mining = null; return; }
    if (!mining || mining.x !== want.x || mining.y !== want.y) mining = { x: want.x, y: want.y, p: 0, tick: 0 };
    const t = TILES[get(want.x, want.y)], pick = PICKS[gear.pick];
    if (t.tier > pick.tier) {
        mining.tick -= dt;
        if (mining.tick <= 0) {
            mining.tick = .45; Sound.clank();
            const need = PICKS.find(k => k.tier >= t.tier);
            say(need ? `${t.name} needs a ${need.name}` : `${t.name} can't be broken`);
        }
        return;
    }
    mining.p += dt * pick.speed / t.hard;
    mining.tick -= dt;
    if (mining.tick <= 0) {
        mining.tick = .14; Sound.dig(t.snd);
        burstParticles(want.x + .5, want.y + .5, t, 2, 1.5);
    }
    if (mining.p >= 1) { breakTile(want.x, want.y, 'player'); mining = null; }
}

// les échelles et torches posées se reprennent et reviennent dans la barre
const pickable = id => id === T.ladder || id === T.torch;
function pickUp(x, y) {
    const id = get(x, y), k = id === T.ladder ? 'ladder' : 'torch';
    const max = SUPPLIES.find(s => s.id === k).max;
    setTile(x, y, T.air); Sound.pop();
    burstParticles(x + .5, y + .5, TILES[id], 4, 2);
    if (hot[k] < max) hot[k]++;
}
function pickUpNearby() {
    const p = player, col = Math.floor(p.x + p.w / 2);
    for (const y of [Math.floor(p.y + p.h - .1), Math.floor(p.y + .1), Math.floor(p.y + .1) - 1, Math.floor(p.y + p.h + .1)]) {
        if (pickable(get(col, y))) { pickUp(col, y); return; }
    }
    say('No ladder or torch here to pick up.');
}
function breakTile(x, y, cause) {
    if (cause === 'player' && pickable(get(x, y))) { pickUp(x, y); return; }
    const id = get(x, y), t = TILES[id];
    if (id === T.tnt) { setTile(x, y, T.air); primeTNT(x + .5, y + .5, cause === 'blast' ? rnd(.4, .9) : 3, cause === 'player'); return; }
    if (cause === 'blast' && !t.blast) return;
    setTile(x, y, T.air);
    burstParticles(x + .5, y + .5, t, cause === 'blast' ? 3 : 10, 4);
    if (cause !== 'blast') Sound.brk(t.snd);
    if (cause === 'player') { stats.mined++; player.food = Math.max(0, player.food - .05); }
    if (id === T.chest) openChest(x, y);
    else if (id === T.grave) openGrave(x, y);
    else if (id === T.heart) win();
    else if (t.drop === 'emerald') {
        const n = 6 + Math.floor(Math.random() * 7);
        wallet += n; stats.earned += n; Sound.coin();
        floaters.push({ x: x + .5, y: y + .2, text: `+${n} emeralds`, color: '#55ff55', t: 1.4 });
    } else if (t.drop) {
        spawnItem(x + .5, y + .5, t.drop);
        if (t.drop === 'diamond') unlock('diamonds');
        if (t.drop === 'debris') unlock('debris');
    }
}
function spawnItem(x, y, item, n = 1) {
    for (let i = 0; i < n; i++) entities.push({ kind: 'item', item, x: x - .25, y: y - .25, w: .5, h: .5, vx: rnd(-2, 2), vy: rnd(-5, -2), t: 0, age: 0 });
}
function openChest(x, y) {
    const r = Math.random(), depth = y - SURF, loot = [];
    const em = Math.floor(rnd(8, 18) + depth * rnd(.15, .35));
    wallet += em; stats.earned += em; loot.push(`${em} emeralds`);
    const give = (k, n) => { hot[k] = Math.min(SUPPLIES.find(s => s.id === k).max, hot[k] + n); loot.push(`${n} ${SUPPLIES.find(s => s.id === k).name}`); };
    give('ladder', 6 + Math.floor(Math.random() * 6));
    if (r < .5) give('torch', 4 + Math.floor(Math.random() * 5));
    if (r > .4) give('bread', 2);
    if (r > .7) give('tnt', 1 + Math.floor(Math.random() * 2));
    if (r > .88) give('pearl', 1);
    Sound.coin();
    toast('Chest opened!', loot.join(', '), 'chest.webp');
}
function openGrave(x, y) {
    const i = graves.findIndex(g => g.x === x && g.y === y);
    if (i < 0) return;
    const g = graves.splice(i, 1)[0];
    for (const k in g.items) spawnItem(x + .5, y + .5, k, g.items[k]);
    Sound.coin(); say('You found your lost backpack!');
}

function primeTNT(x, y, fuse, byPlayer) {
    entities.push({ kind: 'tnt', x: x - .45, y: y - .45, w: .9, h: .9, vx: 0, vy: 0, fuse, max: fuse, byPlayer });
    Sound.fuse();
}
function explode(cx, cy, radius, byPlayer, power = 15) {
    Sound.boom(); shake = Math.max(shake, .7);
    for (let i = 0; i < 40; i++) particles.push({ x: cx + rnd(-1, 1), y: cy + rnd(-1, 1), vx: rnd(-9, 9), vy: rnd(-10, 4), life: rnd(.4, 1), max: 1, color: ['#fff2c4', '#ffb347', '#8a8a8a', '#555'][i % 4], size: rnd(1, 3), grav: 6 });
    let broke = 0;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const d = Math.hypot(x + .5 - cx, y + .5 - cy);
        if (d > radius) continue;
        const id = get(x, y), t = TILES[id];
        if (id === T.air || id === T.lava) continue;
        if (!t.blast || t.hard === Infinity) continue;
        if (t.deco && id !== T.ladder && id !== T.torch) continue;
        if (t.drop && t.drop !== 'emerald') { setTile(x, y, T.air); spawnItem(x + .5, y + .5, t.drop); burstParticles(x + .5, y + .5, t, 3, 5); continue; }
        if (t.drop === 'emerald') { const n = 6 + Math.floor(Math.random() * 7); wallet += n; stats.earned += n; floaters.push({ x: x + .5, y: y + .5, text: `+${n} emeralds`, color: '#55ff55', t: 1.4 }); }
        breakTile(x, y, 'blast'); broke++;
    }
    if (byPlayer && broke > 3) unlock('boom');
    const p = player, d = Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy);
    if (d < radius * 2.2 && !p.dead) {
        p.invuln = 0;
        hurt(Math.max(1, Math.round(power * (1 - d / (radius * 2.2)))), byPlayer ? 'was blown up by their own TNT' : 'was blown up by a creeper', Math.sign(p.x + p.w / 2 - cx || 1) * 8);
        p.vy = Math.min(p.vy, -6);
    }
    for (const e of entities) {
        if (e.kind !== 'mob') continue;
        const md = Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy);
        if (md < radius * 2) { e.hp -= Math.round(14 * (1 - md / (radius * 2))); e.vx += Math.sign(e.x - cx || 1) * 7; e.vy = -6; e.hurtT = .3; }
    }
}

// ---------- ENTITÉS ----------
function updateEntities(dt) {
    const p = player, pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (const e of entities) {
        if (e.dead) continue;
        if (e.kind === 'item') {
            e.age += dt;
            const dx = pcx - (e.x + .25), dy = pcy - (e.y + .25), d = Math.hypot(dx, dy);
            const room = cargoCount() < packSize() || ITEMS[e.item].keep;
            if (!p.dead && room && d < 2.2 && e.age > .25) {
                e.vx = dx / d * 9; e.vy = dy / d * 9; e.x += e.vx * dt; e.y += e.vy * dt;
                if (d < .6) { e.dead = true; cargo[e.item] = (cargo[e.item] || 0) + 1; stats.ores++; Sound.pop(); floaters.push({ x: pcx, y: p.y - .2, text: '+1 ' + ITEMS[e.item].name, color: '#ffffff', t: 1 }); }
                continue;
            }
            if (!room && d < 1.4 && msg.t <= 0) say('Backpack full! Sell your loot at the trader.');
            e.vx = approach(e.vx, 0, dt * 6); e.vy = Math.min(e.vy + GRAV * .6 * dt, 12);
            moveBody(e, dt);
            if (boxHits(e.x, e.y, e.w, e.h, id => id === T.lava)) { e.dead = true; burstParticles(e.x + .25, e.y + .25, TILES[T.lava], 4, 2); }
        } else if (e.kind === 'fall') {
            e.vy = Math.min(e.vy + GRAV * dt, 18); e.y += e.vy * dt;
            const ty = Math.floor(e.y + 1);
            if (!p.dead && e.x < p.x + p.w && e.x + 1 > p.x && e.y < p.y + p.h && e.y + 1 > p.y) {
                e.dead = true; p.invuln = 0; hurt(4, 'was squashed by falling gravel');
                burstParticles(e.x + .5, e.y + .5, TILES[e.tile], 8, 3); continue;
            }
            if (solidAt(Math.floor(e.x + .5), ty) || ty >= H - 1) {
                const lx = Math.floor(e.x + .5), ly = ty - 1;
                e.dead = true;
                const here = get(lx, ly);
                if (!isSolidId(here)) { setTile(lx, ly, e.tile); Sound.brk('soft'); }
            }
        } else if (e.kind === 'tnt') {
            e.fuse -= dt;
            e.vy = Math.min(e.vy + GRAV * dt, 18); e.vx = approach(e.vx, 0, dt * 5);
            moveBody(e, dt);
            if (e.fuse <= 0) { e.dead = true; explode(e.x + .45, e.y + .45, 3, e.byPlayer); }
        } else if (e.kind === 'mob') updateMob(e, dt);
    }
    entities = entities.filter(e => !e.dead && (e.kind !== 'mob' || Math.abs(e.y - p.y) < 34));
    if (entities.length > 220) entities = entities.slice(-220);
    for (let i = pendingFalls.length - 1; i >= 0; i--) {
        const f = pendingFalls[i];
        f.t -= dt;
        if (f.t > 0) continue;
        pendingFalls.splice(i, 1);
        const id = get(f.x, f.y);
        if (TILES[id].falls && !isSolidId(get(f.x, f.y + 1))) {
            world[f.y * W + f.x] = T.air;
            entities.push({ kind: 'fall', tile: id, x: f.x, y: f.y, vy: 0 });
            if (f.y > 0) queueFall(f.x, f.y - 1);
        }
    }
}

function spawnMobs(dt) {
    spawnTimer -= dt;
    if (spawnTimer > 0) return;
    spawnTimer = 2.5;
    const p = player;
    if (p.y < SURF + 14) return;
    const mobs = entities.filter(e => e.kind === 'mob').length;
    if (mobs >= 4) return;
    for (let tries = 0; tries < 20; tries++) {
        const x = Math.floor(p.x + rnd(-16, 16)), y = Math.floor(p.y + rnd(-10, 10));
        if (Math.abs(x - p.x) < 7 && Math.abs(y - p.y) < 6) continue;
        if (x < 1 || x >= W - 1 || y < SURF + 12) continue;
        if (get(x, y) !== T.air || get(x, y - 1) !== T.air || !solidAt(x, y + 1)) continue;
        if (lightAt(x, y) > 4) continue;
        const nether = y > NETHER_Y;
        entities.push(nether
            ? { kind: 'mob', type: 'cube', x: x + .1, y: y + .2, w: .8, h: .8, vx: 0, vy: 0, hp: 8, hopT: 1, hitT: 0, hurtT: 0 }
            : { kind: 'mob', type: 'creeper', x: x + .2, y: y - .6, w: .6, h: 1.6, vx: 0, vy: 0, hp: 10, fuse: 0, hurtT: 0, face: 1 });
        return;
    }
}
function updateMob(e, dt) {
    const p = player, dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h / 2) - (e.y + e.h / 2), d = Math.hypot(dx, dy);
    e.hurtT = Math.max(0, e.hurtT - dt);
    const inLava = boxHits(e.x, e.y, e.w, e.h, id => id === T.lava);
    if (e.type === 'creeper') {
        if (inLava) { e.lavaT = (e.lavaT || 0) - dt; if (e.lavaT <= 0) { e.lavaT = .5; e.hp -= 3; e.hurtT = .2; } }
        const chase = !p.dead && d < 11 && Math.abs(dy) < 5;
        if (e.fuse > 0) {
            e.fuse += dt; e.vx = approach(e.vx, 0, dt * 20);
            if (d > 4) e.fuse = 0;
            else if (e.fuse > 1.5) { e.dead = true; explode(e.x + e.w / 2, e.y + e.h / 2, 2.6, false, 11); return; }
        } else if (chase) {
            e.face = Math.sign(dx) || 1;
            if (e.hurtT <= 0) e.vx = approach(e.vx, e.face * 2.1, dt * 12);
            if (d < 1.8 && !p.dead) { e.fuse = .001; Sound.fuse(); }
        } else e.vx = approach(e.vx, 0, dt * 8);
        e.vy = Math.min(e.vy + GRAV * dt, 20);
        const r = moveBody(e, dt);
        if (r.hitX && e.onGround && chase) e.vy = -8.8;
    } else {
        e.hopT -= dt; e.hitT = Math.max(0, e.hitT - dt);
        if (e.onGround) {
            e.vx = approach(e.vx, 0, dt * 14);
            if (e.hopT <= 0 && d < 12 && !p.dead) { e.hopT = rnd(.9, 1.6); e.vy = -10; e.vx = Math.sign(dx) * 3.4; }
        }
        e.vy = Math.min(e.vy + GRAV * dt, 20);
        moveBody(e, dt);
        if (!p.dead && e.hitT <= 0 && e.x < p.x + p.w && e.x + e.w > p.x && e.y < p.y + p.h && e.y + e.h > p.y) {
            e.hitT = .9; hurt(3, 'was squished by a magma cube', Math.sign(dx) * 6);
        }
    }
    if (e.hp <= 0) {
        e.dead = true;
        burstParticles(e.x + e.w / 2, e.y + e.h / 2, { key: e.type === 'creeper' ? 'leaves' : 'magma' }, 14, 4);
        spawnItem(e.x + e.w / 2, e.y + e.h / 2, e.type === 'creeper' ? 'gunpowder' : 'cream', 1 + (Math.random() < .4 ? 1 : 0));
        if (e.type === 'creeper') unlock('sneaky');
    }
}
let attackCd = 0;
function attackMob(m) {
    if (attackCd > 0) return;
    attackCd = .35;
    m.hp -= PICKS[gear.pick].dmg; m.hurtT = .25;
    m.vx = Math.sign(m.x - player.x || 1) * 7; m.vy = -5;
    if (m.type === 'creeper') m.fuse = 0;
    player.swing = 1; Sound.hurt(); shake = Math.max(shake, .1);
}

// ---------- OBJETS DE LA BARRE ----------
function useItem(slot) {
    const s = SUPPLIES[slot], p = player;
    if (!s || p.dead || state !== 'play') return;
    if (hot[s.id] <= 0) { say(`No ${s.name} left. Buy more at the trader.`); Sound.deny(); return; }
    const col = Math.floor(p.x + p.w / 2), feet = Math.floor(p.y + p.h - .1), head = Math.floor(p.y + .1);
    const free = (x, y) => { const id = get(x, y); return id === T.air || (TILES[id].deco && id !== T.ladder && id !== T.torch && id !== T.log); };
    if (s.id === 'ladder' || s.id === 'torch') {
        const v = s.id === 'ladder' ? T.ladder : T.torch;
        let spot = null;
        if (mouse.right) {
            const t = mouseCell();
            if (!free(t.x, t.y) || t.d > REACH) { say("Can't place that there."); return; }
            spot = t;
        }
        if (!spot) for (const y of [feet, head, head - 1]) if (free(col, y)) { spot = { x: col, y }; break; }
        if (!spot) { say('No room here.'); return; }
        setTile(spot.x, spot.y, v); hot[s.id]--; Sound.place();
    } else if (s.id === 'bread') {
        if (p.food >= 20) { say('You are not hungry.'); return; }
        if (p.eatT > 0) return;
        p.eatT = .6; p.food = Math.min(20, p.food + 7); hot.bread--; Sound.eat();
    } else if (s.id === 'tnt') {
        hot.tnt--; primeTNT(p.x + p.w / 2, p.y + p.h - .5, 3, true);
        say('TNT lit! Run!');
    } else if (s.id === 'pearl') {
        if (atCamp()) { say('You are already home.'); return; }
        hot.pearl--; Sound.pearl();
        for (let i = 0; i < 30; i++) particles.push({ x: p.x + rnd(0, .6), y: p.y + rnd(0, 1.7), vx: rnd(-3, 3), vy: rnd(-3, 3), life: 1, max: 1, color: i % 2 ? '#c03cff' : '#20103a', size: 2, grav: 0 });
        p.x = SPAWN_X; p.y = SURF - 1.75; p.vx = p.vy = 0; p.peak = null; p.burn = 0;
        camY = p.y * TS - VH / 2;
        unlock('pearl');
    } else if (s.id === 'potion') {
        hot.potion--; p.fireRes = 45; p.burn = 0; Sound.eat(); say('Fire Resistance: 45 seconds');
    }
}

// ---------- MORT, VICTOIRE ----------
function die(cause) {
    const p = player;
    p.dead = true; p.hp = 0; stats.deaths++;
    mining = null;
    const lost = Object.assign({}, cargo), count = cargoCount();
    cargo = {};
    let where = '';
    if (count > 0) {
        // le sac reste sur place, dans un coffre à retrouver
        const cx = Math.floor(p.x + p.w / 2), cy = Math.floor(p.y + p.h - .1);
        let spot = null;
        for (let r = 0; r < 6 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
            const id = get(cx + dx, cy + dy);
            if ((id === T.air || TILES[id].deco) && id !== T.lava && cx + dx > 0 && cx + dx < W - 1) spot = { x: cx + dx, y: cy + dy };
        }
        if (spot) {
            setTile(spot.x, spot.y, T.grave);
            graves.push({ x: spot.x, y: spot.y, items: lost });
            where = `Your ${count} items are waiting in a chest at ${Math.max(0, spot.y - SURF)} m.`;
        } else where = `Your ${count} items burned away.`;
    }
    save();
    state = 'dead';
    showOverlay('death', { cause, where });
}
function respawn() {
    const p = player;
    Object.assign(p, makePlayer());
    p.hp = maxHp();
    camY = p.y * TS - VH / 2;
    hideOverlay(); state = 'play';
    save();
}
function win() {
    if (won) { say('The Heart has already been claimed.'); return; }
    won = true; unlock('core'); Sound.win(); shake = 1.2;
    for (let i = 0; i < 80; i++) particles.push({ x: CORE_X + .5, y: player.y, vx: rnd(-12, 12), vy: rnd(-12, 6), life: rnd(1, 2), max: 2, color: ['#ffffff', '#52e6e6', '#b8fff4'][i % 3], size: rnd(1, 3), grav: 2 });
    wallet += 1000; stats.earned += 1000;
    save();
    setTimeout(() => { state = 'won'; showOverlay('win'); }, 1200);
}

// ---------- PARTICULES ET TEXTES ----------
const tileColorsCache = {};
function tileColors(t) {
    if (tileColorsCache[t.key]) return tileColorsCache[t.key];
    const tex = TEX[t.key] && TEX[t.key][0];
    let cols = ['#888'];
    if (tex) {
        const d = tex.getContext('2d').getImageData(0, 0, 16, 16).data; cols = [];
        for (let i = 0; i < 6; i++) { const k = (Math.floor(Math.random() * 256)) * 4; if (d[k + 3]) cols.push(`rgb(${d[k]},${d[k + 1]},${d[k + 2]})`); }
        if (!cols.length) cols = ['#888'];
    }
    return (tileColorsCache[t.key] = cols);
}
function burstParticles(x, y, t, n, power) {
    const cols = tileColors(t);
    for (let i = 0; i < n; i++) particles.push({ x: x + rnd(-.4, .4), y: y + rnd(-.4, .4), vx: rnd(-power, power), vy: rnd(-power * 1.4, power * .3), life: rnd(.3, .7), max: .7, color: cols[i % cols.length], size: Math.random() < .5 ? 1 : 2, grav: 30 });
}
function updateParticles(dt) {
    for (const q of particles) { q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    particles = particles.filter(q => q.life > 0);
    if (particles.length > 500) particles.splice(0, particles.length - 500);
    for (const f of floaters) { f.y -= dt * .9; f.t -= dt; }
    floaters = floaters.filter(f => f.t > 0);
}
function say(text) { msg.text = text; msg.t = 2.4; }

// ---------- LUMIÈRE ----------
const LM = 14;
let light = null, lightPlayer = null, lx0 = 0, ly0 = 0, lw = 0, lh = 0, lightImg = null;
const lightCanvas = document.createElement('canvas');
const buckets = [];
for (let i = 0; i <= 15; i++) buckets.push([]);
const CURVE = [];
for (let l = 0; l <= 16; l++) CURVE.push(Math.pow(Math.min(1, l / 9), 1.15));
function computeLight(ambient) {
    lx0 = Math.floor(camX / TS) - LM; ly0 = Math.floor(camY / TS) - LM;
    lw = Math.ceil(VW / TS) + 2 + LM * 2; lh = Math.ceil(VH / TS) + 2 + LM * 2;
    if (!light || light.length !== lw * lh) {
        light = new Uint8Array(lw * lh); lightPlayer = new Float32Array(lw * lh);
        lightCanvas.width = lw; lightCanvas.height = lh;
        lightImg = lightCanvas.getContext('2d').createImageData(lw, lh);
    }
    light.fill(0);
    for (const b of buckets) b.length = 0;
    for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
        const x = lx0 + i, y = ly0 + j, id = get(x, y);
        let l = TILES[id].light;
        if (y < (surf[clamp(x, 0, W - 1)] || SURF) && !isSolidId(id)) l = 15;
        if (l) { light[j * lw + i] = l; buckets[l].push(j * lw + i); }
    }
    // la roche laisse passer un peu de lumière (5 niveaux par bloc) : on devine les minerais qui bordent le tunnel
    for (let l = 15; l > 1; l--) {
        const b = buckets[l];
        for (let k = 0; k < b.length; k++) {
            const c = b[k]; if (light[c] !== l) continue;
            const i = c % lw, j = (c - i) / lw;
            const nl = l - (isSolidId(get(lx0 + i, ly0 + j)) && !TILES[get(lx0 + i, ly0 + j)].light ? 5 : 1);
            if (nl <= 0) continue;
            const nb = [i > 0 ? c - 1 : -1, i < lw - 1 ? c + 1 : -1, j > 0 ? c - lw : -1, j < lh - 1 ? c + lw : -1];
            for (const n of nb) {
                if (n < 0 || light[n] >= nl) continue;
                light[n] = nl;
                if (nl > 1) buckets[nl].push(n);
            }
        }
    }
    // le haut du sol reste visible sous l'herbe au lieu de devenir noir d'un coup
    for (let i = 0; i < lw; i++) {
        const x = lx0 + i; if (x < 0 || x >= W) continue;
        for (let k = 0; k < 4; k++) {
            const j = surf[x] + k - ly0; if (j < 0 || j >= lh) continue;
            const v = 13 - k * 3, c = j * lw + i;
            if (isSolidId(get(x, surf[x] + k)) && light[c] < v) light[c] = v;
        }
    }
    // la lanterne du joueur : même propagation, mais avec la vraie distance pour une lumière qui glisse
    lightPlayer.fill(0);
    const p = player, level = LANTERNS[gear.lantern].level + (state === 'title' ? 6 : 0);
    if (p && !p.dead) {
        const pcx = p.x + p.w / 2, pcy = p.y + .6;
        const si = Math.floor(pcx) - lx0, sj = Math.floor(pcy) - ly0;
        if (si >= 0 && sj >= 0 && si < lw && sj < lh) {
            // distance pondérée (1 par case d'air, 5 par bloc) parcourue par seaux
            const dist = new Int16Array(lw * lh).fill(999), qs = [];
            for (let i = 0; i <= level + 5; i++) qs.push([]);
            const start = sj * lw + si; dist[start] = 0; qs[0].push(start);
            for (let dc = 0; dc <= level; dc++) {
                const q = qs[dc];
                for (let k = 0; k < q.length; k++) {
                    const c = q[k]; if (dist[c] !== dc) continue;
                    const i = c % lw, j = (c - i) / lw;
                    const extra = dc - (Math.abs(i - si) + Math.abs(j - sj));
                    const eu = Math.hypot(lx0 + i + .5 - pcx, ly0 + j + .5 - pcy);
                    lightPlayer[c] = Math.max(0, level - eu - Math.max(0, extra));
                    const cost = c !== start && isSolidId(get(lx0 + i, ly0 + j)) ? 5 : 1;
                    const nd = dc + cost;
                    if (nd > level) continue;
                    for (const n of [i > 0 ? c - 1 : -1, i < lw - 1 ? c + 1 : -1, j > 0 ? c - lw : -1, j < lh - 1 ? c + lw : -1]) {
                        if (n >= 0 && dist[n] > nd) { dist[n] = nd; qs[nd].push(n); }
                    }
                }
            }
        }
    }
    const d = lightImg.data;
    for (let c = 0; c < lw * lh; c++) {
        const y = ly0 + Math.floor(c / lw);
        const amb = ambient + (y > NETHER_Y && y < BEDROCK_Y ? .1 : 0);
        const lp = lightPlayer[c], lpi = Math.floor(lp), lpf = lp - lpi;
        const bp = CURVE[lpi] + (CURVE[lpi + 1] - CURVE[lpi]) * lpf;
        const b = Math.max(amb, CURVE[light[c]], bp);
        d[c * 4] = y > NETHER_Y ? 20 : 0; d[c * 4 + 1] = 0; d[c * 4 + 2] = y > NETHER_Y ? 0 : 6;
        d[c * 4 + 3] = Math.round((1 - Math.min(1, b)) * 255);
    }
    lightCanvas.getContext('2d').putImageData(lightImg, 0, 0);
}
function lightAt(x, y) {
    const i = x - lx0, j = y - ly0;
    if (!light || i < 0 || j < 0 || i >= lw || j >= lh) return 0;
    return Math.max(light[j * lw + i], lightPlayer[j * lw + i]);
}

// ---------- SOURIS ----------
function mouseCell() {
    const x = Math.floor((mouse.x + camX) / TS), y = Math.floor((mouse.y + camY) / TS), p = player;
    const d = Math.hypot(x + .5 - (p.x + p.w / 2), y + .5 - (p.y + p.h / 2));
    return { x, y, d };
}
function mouseTarget() {
    if (!mouse.inside || player.dead) return null;
    const wx = (mouse.x + camX) / TS, wy = (mouse.y + camY) / TS, p = player;
    for (const e of entities) {
        if (e.kind === 'mob' && wx > e.x - .3 && wx < e.x + e.w + .3 && wy > e.y - .3 && wy < e.y + e.h + .3 && Math.hypot(e.x + e.w / 2 - (p.x + p.w / 2), e.y + e.h / 2 - (p.y + p.h / 2)) < REACH) return { mob: e };
    }
    const c = mouseCell();
    if (c.d > REACH) return null;
    if (pickable(get(c.x, c.y))) return c;
    if (!minable(c.x, c.y)) return null;
    const exposed = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !solidAt(c.x + dx, c.y + dy));
    return exposed ? c : null;
}

// ---------- RENDU ----------
const canvas = document.getElementById('bb-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const clouds = [];
for (let i = 0; i < 7; i++) clouds.push({ x: Math.random() * W * TS, y: 10 + Math.random() * 70, w: 30 + Math.random() * 50, s: 2 + Math.random() * 4 });

function wallKey(x, y) {
    if (y <= (surf[x] || SURF) + 4) return 'dirt';
    if (y < DEEPSLATE_Y) return 'stone';
    if (y < NETHER_Y) return 'deepslate';
    if (y < BASALT_Y) return 'netherrack';
    return 'blackstone';
}
function texFor(id, x, y) {
    const t = TILES[id], arr = TEX[t.key];
    if (!arr) return null;
    if (id === T.lava) return arr[Math.floor(time * 6 + x * 0) % arr.length];
    if (id === T.torch) return arr[Math.floor(time * 8 + x * 3 + y) % arr.length];
    if (id === T.heart) return arr[Math.floor(time * 4) % arr.length];
    if (id === T.magma) return arr[Math.floor(time * 2 + x) % arr.length];
    return arr[Math.floor(hash2(x, y, 9) * arr.length)];
}

function render() {
    const sx = Math.round(camX + (shake > 0 ? rnd(-1, 1) * shake * 4 : 0)), sy = Math.round(camY + (shake > 0 ? rnd(-1, 1) * shake * 4 : 0));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // ciel
    const skyBottom = SURF * TS + 30 - sy;
    if (skyBottom > 0) {
        const grad = ctx.createLinearGradient(0, -sy, 0, skyBottom);
        grad.addColorStop(0, '#5f8fe6'); grad.addColorStop(1, '#b9d3ff');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, VW, Math.min(VH, skyBottom));
        ctx.fillStyle = '#fffbe0'; ctx.fillRect(320 - sx * .1, 18 - sy * .3, 18, 18);
        ctx.fillStyle = '#fff3a8'; ctx.fillRect(322 - sx * .1, 20 - sy * .3, 14, 14);
        // collines au loin
        ctx.fillStyle = '#86a9d8';
        for (let i = 0; i < 30; i++) { const hx = i * 40 - (sx * .3) % 40 - 40, hh = 20 + hash2(i + Math.floor(sx * .3 / 40), 1, 4) * 26; ctx.fillRect(hx, SURF * TS - sy - hh + 8, 41, hh); }
        ctx.fillStyle = '#ffffff';
        for (const c of clouds) {
            const cx = ((c.x + time * c.s - sx * .5) % (W * TS + 100) + W * TS + 100) % (W * TS + 100) - 60;
            ctx.fillRect(Math.round(cx), Math.round(c.y - sy * .5), c.w, 8); ctx.fillRect(Math.round(cx + 6), Math.round(c.y - sy * .5 - 4), c.w - 14, 4);
        }
    }
    if (skyBottom < VH) { ctx.fillStyle = '#000'; ctx.fillRect(0, Math.max(0, skyBottom), VW, VH); }
    ctx.translate(-sx, -sy);
    const x0 = Math.max(0, Math.floor(sx / TS)), x1 = Math.min(W - 1, Math.floor((sx + VW) / TS));
    const y0 = Math.max(0, Math.floor(sy / TS)), y1 = Math.min(H - 1, Math.floor((sy + VH) / TS));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const id = world[y * W + x], t = TILES[id];
        if (!t.solid && y > (surf[x] || SURF)) {
            ctx.drawImage(WALL[wallKey(x, y)], x * TS, y * TS);
            // ombre au pied des parois : sépare bien la roche du fond de la grotte
            ctx.fillStyle = 'rgba(0,0,0,.38)';
            if (solidAt(x - 1, y)) ctx.fillRect(x * TS, y * TS, 3, TS);
            if (solidAt(x + 1, y)) ctx.fillRect(x * TS + TS - 3, y * TS, 3, TS);
            if (solidAt(x, y - 1)) ctx.fillRect(x * TS, y * TS, TS, 3);
            if (solidAt(x, y + 1)) ctx.fillRect(x * TS, y * TS + TS - 2, TS, 2);
        }
        if (id !== T.air) { const tex = texFor(id, x, y); if (tex) ctx.drawImage(tex, x * TS, y * TS); }
    }
    drawTrader();
    // fissure et contour de la cible
    if (mining && state === 'play') {
        const stage = clamp(Math.floor(mining.p * 8), 0, 7);
        if (TILES[get(mining.x, mining.y)].tier <= PICKS[gear.pick].tier) ctx.drawImage(CRACKS[stage], mining.x * TS, mining.y * TS);
    }
    if (state === 'play' && mouse.inside && !player.dead && !isTouch) {
        const t = mouseTarget();
        if (t && !t.mob) { ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.strokeRect(t.x * TS + .5, t.y * TS + .5, TS - 1, TS - 1); }
    }
    for (const e of entities) drawEntity(e);
    if (state !== 'title') drawPlayer();
    for (const q of particles) { ctx.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1); ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x * TS), Math.round(q.y * TS), q.size, q.size); }
    ctx.globalAlpha = 1;
    // obscurité, lissée par l'agrandissement de la carte de lumière
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lightCanvas, lx0 * TS, ly0 * TS, lw * TS, lh * TS);
    ctx.imageSmoothingEnabled = false;
    // textes flottants, toujours lisibles
    ctx.font = '8px Minecraftia'; ctx.textAlign = 'center';
    for (const f of floaters) {
        ctx.globalAlpha = clamp(f.t * 2, 0, 1);
        ctx.fillStyle = '#000'; ctx.fillText(f.text, Math.round(f.x * TS) + 1, Math.round(f.y * TS) + 1);
        ctx.fillStyle = f.color; ctx.fillText(f.text, Math.round(f.x * TS), Math.round(f.y * TS));
    }
    ctx.globalAlpha = 1;
    if (state === 'play' && nearTrader()) {
        const tx = 7 * TS + 8, ty = (SURF - 3.6) * TS;
        const label = isTouch ? 'Tap TRADE' : 'Press E to trade';
        ctx.fillStyle = 'rgba(0,0,0,.55)'; const w = ctx.measureText(label).width + 8; ctx.fillRect(Math.round(tx - w / 2), ty - 9, w, 12);
        ctx.fillStyle = '#ffff55'; ctx.fillText(label, tx, ty);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (player && player.invuln > .35 && !player.dead) { ctx.fillStyle = 'rgba(255,0,0,.18)'; ctx.fillRect(0, 0, VW, VH); }
}

function drawTrader() {
    const gx = 3 * TS, gy = SURF * TS;
    if (gy - 80 > camY + VH || gx > camX + VW + 40) return;
    // étal : poteaux, comptoir, auvent rayé
    for (const px of [3, 10]) for (let y = 1; y <= 4; y++) ctx.drawImage(TEX.log[0], px * TS, gy - y * TS);
    const bob = Math.round(Math.sin(time * 2) * .6);
    ctx.drawImage(SPR.villager, 7 * TS - 4, gy - 30 + bob);
    for (let x = 4; x < 10; x++) ctx.drawImage(TEX.planks[0], x * TS, gy - TS);
    for (let x = 3; x < 11; x++) for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? '#e8e8e8' : '#3b8a3a';
        ctx.fillRect(x * TS + k * 4, gy - 5 * TS, 4, 10);
    }
    ctx.fillStyle = '#245f23'; ctx.fillRect(3 * TS, gy - 5 * TS + 10, 8 * TS, 2);
    // panneau
    ctx.fillStyle = '#9c7340'; ctx.fillRect(5 * TS + 4, gy - 5 * TS - 12, 4 * TS - 8, 11);
    ctx.fillStyle = '#5c3f1c'; ctx.fillRect(5 * TS + 4, gy - 5 * TS - 2, 4 * TS - 8, 1);
    ctx.font = '8px Minecraftia'; ctx.textAlign = 'center'; ctx.fillStyle = '#2b1a08'; ctx.fillText('TRADER', 7 * TS, gy - 5 * TS - 3);
    // émeraudes posées sur le comptoir
    const em = loadIcon('emerald.png').small;
    if (em) { ctx.drawImage(em, 5 * TS, gy - TS - 9, 9, 9); ctx.drawImage(em, 8 * TS + 6, gy - TS - 9, 9, 9); }
    // feu de camp
    const fx = 13 * TS + 2, fy = gy;
    ctx.fillStyle = '#4f3a1b'; ctx.fillRect(fx, fy - 3, 12, 3);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#ffd84a', '#ff9a2a', '#ff6a1a', '#fff3a0'][(i + Math.floor(time * 10)) % 4]; ctx.fillRect(fx + 2 + i * 2, fy - 6 - ((i * 7 + Math.floor(time * 12)) % 4), 2, 3 + (i % 2)); }
}

function drawEntity(e) {
    if (e.kind === 'item') {
        const ic = loadIcon(ITEMS[e.item].icon).small;
        const bob = Math.sin(e.age * 4) * 1.2;
        if (ic) ctx.drawImage(ic, Math.round(e.x * TS), Math.round(e.y * TS + bob), 8, 8);
        else { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(e.x * TS), Math.round(e.y * TS), 6, 6); }
    } else if (e.kind === 'fall') {
        ctx.drawImage(TEX[TILES[e.tile].key][0], Math.round(e.x * TS), Math.round(e.y * TS));
    } else if (e.kind === 'tnt') {
        const flash = Math.floor(e.fuse * (e.fuse < 1 ? 10 : 4)) % 2 === 0;
        const s = 1 + (e.fuse < .4 ? (.4 - e.fuse) * .4 : 0);
        const x = Math.round(e.x * TS + 7 - 8 * s), y = Math.round(e.y * TS + 7 - 8 * s);
        ctx.drawImage(TEX.tnt[0], x, y, 16 * s, 16 * s);
        if (flash) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x, y, 16 * s, 16 * s); }
    } else if (e.kind === 'mob') {
        const x = Math.round(e.x * TS), y = Math.round(e.y * TS);
        if (e.type === 'creeper') {
            const sw = e.fuse > 0 ? 1 + Math.min(.3, e.fuse * .2) : 1;
            const img = SPR.creeper, w = img.width * sw, h = img.height * (1 + (sw - 1) * .5);
            ctx.drawImage(img, Math.round(x + 5 - w / 2), Math.round(y + 26 - h), w, h);
            if ((e.fuse > 0 && Math.floor(e.fuse * 8) % 2 === 0) || e.hurtT > 0) {
                ctx.globalAlpha = .55; ctx.fillStyle = e.hurtT > 0 ? '#ff2020' : '#ffffff';
                ctx.fillRect(Math.round(x + 5 - w / 2), Math.round(y + 26 - h), w, h); ctx.globalAlpha = 1;
            }
        } else {
            const squish = e.onGround ? 1 : 1.15, img = SPR.cube;
            const w = 12 / squish, h = 12 * squish;
            ctx.drawImage(img, Math.round(x + 6.5 - w / 2), Math.round(y + 13 - h), w, h);
            if (e.hurtT > 0) { ctx.globalAlpha = .5; ctx.fillStyle = '#ff2020'; ctx.fillRect(Math.round(x + 6.5 - w / 2), Math.round(y + 13 - h), w, h); ctx.globalAlpha = 1; }
        }
    }
}

function drawPlayer() {
    const p = player;
    if (p.dead || !PLAYER_PARTS.head) return;
    if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2) return;
    const fx = Math.round((p.x + p.w / 2) * TS), fy = Math.round((p.y + p.h) * TS);
    ctx.save();
    ctx.translate(fx, fy);
    if (p.face < 0) ctx.scale(-1, 1);
    const legA = p.onGround ? Math.sin(p.walk) * .6 : (p.onLadder ? Math.sin(p.y * 6) * .4 : .25);
    const climbArm = p.onLadder ? Math.sin(p.y * 6) * .8 - 2.2 : 0;
    const swing = mining || p.swing > 0 ? -1.6 + Math.sin(p.swing) * 1.1 : 0;
    const part = (img, px, py, ang, ox, oy) => { ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.drawImage(img, -ox, -oy); ctx.restore(); };
    part(PLAYER_PARTS.legBack, 0, -10, -legA, 2, 0);
    part(PLAYER_PARTS.armBack, 0, -19, climbArm || legA * .8, 2, 1);
    ctx.drawImage(PLAYER_PARTS.body, -2, -20);
    part(PLAYER_PARTS.leg, 0, -10, legA, 2, 0);
    ctx.drawImage(PLAYER_PARTS.head, -4, -28);
    // bras avant avec la pioche
    ctx.save(); ctx.translate(0, -19); ctx.rotate(swing || climbArm || -legA * .8);
    const pick = loadIcon(PICKS[gear.pick].icon).small;
    if (pick) { ctx.save(); ctx.translate(1, 9); ctx.rotate(-.9); ctx.drawImage(pick, -2, -11, 12, 12); ctx.restore(); }
    ctx.drawImage(PLAYER_PARTS.arm, -2, -1);
    ctx.restore();
    if (p.burn > 0 && p.fireRes <= 0) {
        for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#ffd84a', '#ff8a1a', '#ff4a1a'][(i + Math.floor(time * 12)) % 3]; ctx.fillRect(-4 + i * 3, -14 - ((i * 5 + Math.floor(time * 20)) % 10), 2, 3); }
    }
    ctx.restore();
}

// ---------- BOUCLE ----------
let last = performance.now(), titleCam = 0;
function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    tick(dt);
    requestAnimationFrame(frame);
}
function tick(dt) {
    time += dt;
    if (world) {
        if (state === 'play' && !paused) {
            stats.time += dt;
            attackCd = Math.max(0, attackCd - dt);
            updatePlayer(dt);
            updateEntities(dt);
            spawnMobs(dt);
            lavaTimer -= dt;
            if (lavaTimer <= 0) {
                lavaTimer = .22;
                const py = Math.floor(player.y);
                lavaStep(world, py - 20, py + 24);
                for (const e of entities) if (e.kind === 'item' && boxHits(e.x, e.y, e.w, e.h, id => id === T.lava)) e.dead = true;
            }
            saveTimer -= dt; if (saveTimer <= 0) { saveTimer = 8; save(); }
            caveTimer -= dt;
            if (caveTimer <= 0) { caveTimer = rnd(40, 90); if (depthOf(player) > 20) Sound.cave(); }
            msg.t -= dt;
            // le Cœur scintille quand il est à l'écran
            if (!won && Math.abs(player.y - CORE_Y) < 16 && Math.random() < dt * 10) {
                const hx = CORE_X + .5, hy = CORE_Y + 3.5;
                particles.push({ x: hx + rnd(-.6, .6), y: hy + rnd(-.6, .4), vx: rnd(-.5, .5), vy: rnd(-2.5, -1), life: rnd(.8, 1.6), max: 1.6, color: Math.random() < .5 ? '#b8fff4' : '#52e6e6', size: 1, grav: -.5 });
            }
        }
        if (state === 'play' || state === 'dead') {
            const tx = (player.x + player.w / 2) * TS - VW / 2, ty = (player.y + player.h / 2) * TS - VH / 2 + (player.vy > 8 ? 30 : 0);
            camX += (tx - camX) * Math.min(1, dt * 8); camY += (ty - camY) * Math.min(1, dt * 7);
        }
        if (state === 'title') {
            titleCam += dt * 22;
            const span = (H - 10) * TS - VH;
            const ty = (Math.sin(titleCam / span * Math.PI - Math.PI / 2) * .5 + .5) * span;
            camX += ((W * TS - VW) / 2 + Math.sin(time * .2) * 80 - camX) * Math.min(1, dt * 2);
            camY = ty - 40;
            player.x = (camX + VW / 2) / TS; player.y = (camY + VH / 2) / TS;
            updateParticles(dt);
        }
        camX = clamp(camX, 0, W * TS - VW); camY = clamp(camY, -40, H * TS - VH);
        shake = Math.max(0, shake - dt * 1.5);
        if (state !== 'title') updateParticles(dt);
        computeLight(state === 'title' ? .3 : 0);
        render();
        updateHud();
        if (game.classList.contains('bb-playing') !== (state === 'play')) game.classList.toggle('bb-playing', state === 'play');
    }
}

// ---------- INTERFACE ----------
const $ = s => document.querySelector(s);
const game = $('#bb-game'), shell = $('#bb-shell');
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) game.classList.add('bb-touch');
const em = n => `<span class="bb-em"><img src="${ICONS}emerald.png" alt="">${n}</span>`;
const icon = f => `<img class="bb-ico" src="${ICONS}${f}" alt="">`;

game.insertAdjacentHTML('beforeend', `
<div class="bb-hud" id="bb-hud" hidden>
  <div class="bb-bars"><div class="bb-hearts" id="bb-hearts"></div><div class="bb-food" id="bb-food"></div></div>
  <div class="bb-topright"><div class="bb-wallet" id="bb-wallet"></div><div class="bb-depth" id="bb-depth"></div></div>
  <div class="bb-meter" id="bb-meter"><div class="bb-meter-you" id="bb-meter-you"></div></div>
  <div class="bb-msg" id="bb-msg"></div>
  <div class="bb-bottom">
    <div class="bb-pack"><span id="bb-pack-text"></span><div class="bb-pack-bar"><div id="bb-pack-fill"></div></div></div>
    <div class="bb-hotbar" id="bb-hotbar"></div>
  </div>
  <button class="bb-icon-btn bb-pause-btn" id="bb-pause-btn" title="Pause (Esc)">II</button>
</div>
<div class="bb-touchpad" id="bb-touchpad">
  <div class="bb-dpad">
    <button data-k="up">&#9650;</button><button data-k="left">&#9664;</button><button data-k="right">&#9654;</button><button data-k="down">&#9660;</button>
  </div>
  <div class="bb-actions">
    <button data-act="use">USE</button><button data-k="jump">JUMP</button><button data-act="trade">TRADE</button>
  </div>
</div>
<div class="bb-toasts" id="bb-toasts"></div>
<div class="bb-overlay" id="bb-overlay"></div>
`);
const overlay = $('#bb-overlay');

function buildHotbar() {
    $('#bb-hotbar').innerHTML = SUPPLIES.map((s, i) => `
        <button class="bb-slot" data-slot="${i}" title="${s.name}${s.key ? ' (' + s.key + ')' : ''}">
            <img src="${ICONS}${s.icon}" alt=""><span class="bb-count"></span><span class="bb-key">${i + 1}</span>
        </button>`).join('');
    $('#bb-hotbar').addEventListener('click', e => {
        const b = e.target.closest('.bb-slot'); if (!b) return;
        const i = +b.dataset.slot;
        if (selected === i || isTouch) useItem(i);
        selected = i;
    });
}
const hudCache = {};
function setHtml(id, html) { if (hudCache[id] !== html) { hudCache[id] = html; document.getElementById(id).innerHTML = html; } }
function updateHud() {
    if (state === 'title' || !player) return;
    const p = player, mh = maxHp();
    let hearts = '';
    for (let i = 0; i < mh / 2; i++) {
        const v = p.hp - i * 2;
        hearts += `<img src="${v >= 2 ? UI_ICONS.heart : v >= 1 ? UI_ICONS.heartHalf : UI_ICONS.heartEmpty}" alt="">`;
    }
    setHtml('bb-hearts', hearts);
    let food = '';
    const f = Math.ceil(p.food);
    for (let i = 0; i < 10; i++) { const v = f - i * 2; food += `<img src="${v >= 2 ? UI_ICONS.food : v >= 1 ? UI_ICONS.foodHalf : UI_ICONS.foodEmpty}" alt="">`; }
    setHtml('bb-food', food);
    setHtml('bb-wallet', em(wallet));
    const d = depthOf(p);
    setHtml('bb-depth', `${d} m${p.fireRes > 0 ? ` <span class="bb-fire">${Math.ceil(p.fireRes)}s</span>` : ''}`);
    document.getElementById('bb-meter-you').style.top = clamp((p.y + p.h - SURF) / (BEDROCK_Y - SURF) * 100, 0, 100) + '%';
    setHtml('bb-msg', msg.t > 0 ? msg.text : '');
    const cc = cargoCount(), ps = packSize();
    setHtml('bb-pack-text', `Backpack ${cc}/${ps}`);
    const fill = document.getElementById('bb-pack-fill');
    fill.style.width = (cc / ps * 100) + '%'; fill.classList.toggle('full', cc >= ps);
    document.querySelectorAll('.bb-slot').forEach((b, i) => {
        b.classList.toggle('sel', i === selected);
        const c = hot[SUPPLIES[i].id];
        const span = b.querySelector('.bb-count');
        if (span.textContent !== String(c)) span.textContent = c;
        b.classList.toggle('empty', c <= 0);
    });
}
function buildMeter() {
    const layers = [[0, '#6c4a31'], [4, '#7a7a7a'], [DEEPSLATE_Y - SURF, '#45454c'], [OBSIDIAN_Y - SURF, '#2a1f3f'], [NETHER_Y - SURF, '#7d3333'], [BASALT_Y - SURF, '#363039'], [CORE_Y - SURF - 6, '#2ad1c9'], [BEDROCK_Y - SURF, '#111']];
    const total = BEDROCK_Y - SURF;
    const stops = layers.map(([d, c], i) => { const next = layers[i + 1] ? layers[i + 1][0] : total; return `${c} ${d / total * 100}% ${next / total * 100}%`; });
    $('#bb-meter').style.background = `linear-gradient(180deg, ${stops.join(',')})`;
}

let toastQueue = [], toastBusy = false;
function toast(title, text, ic) {
    toastQueue.push({ title, text, ic });
    if (!toastBusy) nextToast();
}
function nextToast() {
    const t = toastQueue.shift();
    if (!t) { toastBusy = false; return; }
    toastBusy = true;
    const el = document.createElement('div');
    el.className = 'bb-toast';
    el.innerHTML = `${t.ic ? icon(t.ic) : ''}<div><strong>${t.title}</strong><span>${t.text}</span></div>`;
    $('#bb-toasts').appendChild(el);
    Sound.toast();
    setTimeout(() => el.classList.add('out'), 3400);
    setTimeout(() => { el.remove(); nextToast(); }, 3800);
}
const ADV_ICON = { stone_age: 'stone_pickaxe.png', hardware: 'iron_pickaxe.png', diamonds: 'diamond.webp', deep: 'compass.gif', hot: 'lava_bucket.png', boom: 'tnt.png', sneaky: 'gunpowder.png', rich: 'emerald.png', nether: 'netherrack.png', debris: 'ancient_debris.png', netherite: 'netherite_pickaxe.png', core: 'heart_of_the_sea.png', pearl: 'ender_pearl.png' };
ADVANCEMENTS.pearl = ['Ender Express', 'Teleport home with a pearl'];
function unlock(k) {
    if (!k || !ADVANCEMENTS[k] || adv[k]) return;
    adv[k] = true;
    toast('Advancement Made!', ADVANCEMENTS[k][0], ADV_ICON[k]);
}

// --- écrans ---
function showOverlay(kind, data = {}) {
    overlay.hidden = false; overlay.className = 'bb-overlay bb-ov-' + kind;
    $('#bb-hud').hidden = kind === 'title';
    let html = '';
    if (kind === 'title') {
        const hasSave = !!store.get(SAVE_KEY);
        html = `<div class="bb-title">
            <h1 class="bb-logo"><span>BEDROCK</span><span>BOUND</span></h1>
            <p class="bb-splash">Dig to the bottom of the world!</p>
            <div class="bb-menu">
              ${hasSave ? '<button class="bb-btn" data-do="continue">Continue</button>' : ''}
              <button class="bb-btn" data-do="new">${hasSave ? 'New World' : 'Play'}</button>
              <button class="bb-btn" data-do="howto">How to Play</button>
              <div class="bb-row"><button class="bb-btn" data-do="sound">Sound: ${Sound.muted ? 'OFF' : 'ON'}</button><button class="bb-btn" data-do="full">Fullscreen</button></div>
            </div>
            <p class="bb-credit">A game by Amai</p>
        </div>`;
    } else if (kind === 'howto') {
        html = `<div class="bb-panel bb-howto"><h2>How to Play</h2>
            <p>The <b>Heart of the World</b> sleeps at the very bottom, under the Nether, locked in reinforced deepslate. Dig down, bring ores back to the <b>Trader</b>, buy better gear, and go deeper each trip.</p>
            <div class="bb-keys">
              <div><kbd>A</kbd><kbd>D</kbd> / <kbd>Q</kbd><kbd>D</kbd> / arrows</div><div>Walk. Push into a wall to dig it.</div>
              <div><kbd>S</kbd> / <kbd>&darr;</kbd></div><div>Dig down, climb down</div>
              <div><kbd>W</kbd> <kbd>Space</kbd></div><div>Jump, climb ladders, dig up</div>
              <div>Mouse</div><div>Hold left click to dig any block in reach, click mobs to hit them. Right click places a torch or ladder.</div>
              <div><kbd>1</kbd>-<kbd>6</kbd> <kbd>F</kbd></div><div>Pick an item, use it</div>
              <div><kbd>L</kbd> <kbd>T</kbd></div><div>Place a ladder or a torch</div>
              <div><kbd>R</kbd></div><div>Pick up the ladder or torch where you stand (or click it)</div>
              <div><kbd>E</kbd></div><div>Trade (at the stall)</div>
              <div><kbd>Esc</kbd></div><div>Pause</div>
            </div>
            <p class="bb-tip">Climbing a shaft places ladders by itself. Falling more than 4 blocks hurts. If you die, your backpack stays in a chest where you fell: go get it back!</p>
            <button class="bb-btn" data-do="${data.back || 'title'}">Back</button></div>`;
    } else if (kind === 'pause') {
        const got = Object.keys(ADVANCEMENTS).filter(k => adv[k]).length;
        html = `<div class="bb-panel bb-pause"><h2>Game Paused</h2>
            <div class="bb-menu">
              <button class="bb-btn" data-do="resume">Back to Game</button>
              <button class="bb-btn" data-do="advs">Advancements (${got}/${Object.keys(ADVANCEMENTS).length})</button>
              <button class="bb-btn" data-do="howto-pause">How to Play</button>
              <div class="bb-row"><button class="bb-btn" data-do="sound">Sound: ${Sound.muted ? 'OFF' : 'ON'}</button><button class="bb-btn" data-do="full">Fullscreen</button></div>
              <button class="bb-btn" data-do="quit">Save and Quit to Title</button>
            </div>
            <p class="bb-stats">Deepest: ${stats.maxDepth} m &middot; Blocks dug: ${stats.mined} &middot; Deaths: ${stats.deaths} &middot; Time: ${fmtTime(stats.time)}</p></div>`;
    } else if (kind === 'advs') {
        html = `<div class="bb-panel bb-advs"><h2>Advancements</h2><div class="bb-adv-grid">
            ${Object.entries(ADVANCEMENTS).map(([k, [n, d]]) => `<div class="bb-adv ${adv[k] ? 'got' : ''}">${icon(ADV_ICON[k])}<div><strong>${n}</strong><span>${d}</span></div></div>`).join('')}
            </div><button class="bb-btn" data-do="back-pause">Back</button></div>`;
    } else if (kind === 'death') {
        html = `<div class="bb-dead"><h2>You Died!</h2><p>Amai ${data.cause}.</p>${data.where ? `<p class="bb-where">${data.where}</p>` : ''}
            <div class="bb-menu"><button class="bb-btn" data-do="respawn">Respawn</button><button class="bb-btn" data-do="quit">Title Screen</button></div></div>`;
    } else if (kind === 'win') {
        html = `<div class="bb-panel bb-win"><h2>The Heart is Yours!</h2>
            <p>You dug ${stats.maxDepth} meters to the bottom of the world and claimed the Heart of the World. The Trader paid you <b>1000 emeralds</b> just to hear the story.</p>
            <p class="bb-stats">Blocks dug: ${stats.mined} &middot; Ores found: ${stats.ores} &middot; Emeralds earned: ${stats.earned} &middot; Deaths: ${stats.deaths} &middot; Time: ${fmtTime(stats.time)}</p>
            <div class="bb-menu"><button class="bb-btn" data-do="resume">Keep Digging</button><button class="bb-btn" data-do="new">New World</button></div></div>`;
    } else if (kind === 'confirm-new') {
        html = `<div class="bb-panel"><h2>Start a New World?</h2><p>Your current world and all your gear will be replaced. (A backup of the old save is kept in this browser.)</p>
            <div class="bb-menu"><button class="bb-btn bb-danger" data-do="new-yes">Create New World</button><button class="bb-btn" data-do="title">Cancel</button></div></div>`;
    } else if (kind === 'shop') html = shopHtml();
    else if (kind === 'inactive') {
        html = `<div class="bb-click"><button class="bb-btn" data-do="resume">Click to Resume</button></div>`;
    }
    overlay.innerHTML = html;
}
function hideOverlay() { overlay.hidden = true; overlay.innerHTML = ''; overlay.className = 'bb-overlay'; }
const fmtTime = s => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + 'h ' : ''}${Math.floor(s / 60) % 60}m ${Math.floor(s % 60)}s`;

function shopHtml() {
    const cc = cargoCount();
    const value = Object.entries(cargo).reduce((a, [k, n]) => a + (ITEMS[k].keep ? 0 : ITEMS[k].value * n), 0);
    const slots = [];
    for (const [k, n] of Object.entries(cargo)) if (n > 0) slots.push(`<div class="bb-cslot" title="${ITEMS[k].name}: ${ITEMS[k].keep ? 'kept for netherite' : ITEMS[k].value + ' each'}">${icon(ITEMS[k].icon)}<span>${n}</span></div>`);
    while (slots.length < 12) slots.push('<div class="bb-cslot"></div>');
    const up = (title, list, level, extra = '') => {
        const cur = list[level], next = list[level + 1];
        if (!next) return `<div class="bb-up maxed">${icon(cur.icon || extra)}<div class="bb-up-txt"><strong>${cur.name}</strong><span>Maxed out</span></div><button class="bb-btn" disabled>MAX</button></div>`;
        const needDebris = next.debris && (stash.debris + (cargo.debris || 0)) < next.debris;
        const can = wallet >= next.cost && !needDebris;
        const desc = next.desc || (title === 'pack' ? `Carry ${next.size} items (now ${cur.size})` : title === 'lantern' ? `Light reaches ${next.level - 1} blocks (now ${cur.level - 1})` : `${next.hp / 2} hearts (now ${cur.hp / 2})`);
        return `<div class="bb-up">${icon(next.icon || extra)}<div class="bb-up-txt"><strong>${next.name}</strong><span>${desc}${next.debris ? ` <em>(${Math.min(next.debris, stash.debris + (cargo.debris || 0))}/${next.debris} debris)</em>` : ''}</span></div>
            <button class="bb-btn" data-buy="${title}" ${can ? '' : 'disabled'}>${em(next.cost)}</button></div>`;
    };
    return `<div class="bb-panel bb-shop">
        <div class="bb-shop-head"><h2>Trader</h2><div class="bb-wallet big">${em(wallet)}</div><button class="bb-btn bb-x" data-do="close-shop" title="Close (E)">&times;</button></div>
        <div class="bb-shop-cols">
          <section><h3>Your Backpack <small>${cc}/${packSize()}</small></h3>
            <div class="bb-cargo">${slots.join('')}</div>
            <button class="bb-btn bb-sell" data-do="sell" ${value > 0 || cargo.debris ? '' : 'disabled'}>Sell all for ${em(value)}</button>
            ${stash.debris ? `<p class="bb-note">${icon('ancient_debris.png')} ${stash.debris} Ancient Debris kept for netherite</p>` : ''}
            <h3>Supplies</h3>
            <div class="bb-supplies">${SUPPLIES.map(s => `<div class="bb-sup" title="${s.desc}">${icon(s.icon)}<div class="bb-up-txt"><strong>${s.amount > 1 ? s.amount + ' ' : ''}${s.name}</strong><span>You have ${hot[s.id]}</span></div>
                <button class="bb-btn" data-supply="${s.id}" ${wallet >= s.cost && hot[s.id] < s.max ? '' : 'disabled'}>${em(s.cost)}</button></div>`).join('')}</div>
          </section>
          <section><h3>Upgrades</h3>
            ${up('pick', PICKS, gear.pick)}
            ${up('pack', PACKS, gear.pack, 'bundle.png')}
            ${up('lantern', LANTERNS, gear.lantern, 'lantern.png')}
            ${up('armor', ARMORS, gear.armor)}
          </section>
        </div></div>`;
}
function openShop() { if (state !== 'play' || player.dead) return; for (const k in keys) keys[k] = false; mining = null; state = 'shop'; showOverlay('shop'); }
function closeShop() { state = 'play'; hideOverlay(); save(); }
function refreshShop() { if (state === 'shop') { const sc = overlay.querySelector('.bb-shop-cols'); const top = sc ? sc.scrollTop : 0; showOverlay('shop'); const n = overlay.querySelector('.bb-shop-cols'); if (n) n.scrollTop = top; } }
function sell() {
    let value = 0;
    for (const [k, n] of Object.entries(cargo)) {
        if (ITEMS[k].keep) stash[k] = (stash[k] || 0) + n; else value += ITEMS[k].value * n;
    }
    cargo = {};
    wallet += value; stats.earned += value;
    if (value) Sound.coin();
    refreshShop();
}
function buy(kind) {
    const list = { pick: PICKS, pack: PACKS, lantern: LANTERNS, armor: ARMORS }[kind];
    const next = list[gear[kind] + 1];
    if (!next || wallet < next.cost) { Sound.deny(); return; }
    if (next.debris) {
        if (cargo.debris) { stash.debris += cargo.debris; delete cargo.debris; }
        if (stash.debris < next.debris) { Sound.deny(); return; }
        stash.debris -= next.debris;
    }
    wallet -= next.cost; gear[kind]++;
    if (kind === 'armor') player.hp = maxHp();
    Sound.buy();
    if (kind === 'pick') unlock(['', 'stone_age', 'hardware', '', 'netherite'][gear.pick] || null);
    refreshShop();
}
function buySupply(id) {
    const s = SUPPLIES.find(k => k.id === id);
    if (wallet < s.cost || hot[id] >= s.max) { Sound.deny(); return; }
    wallet -= s.cost; hot[id] = Math.min(s.max, hot[id] + s.amount);
    Sound.buy(); refreshShop();
}

overlay.addEventListener('click', e => {
    Sound.init();
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.buy) return buy(d.buy);
    if (d.supply) return buySupply(d.supply);
    switch (d.do) {
        case 'continue': startGame(false); break;
        case 'new': store.get(SAVE_KEY) ? showOverlay('confirm-new') : startGame(true); break;
        case 'new-yes': { const old = store.get(SAVE_KEY); if (old) store.set(SAVE_KEY + '_backup', old); startGame(true); break; }
        case 'howto': showOverlay('howto'); break;
        case 'howto-pause': showOverlay('howto', { back: 'back-pause' }); break;
        case 'title': showOverlay('title'); break;
        case 'sound': Sound.toggle(); b.textContent = 'Sound: ' + (Sound.muted ? 'OFF' : 'ON'); break;
        case 'full': toggleFullscreen(); break;
        case 'resume': paused = false; state = 'play'; hideOverlay(); active = true; break;
        case 'advs': showOverlay('advs'); break;
        case 'back-pause': showOverlay('pause'); break;
        case 'quit': save(); toTitle(); break;
        case 'respawn': respawn(); break;
        case 'close-shop': closeShop(); break;
        case 'sell': sell(); break;
    }
});
$('#bb-pause-btn').addEventListener('click', () => pause());
function pause() { if (state !== 'play') return; paused = true; state = 'pause'; showOverlay('pause'); save(); }
function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (shell.requestFullscreen) shell.requestFullscreen().catch(() => {});
}
function toTitle() {
    state = 'title'; paused = false; mining = null;
    if (!load()) freshState(1234);
    showOverlay('title');
}
function startGame(fresh) {
    Sound.init();
    if (fresh || !load()) {
        freshState((Math.random() * 1e9) | 0);
        const bonus = legacyBonus();
        if (bonus > 0) { wallet += bonus; setTimeout(() => toast('Welcome back, miner!', `Your old haul was traded for ${bonus} emeralds`, 'emerald.png'), 800); }
        setTimeout(() => toast('Find the Heart of the World', 'It sleeps under the Nether, 300 m down', 'heart_of_the_sea.png'), 300);
    }
    player.hp = Math.min(player.hp, maxHp());
    if (player.dead || player.hp <= 0) Object.assign(player, makePlayer(), { hp: maxHp() });
    camX = (player.x + player.w / 2) * TS - VW / 2; camY = (player.y + player.h / 2) * TS - VH / 2;
    state = 'play'; paused = false; active = true;
    hideOverlay(); $('#bb-hud').hidden = false;
    save();
    game.focus({ preventScroll: true });
}

// --- clavier ---
window.addEventListener('keydown', e => {
    if (!active && !document.fullscreenElement) return;
    const k = KEYMAP[e.code];
    if (k || e.code === 'Space') e.preventDefault();
    if (state === 'shop') { if (e.key === 'Escape' || e.key.toLowerCase() === 'e') closeShop(); return; }
    if (state === 'pause') { if (e.key === 'Escape') { paused = false; state = 'play'; hideOverlay(); } return; }
    if (state !== 'play') return;
    if (k) { keys[k] = true; return; }
    const key = e.key.toLowerCase();
    if (e.key === 'Escape' || key === 'p') pause();
    else if (key === 'e') { if (nearTrader()) openShop(); }
    else if (key === 'f') useItem(selected);
    else if (key === 'l') useItem(0);
    else if (key === 't') useItem(1);
    else if (key === 'r') pickUpNearby();
    else if (key === 'm') Sound.toggle();
    else if (/^Digit[1-6]$/.test(e.code)) selected = +e.code.slice(5) - 1;
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });

// --- souris / tactile sur le monde ---
function setMouse(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * VW; mouse.y = (e.clientY - r.top) / r.height * VH;
}
canvas.addEventListener('pointerdown', e => {
    Sound.init(); active = true; setMouse(e); mouse.inside = true;
    if (state !== 'play') return;
    if (e.button === 2) { mouse.right = true; const t = mouseCell(); const id = get(t.x, t.y); useItem(selected <= 1 ? selected : (id === T.air ? 1 : selected)); mouse.right = false; return; }
    mouse.down = true;
    canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => { setMouse(e); mouse.inside = true; });
canvas.addEventListener('pointerup', () => { mouse.down = false; if (isTouch) mouse.inside = false; });
canvas.addEventListener('pointercancel', () => { mouse.down = false; });
canvas.addEventListener('pointerleave', () => { if (!mouse.down) mouse.inside = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { if (state !== 'play') return; e.preventDefault(); selected = (selected + (e.deltaY > 0 ? 1 : -1) + SUPPLIES.length) % SUPPLIES.length; }, { passive: false });
// cliquer ailleurs sur la page met le jeu en pause : les flèches servent à nouveau à défiler
document.addEventListener('pointerdown', e => {
    if (shell.contains(e.target)) { active = true; return; }
    active = false;
    if (state === 'play') { paused = true; state = 'pause'; showOverlay('inactive'); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); if (state === 'play') pause(); } });
window.addEventListener('pagehide', save);

// --- boutons tactiles ---
document.querySelectorAll('#bb-touchpad [data-k]').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); Sound.init(); keys[k] = true; b.classList.add('on'); };
    const off = e => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
});
document.querySelectorAll('#bb-touchpad [data-act]').forEach(b => b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (b.dataset.act === 'use') useItem(selected);
    else if (nearTrader()) openShop(); else say('Walk to the trader stall on the surface.');
}));

// ---------- DÉMARRAGE ----------
buildTextures(); buildUiIcons(); buildCreatures(); buildHotbar(); buildMeter();
buildPlayerFallback();
const skin = new Image();
skin.onload = () => buildPlayer(skin);
skin.src = 'amai.png';
for (const it of Object.values(ITEMS)) loadIcon(it.icon);
for (const p of PICKS) loadIcon(p.icon);
loadIcon('emerald.png');
if (document.fonts && document.fonts.load) document.fonts.load('8px Minecraftia');
toTitle();
requestAnimationFrame(frame);

// accès pour les tests depuis la console
window.BedrockBound = { advance(sec) { for (let i = 0; i < sec * 60; i++) tick(1 / 60); last = performance.now(); }, get cam() { return [camX, camY]; }, get hot() { return hot; }, get wallet() { return wallet; }, get player() { return player; }, get world() { return world; }, T, get, setTile, get state() { return state; }, give: (n) => { wallet += n; }, get gear() { return gear; }, get cargo() { return cargo; }, keys, get entities() { return entities; } };
})();
