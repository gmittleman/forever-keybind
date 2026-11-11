# forever keybind

Plan your WoW Forever action bars, see them on a keyboard, and practice until they're muscle memory.

Everything fits on one desktop screen: your bars, a QWERTY keyboard and a 5-button mouse showing every bind, and the spellbook beside them.

- **Press your keys** (keys, Mouse 4/5, modifier + wheel) to see what fires, with warnings for the wrong stance or form, or an ability you haven't learned yet. Shift, Ctrl and Alt switch the keyboard to that layer.
- **Stances and forms swap action bar 1** like in the game: warrior stances, druid Bear and Cat Form, Prowl inside Cat Form, and rogue Stealth (Vanish too). Pressing a druid's active form again goes back to caster form. Tabs beside action bar 1 show any page. Paladin auras and Shadowform sit on the stance bar without swapping pages.
- **Pet bar** for hunters and warlocks, with a page per demon: summoning one switches the pet bar, like in the game.
- **Talents:** each talent ability (Mortal Strike, Moonkin Form, Shadowform…) is in the spellbook under its tree. Mark the ones you took; the rest show as not taken.
- **Drag** abilities from the spellbook onto slots or keyboard keys, or click to pick up and click to place. Like in WoW, dropping on a filled slot picks up the ability that was there. Abilities keep their keys when you move them on the bars.
- **Keybind mode**, like WoW's /kb addons: hover a slot and press a key to bind it.
- **Setups:** several named setups, each with a class, race and level, saved automatically in your browser. No account needed. Export and import as JSON.
- **Races and racials:** all ten Forever races, including both Skyborne, with their racials in the spellbook.

It's made for desktop; phones and tablets get a note suggesting a computer.

