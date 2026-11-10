# Backlog

What's planned for forever keybind, roughly in order. Points are relative effort: the original keybind tester was
about 8, the keyboard view about 3, keys following abilities about 2.

Ideas and bug reports are welcome as GitHub issues.

## Decisions so far

- **WoW Forever only.** Class data follows Forever's rules, not Classic's.
- **Desktop only.** Phones and tablets get a friendly note suggesting a computer, with "Show it anyway".
- **No accounts.** Setups save in the browser; export/import and share links move them between devices.
- **One view, no modes.** Pressing keys always shows what fires, dragging always works, and Keybind mode
  (like WoW's /kb addons) is a toggle for changing keys.
- **Static site, no backend.** Hosted on Cloudflare Pages from `site/`.
- **Open source (MIT).** Ability names and icons belong to Blizzard and are shown through Wowhead.
- Working name: **forever keybind**. A real name and domain come before launch.

## Done

### Sprint 1: Foundation (15 points)

| # | Item | Pts |
|---|---|---|
| A | Standalone app: own repo and site, per-class data files, code split into modules | 8 |
| B | Choose 1–4 extra action bars | 3 |
| E | Several named setups, saved indicator, versioned saves; export and import a setup as JSON (copy and paste), including older Fuffenforge exports | 3 |
| J | Browser tests run on GitHub on every push | 1 |

Feedback round after sprint 1:

- Full-screen desktop layout: bars and keyboard fit above the fold, with the spellbook as an always-visible sidebar
  with search.
- Modes replaced by one view plus Keybind mode (hover a slot and press a key).
- Bar order like the game: stance bar on top, then the highest extra bar down to action bar 2, action bar 1 at the bottom.
- Desktop-only note for phones and tablets.
- Like WoW, dropping an ability on a filled slot picks up the one it replaces.
- Main area capped at 1600px and centered; action bars packed tight; square keyboard keys sized to the space.
- **D1 Mouse view:** a standard 5-button mouse beside the keyboard: Mouse 4 and 5, middle click and modifier + wheel,
  following stance and modifier layer like the keyboard, with click, drop and Keybind mode support.

### Sprint 2: Engine and first classes (14 points)

| # | Item | Pts |
|---|---|---|
| C1 | Bar-swap engine: stances, forms with or without their own page, a caster form you return to by pressing the active form, Prowl inside Cat Form with its own page, page tabs beside action bar 1 | 5 |
| C2.0 | `npm run check`: every ability's id, name, icon, level and stance or form rule against Wowhead's Forever tooltips | 2 |
| C2.1 | Warrior on Forever rules, 1–60: Berserker Stance and its page, Victory Rush, Slam, Thunder Clap in Defensive Stance | 2 |
| C2.2 | Druid: caster, Bear, Aquatic, Cat, Travel and Prowl; Faerie Fire in Bear and Cat; Barkskin and Nature's Grasp in any form; Revive and the new Ferocious Bite rank | 3 |
| C3 | Races: all ten (Skyborne has a High Order and a Windshaper version), race per setup, racials in the spellbook | 2 |

Open questions for sprint 2, to check in game:

- Does Moonkin Form get its own action bar 1 page in Forever? It didn't in vanilla. It's planned without one.
- Ravage and Pounce are set to need Prowl, as in Classic; their tooltips only say Cat Form.

## Sprint 3: More classes (17 points)

| # | Item | Pts | Notes |
|---|---|---|---|
| C2.3 | Rogue | 2 | Stealth swaps bar 1. |
| C2.4 | Priest | 2 | Check whether Shadowform swaps bars in Forever. |
| C2.5 | Paladin | 2 | Heavily reworked in Forever (Holy Strike, Seal of Fury, new talents). |
| C2.8 | Mage | 1 | No bar swaps. |
| C2.7 | Hunter | 2 | |
| C2.9 | Warlock | 2 | |
| C5 | Pet bar | 3 | Hunter and Warlock. |
| C4 | Talent abilities per spec | 3 | Mortal Strike, Shield Slam, Holy Shock and the like, for the right spec. Druid: Moonkin Form (a stance with no page of its own; it can cast everything but heals), Feral Charge, Insect Swarm, Lacerate, Swiftmend, Nature's Swiftness, Primal Bite, Shifting Power, Wild Growth (already researched). |

If this sprint runs long, Warlock and the pet bar can move to sprint 4.

## Sprint 4: Launch (19 points)

| # | Item | Pts | Notes |
|---|---|---|---|
| C2.6 | Shaman | 2 | Lots of totems. |
| F | Share links | 3 | The whole setup packed into the URL. "Here's my Prot warrior setup: link" is what spreads on Reddit, and it moves setups between devices without accounts. |
| P | Export and import as a file | 2 | Export downloads a `.json` file named after the setup; Import takes a file from a file picker or dropped onto the page, as well as pasted text. Export and Import move into the setup menu so they're above the fold. Copy-and-paste JSON already works (sprint 1). |
| C6 | Starter layout per class and spec | 5 | A sensible starting point instead of a blank screen. |
| K | Launch kit | 3 | Name and domain, landing text, link preview image, cookie-free analytics (Cloudflare Web Analytics), feedback link. |
| N | Start screen | 3 | First visit and "New": Create new keybind setup → class → race → level. Returning visitors go straight to their last setup; existing setups can show as cards. |
| N2 | Change class, race and level later | 1 | Changing class replaces the layout, so it asks first; "Duplicate as another class" may be friendlier. |

Then post on Reddit.

## After launch

Order to be decided by feedback.

| # | Item | Pts | Notes |
|---|---|---|---|
| D2 | Choose and change your mouse | 4 | Pick a mouse (3, 5, 7 buttons or a 12-button MMO side grid) and left-handed. Browsers only see left, right, middle and Mouse 4/5; extra buttons are usually mapped to keyboard keys by the mouse's software, so the site asks which key each one sends, then draws and practices them. The 5-button mouse (D1) is done. |
| G | Keyboard layouts | 3 | Nordic (Å Ä Ö), QWERTZ, AZERTY, UK. |
| H | Drill mode | 5 | "Press Charge!" prompts with reaction time and streaks, plus rotation drills. |
| I | Reach heat map and score | 3 | Color keys by distance from WASD, flag awkward combos like Shift + mouse while strafing. |
| L | Colorblind-safe markers | 2 | Back up red/blue stance colors and red "can't use" tints with icons or patterns. |
| M | In-game import/export addon (research first) | 2 + ~13 | An addon that reads your real bars and keybinds into a code to paste here, and maybe writes them back. Depends on Forever's addon API. |
