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
| E | Several named setups, saved indicator, versioned saves, import of older Fuffenforge exports | 3 |
| J | Browser tests run on GitHub on every push | 1 |

Feedback round after sprint 1:

- Full-screen desktop layout: bars and keyboard fit above the fold, with the spellbook as an always-visible sidebar
  with search.
- Modes replaced by one view plus Keybind mode (hover a slot and press a key).
- Bar order: stance bar on top, extra bars numbered down from it, action bar 1 at the bottom.
- Desktop-only note for phones and tablets.
- Like WoW, dropping an ability on a filled slot picks up the one it replaces.
- Main area capped at 1600px and centered; action bars packed tight; square keyboard keys sized to the space.

## Sprint 2: Engine and first classes (14 points)

| # | Item | Pts | Notes |
|---|---|---|---|
| C1 | Bar-swap engine | 5 | Generalize stances to anything that swaps action bar 1: warrior stances, druid Bear and Cat forms, rogue Stealth, plus abilities only usable in some forms. Which forms swap bars in Forever needs checking. |
| C2.0 | Data format and checking script | 2 | A script that checks every ability id and icon against Wowhead's Forever data. |
| C2.1 | Warrior | 2 | Move from Classic to Forever stance rules (Thunder Clap in Defensive, Victory Rush, Tactical Mastery), cover 1–60, add Berserker Stance at 30. |
| C2.2 | Druid | 3 | The hardest class: several forms, many form-only abilities. |
| C3 | Races and racials | 2 | Race per setup, racials in the spellbook (Stoneform and so on). Research Forever's race list: the patch notes mention a new "Skyborne" racial. A plain race selector until the start screen (N) arrives. |

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
| C4 | Talent abilities per spec | 3 | Mortal Strike, Shield Slam, Holy Shock and the like, for the right spec. |

If this sprint runs long, Warlock and the pet bar can move to sprint 4.

## Sprint 4: Launch (17 points)

| # | Item | Pts | Notes |
|---|---|---|---|
| C2.6 | Shaman | 2 | Lots of totems. |
| F | Share links | 3 | The whole setup packed into the URL. "Here's my Prot warrior setup: link" is what spreads on Reddit, and it moves setups between devices without accounts. |
| C6 | Starter layout per class and spec | 5 | A sensible starting point instead of a blank screen. |
| K | Launch kit | 3 | Name and domain, landing text, link preview image, cookie-free analytics (Cloudflare Web Analytics), feedback link. |
| N | Start screen | 3 | First visit and "New": Create new keybind setup → class → race → level. Returning visitors go straight to their last setup; existing setups can show as cards. |
| N2 | Change class, race and level later | 1 | Changing class replaces the layout, so it asks first; "Duplicate as another class" may be friendlier. |

Then post on Reddit.

## After launch

Order to be decided by feedback.

| # | Item | Pts | Notes |
|---|---|---|---|
| D | Mouse view | 5 | Choose how many buttons your mouse has (3, 5, 7, 12-button MMO grid). Browsers only see left, right, middle and Mouse 4/5; extra buttons are usually mapped to keyboard keys by the mouse's software, so practicing them means telling the site which key each sends. |
| G | Keyboard layouts | 3 | Nordic (Å Ä Ö), QWERTZ, AZERTY, UK. |
| H | Drill mode | 5 | "Press Charge!" prompts with reaction time and streaks, plus rotation drills. |
| I | Reach heat map and score | 3 | Color keys by distance from WASD, flag awkward combos like Shift + mouse while strafing. |
| L | Colorblind-safe markers | 2 | Back up red/blue stance colors and red "can't use" tints with icons or patterns. |
| M | In-game import/export addon (research first) | 2 + ~13 | An addon that reads your real bars and keybinds into a code to paste here, and maybe writes them back. Depends on Forever's addon API. |
