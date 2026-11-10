# forever keybind

Plan your WoW Forever action bars, see them on a keyboard, and practice until they're muscle memory.

Everything fits on one desktop screen: your bars, a QWERTY keyboard showing every bind, and the spellbook beside them.

- **Press your keys** (keys, Mouse 4/5, modifier + wheel) to see what fires, with warnings for the wrong stance or an ability you haven't learned yet. Shift, Ctrl and Alt switch the keyboard to that layer.
- **Drag** abilities from the spellbook onto slots or keyboard keys, or click to pick up and click to place. Abilities keep their keys when you move them on the bars.
- **Keybind mode**, like WoW's /kb addons: hover a slot and press a key to bind it.
- **Setups:** several named setups, saved automatically in your browser. No account needed. Export and import as JSON.

It's made for desktop; phones and tablets get a note suggesting a computer.

Not affiliated with or endorsed by Blizzard Entertainment. Ability names and icons belong to Blizzard; icons and
tooltips are shown through [Wowhead](https://www.wowhead.com/forever).

## Status

Early. Only the Warrior is in so far, and its stance rules still follow WoW Classic; they move to Forever's rules next.
The other classes follow one at a time.

## How it's built

A static site with no build step: plain HTML, CSS and JavaScript modules in `site/`.

| Path | What it is |
|---|---|
| `site/index.html` | The page |
| `site/css/app.css` | Styles, with a light and a dark theme |
| `site/js/keys.js` | Reading keys from keyboard, mouse and wheel events, and their labels (`s-Q`, `M4`) |
| `site/js/layout.js` | The layout model: bars, slots, moving abilities, checking saved and imported layouts |
| `site/js/store.js` | Saving setups in the browser's localStorage |
| `site/js/app.js` | Everything on screen and all input handling |
| `site/data/classes.json` | The classes, and which are ready |
| `site/data/<class>.json` | One file per class (see below) |
| `site/data/common.json` | Things every class can put on a bar, like potions |

To run it locally, serve `site/` with any static server, for example `npm run serve`. Opening `index.html` straight
from disk doesn't work, because browsers block modules and data files from `file://`.

### Class data

Each `site/data/<class>.json` has:

- `stances`: the stance bar, in order. Each stance has its own action bar 1 page. `ability` points into `abilities`,
  `abbr` is the one-letter marker and `color` the frame color.
- `use`: for abilities limited to some stances, the stance ids they work in. Abilities not listed work everywhere.
- `book`: the spellbook, in order.
- `abilities`: every ability by id, with `name`, `spell` (or `item`, the Wowhead Forever id), `icon` (the Wowhead icon
  name), `level` and a short `desc` for when Wowhead isn't available.
- `starter`: the layout a new setup starts with. `bar1` rows give a key plus what each stance shows, `bars` lists
  `[key, ability]` pairs for action bars 2 and up.

Wowhead's Forever pages are the source for spell ids, icon names and levels.

### Saved data

Setups live in localStorage under `forever-keybind` as `{ v, active, setups: [{ id, name, cls, level, layout, updated }] }`.
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
| `layout.test.js` | Keyboard above the fold at common screen sizes, Keybind mode, spellbook search, click-to-move, the phone note |

## Hosting

Cloudflare Pages, with no build command and `site` as the output directory.

## License

MIT, see `LICENSE`.