Not affiliated with or endorsed by Blizzard Entertainment. Ability names and icons belong to Blizzard; icons and
tooltips are shown through [Wowhead](https://www.wowhead.com/forever).

## Status

Every class except the Shaman is in, on Forever's rules for levels 1–60, with talent abilities and pets. The Shaman
comes next. See `BACKLOG.md`.

## How it's built

A static site with no build step: plain HTML, CSS and JavaScript modules in `site/`.

| Path | What it is |
|---|---|
| `site/index.html` | The page |
| `site/css/app.css` | Styles, with a light and a dark theme |
| `site/js/keys.js` | Reading keys from keyboard, mouse and wheel events, and their labels (`s-Q`, `M4`) |
| `site/js/layout.js` | The layout model: stances and forms, bars, slots, moving abilities, checking saved and imported layouts |
| `site/js/store.js` | Saving setups in the browser's localStorage |
| `site/js/app.js` | Everything on screen and all input handling |
| `site/data/classes.json` | The classes, and which are ready |
| `site/data/<class>.json` | One file per class (see below) |
| `site/data/common.json` | Things every class can put on a bar, like potions |
| `site/data/races.json` | The races, which classes each can be, and their racials |
| `tools/wowhead.js` | Checks the data against Wowhead's Forever tooltips (`npm run check`) |

To run it locally, serve `site/` with any static server, for example `npm run serve`. Opening `index.html` straight
from disk doesn't work, because browsers block modules and data files from `file://`.

### Class data

Each `site/data/<class>.json` has:

- `stances`: the stance bar, in order. Each one has its own action bar 1 page unless `page` is `false` (Travel Form
  keeps the caster page). `ability` points into `abilities`, `abbr` is the short marker and `color` the frame color.
- `base`: the state you're in without a stance or form (druid caster form, a rogue out of Stealth, a mage). It has
  its own page and no button; pressing the active form again returns to it. Classes without stances have `stances: []`
  and only a `base`, and then show no stance bar or page tabs.
- `hidden`: states entered by an ability on the bars, optionally `within` another state: Prowl within Cat Form, or
  the rogue's Stealth, which Vanish also enters (`enteredBy`). Each has its own page.
- `use`: for abilities limited to some stances or forms, the ids they work in. A hidden state also allows what its
  parent allows, so Cat Form abilities work while prowling.
- `castIn`: where the class's other abilities work. The druid's is `["caster"]`. Without it they work everywhere.
  Potions, bandages and racials always work everywhere.
- `stateWord`: `"form"` for druids, so the page says "Any form".
- `aliases`: other names Wowhead uses for a state, for the checker (`"Dire Bear Form": "bear"`).
- `book`: the spellbook, in order.
- `abilities`: every ability by id, with `name`, `spell` (or `item`, the Wowhead Forever id), `icon` (the Wowhead icon
  name), `level` and a short `desc` for when Wowhead isn't available. Talent abilities add `talent: true`, `tree`, and
  `level` as the earliest level their tier allows (tier N: 10 + 5 × (N − 1)); `tooltipLevel` keeps what Wowhead shows
  when that differs. `faction` (mage teleports) and `races` (Summon Charger) limit who gets an ability.
- `pet` (hunter, warlock): `pages` (one per demon, each with the `summon` ability that switches to it) and `book`, the
  pet bar's spellbook. Pet abilities have `pet: true`, and `pets` when only some demons have them; the built-in pet
  commands (Attack, Follow…) have `command: true` and no spell.
- `starter`: the layout a new setup starts with. `bar1` rows give a key plus what each page shows, `bars` lists
  `[key, ability]` pairs for action bars 2 and up, and `pet` rows a key plus what each pet shows.

Wowhead's Forever tooltips are the source for spell ids, names, icons, levels and stance or form requirements.
`npm run check` compares every ability with them and lists any difference; `npm run lookup -- 402927 item:929`
prints what Wowhead says, which helps when adding abilities. Where the site deliberately differs, an ability can set
`wowheadName` (Shoot / Throw is "Shoot Gun" on Wowhead) or `wowheadUse: false` (Forever lets Faerie Fire into Bear and
Cat Form, which its tooltip doesn't say). Tooltips are cached in `tools/.cache`; delete it to fetch fresh ones.

`races.json` lists each race with its classes and racial ids, and the racials themselves. A racial with `classes`
only shows for those classes (Eureka! has one per class).

### Saved data

Setups live in localStorage under `forever-keybind` as `{ v, active, setups: [{ id, name, cls, race, level, talents, layout, updated }] }`.
`talents` lists the talent abilities taken. A layout with a pet bar has `pet: { petPageId: [10] }` and `p-0` to `p-9` keys.
`race` is null until one is chosen. A page added later (Berserker Stance) starts empty in older saves.
`v` is the save format version. When the format changes, bump `VERSION` in `store.js` and convert older saves when
loading, so nobody loses their setup. Exports use `{ app: 'forever-keybind', v, setup }`, and older Fuffenforge
exports still import.

## Tests

Browser tests drive the page in headless Chromium with Playwright, against a small local server.

```bash
npm install
npx playwright install chromium
npm test
```

`npm test -- keyboard` runs only the files whose name contains `keyboard`. Each `tests/*.test.js` is a plain Node
script that prints PASS or FAIL per check and exits non-zero if any check fails. Screenshots go to `tests/output/`.
Some checks load Wowhead's script and icons, so they need internet access; the same checks also run with Wowhead
blocked. GitHub runs the whole suite on every push.

| File | Covers |
|---|---|
| `keybinds.test.js` | Bars, pressing keys, moving abilities, rebinding, saving, export and import, the Mouse 4 back button |
| `keyboard.test.js` | Keyboard view: layers, held and latched modifiers, stance swaps, key clicks and drops |
| `keys-follow.test.js` | Keys moving with abilities when you rearrange |
| `setups-bars.test.js` | Number of bars, level, setups, storage problems, imports, and `keys.js` |
| `layout.test.js` | Keyboard and mouse above the fold at common screen sizes, the mouse view, Keybind mode, spellbook search, click-to-move and pick-up, the phone note |
| `forms-races.test.js` | The stance and form engine, Berserker Stance, the druid, races and racials |
| `classes-pets.test.js` | Every class, talents, Stealth, auras, Shadowform, faction and race filters, the pet bar |

## Hosting

Cloudflare Pages, with no build command and `site` as the output directory.

## License

MIT, see `LICENSE`.
