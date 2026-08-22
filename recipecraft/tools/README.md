# RecipeCraft — how the data is made

The site never hard-codes a recipe. Everything in `data/recipes.json` is generated
from the **official Minecraft game files**, so a new Minecraft version is one
command away.

```
tools/build.mjs         vanilla datapack  ->  data/recipes.json
tools/fetch-icons.mjs   missing textures  ->  assets/items/<item_id>.png
data/extra-recipes.json hand-written recipes the game hardcodes (specials + brewing)
```

## Updating to a new Minecraft version

```bash
node tools/build.mjs latest    # parse the newest version's recipes
node tools/fetch-icons.mjs     # grab the icons of the new items
node tools/build.mjs latest    # re-run so the new icons are registered
```

`latest` follows the newest snapshot, `latest-release` the newest stable
version, and any exact id works too (`26.2`, `26.3-snapshot-9`).

That's it — no build step, no dependencies, the site is still plain HTML/CSS/JS.

To pin a version instead of following snapshots, edit `DEFAULT_VERSION` at the
top of `build.mjs`.

Requirements: Node 18+ and `tar` (already on Windows 10+, macOS and Linux).
Downloads are cached in `tools/.cache/` (git-ignored); `--fresh` re-downloads.

## Where the data comes from

| What | Source |
|---|---|
| Recipes, item tags | [`misode/mcmeta`](https://github.com/misode/mcmeta) `<version>-data` — an automatic mirror of the vanilla jar |
| Item names (English) | same repo, `<version>-assets`, `lang/en_us.json` |
| Item list | same repo, `<version>-summary`, `registries` |
| Icons | [minecraft.wiki](https://minecraft.wiki) inventory sprites, falling back to the vanilla textures |

## Waxed copper

Waxed blocks are visually identical to their un-waxed version in game, so
`fetch-icons.mjs` copies the icon rather than downloading a separate one:
`waxed_exposed_copper_grate.png` is always a copy of `exposed_copper_grate.png`.
Replace the base texture and the waxed one follows on the next run.

## Adding a texture by hand

Anything the fetcher could not find is listed in `tools/missing-icons.txt`
(one `item_id` per line). Drop a square image named after the item into
`assets/items/`, re-run `node tools/build.mjs`, done. Existing files are never
overwritten, so your own textures are safe.

**PNG, WebP and GIF all work** — the build detects the format and records it,
no config needed. If an item ends up with several files (say `stone.webp` next
to `stone.png`), the most recently modified one wins and the build prints a
line naming the item, so a leftover file never takes over silently.

A source of 48 px or less is treated as a game sprite: drawn hard-edged and
enlarged by a whole factor. Anything bigger is treated as a render and only
ever scaled down. Either way an icon is never stretched by a fractional
amount, which is what used to make them blurry.

Items with no icon show a hatched `?` placeholder instead of a broken image.

## `data/recipes.json` format

```jsonc
{
  "version": "26.2",
  "categories": [{ "id": "building", "name": "Building Blocks", "icon": "bricks" }],
  "items": {
    "oak_planks": { "n": "Oak Planks", "c": "building" }
    //             n = name, c = category, x = icon extension if not png,
    //             m = icon missing, h = technical item (hidden from the grid),
    //             p = icon is a raw 16/32 px game sprite (drawn hard-edged and
    //                 scaled by a whole factor; anything else is only scaled down)
  },
  "tags": { "planks": ["oak_planks", "..."] },
  "recipes": [
    { "k": "oak_planks", "t": "craft", "r": "oak_planks", "q": 4,
      "g": ["oak_log", null, null, null, null, null, null, null, null] }
  ]
}
```

Recipe fields: `t` station (`craft`, `smelting`, `blasting`, `smoking`, `campfire`,
`stonecutting`, `smithing`, `trim`, `brewing`), `r` result id, `q` result count,
`g` the nine crafting slots, `s` shapeless, `in` cooking/stonecutting input,
`base`/`add`/`tpl` smithing slots, `xp`, `note`.

An ingredient slot is either an item id, or `{ "t": "tag", "i": [ids] }` when
several items work — the UI cycles through them, like the game does.

## Recipes that are not in the datapack

The game hardcodes a handful of recipes: banner copying, book copying, map
zooming, item repair and shield decoration.

Brewing became a real datapack recipe type in 26.3, so from that version on the
279 potion recipes come straight from the game — including splash, lingering,
extended and level II variants. Each potion becomes a virtual item such as
`potion_strength` or `lingering_potion_long_leaping`. On older versions the
hand-written brewing table in `extra-recipes.json` is used instead; the build
picks the right one on its own.

All of that lives in **`data/extra-recipes.json`** and is merged in at build
time — edit that file to fix or add a recipe. `#tag_name` ingredients are
resolved automatically, and the `items` block declares the virtual potion items
used by the fallback brewing table.

The same file has a `"notes"` block: `"<recipe file name>": "text"` adds an
explanation under any vanilla recipe (e.g. `firework_rocket_simple`).
