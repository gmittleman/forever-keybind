#!/usr/bin/env node
/* Checks the class data against Wowhead's WoW Forever tooltips.

   node tools/wowhead.js check [class ...]   compare every ability with a spell or item id (all ready classes by default)
   node tools/wowhead.js lookup <id ...>      print what Wowhead says about spells (item:<id> for items)

   For each ability, check compares:
   - name: the ability's name, or wowheadName where the site deliberately shows a different one
   - icon
   - level: "Requires level N" (no line means level 1)
   - stance or form: "Requires Battle Stance, Defensive Stance" against the class's use rules.
     A state matches by its name, its ability's name or one of cls.aliases ({"Dire Bear Form": "bear"}).
     Set "wowheadUse": false on an ability whose Forever rule differs on purpose.
   It exits with 1 when anything differs.

   Tooltips are cached in tools/.cache. Delete the folder to fetch fresh ones. Requests go through curl,
   which honours the proxy settings that Node's fetch ignores. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data');
const CACHE = path.join(__dirname, '.cache');
const API = 'https://nether.wowhead.com/forever/tooltip/';

const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

function tooltip(kind, id) {
  const file = path.join(CACHE, kind + '-' + id + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  let out;
  try {
    out = execFileSync('curl', ['-sS', '--fail', '--max-time', '20', API + kind + '/' + id + '?dataEnv=16'], { encoding: 'utf8' });
  } catch (e) {
    return { error: 'request failed (' + (e.stderr || e.message).trim().split('\n')[0] + ')' };
  }
  let d;
  try { d = JSON.parse(out); } catch (e) { return { error: 'not JSON' }; }
  if (!d || !d.name) return { error: 'no such ' + kind };
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(d));
  return d;
}

const text = h => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").trim();

/* The "Requires …" lines of a tooltip: level, class and the rest (stances, forms, weapons). */
function requirements(d) {
  const r = { level: 1, cls: null, other: [] };
  const re = /class="wowhead-tooltip-requirements">([\s\S]*?)<\/(?:span|div)>/g;
  let m;
  while ((m = re.exec(d.tooltip || ''))) {
    const t = text(m[1]).replace(/^Requires\s+/, '');
    const lv = /^level (\d+)$/i.exec(t);
    if (lv) r.level = +lv[1];
    else r.other.push(t);
  }
  return r;
}
function desc(d) {
  const m = /<div class="q">([\s\S]*?)<\/div>/.exec(d.tooltip || '');
  return m ? text(m[1]) : '';
}

const CLASS_NAMES = ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid'];

function checkClass(cls, common) {
  const problems = [];
  const states = (cls.base ? [cls.base] : []).concat(cls.stances || [], cls.hidden || []);
  const abilities = Object.assign({}, common.abilities, cls.abilities);
  const names = {};
  states.forEach(s => {
    if (s.name) names[s.name.toLowerCase()] = s.id;
    if (s.ability && abilities[s.ability]) names[abilities[s.ability].name.toLowerCase()] = s.id;
  });
  Object.entries(cls.aliases || {}).forEach(([n, id]) => { names[n.toLowerCase()] = id; });
  const isCommon = k => !!common.abilities[k] && !cls.abilities[k];
  const use = cls.use || {};
  const books = new Set(cls.book.concat(Object.keys(common.abilities)));

  for (const k of Object.keys(abilities)) {
    if (isCommon(k) && cls.id !== 'common') continue;
    const a = abilities[k];
    const kind = a.spell ? 'spell' : a.item ? 'item' : null;
    if (!kind) { problems.push(k + ': no spell or item id'); continue; }
    const d = tooltip(kind, a.spell || a.item);
    const at = k + ' (' + kind + ' ' + (a.spell || a.item) + ')';
    if (d.error) { problems.push(at + ': ' + d.error); continue; }
    const want = a.wowheadName || a.name;
    if (d.name !== want) problems.push(at + ': name is "' + d.name + '" on Wowhead, "' + want + '" here' + (a.wowheadName ? '' : ' (set wowheadName if that is on purpose)'));
    if (a.icon && d.icon && d.icon !== a.icon) problems.push(at + ': icon is ' + d.icon + ' on Wowhead, ' + a.icon + ' here');
    if (kind === 'item') continue;
    const r = requirements(d);
    if ((a.level || 1) !== r.level) problems.push(at + ': level ' + r.level + ' on Wowhead, ' + (a.level || 1) + ' here');
    const clsReq = r.other.filter(t => CLASS_NAMES.includes(t));
    if (cls.name && clsReq.length && !clsReq.includes(cls.name) && !a.race) problems.push(at + ': Wowhead says "Requires ' + clsReq.join(', ') + '"');
    /* stance or form lines: the ones naming states we know */
    const wanted = [];
    let unknown = [];
    r.other.filter(t => !CLASS_NAMES.includes(t)).forEach(t => {
      const parts = t.split(/,\s*/);
      const ids = parts.map(p => names[p.toLowerCase()]);
      if (ids.some(Boolean)) {
        ids.forEach((id, i) => { if (id) wanted.push(id); else unknown.push(parts[i]); });
      } else if (/ (Stance|Form)$/.test(t)) unknown.push(t);
    });
    unknown = [...new Set(unknown)];
    if (unknown.length) problems.push(at + ': needs ' + unknown.join(', ') + ', which this class file doesn’t know (add it to aliases?)');
    if (unknown.length || a.wowheadUse === false || !states.length) continue;
    const have = use[k] || null;
    const same = (x, y) => x.length === y.length && x.every(v => y.includes(v));
    if (wanted.length && !(have && same([...new Set(wanted)], have))) {
      problems.push(at + ': Wowhead limits it to ' + [...new Set(wanted)].join(', ') + '; here ' + (have ? have.join(', ') : 'no rule'));
    } else if (!wanted.length && have) {
      problems.push(at + ': here limited to ' + have.join(', ') + ', Wowhead has no stance or form line (set wowheadUse: false if that is on purpose)');
    }
    if (!books.has(k) && !states.some(s => s.ability === k)) problems.push(k + ': not in the spellbook');
  }
  cls.book.forEach(k => { if (!abilities[k]) problems.push(k + ': in the spellbook but has no ability entry'); });
  Object.keys(use).forEach(k => { if (!abilities[k]) problems.push(k + ': has a use rule but no ability entry'); });
  return problems;
}

function check(only) {
  const common = read('common.json');
  const ready = read('classes.json').classes.filter(c => c.ready).map(c => c.id);
  const ids = only.length ? only : ready;
  let bad = 0;
  /* common abilities (potions, bandages) once, against an empty class */
  const sets = [['common', checkClass({ id: 'common', name: null, book: [], abilities: common.abilities }, { abilities: {} })]];
  ids.forEach(id => sets.push([id, checkClass(read(id + '.json'), common)]));
  if (fs.existsSync(path.join(DATA, 'races.json'))) {
    const races = read('races.json');
    sets.push(['races', checkClass({ id: 'races', name: null, book: Object.keys(races.abilities), abilities: races.abilities }, { abilities: {} })]);
  }
  sets.forEach(([id, p]) => {
    bad += p.length;
    console.log(id + ': ' + (p.length ? p.length + ' to look at' : 'matches Wowhead'));
    p.forEach(x => console.log('  - ' + x));
  });
  process.exitCode = bad ? 1 : 0;
}

function lookup(ids) {
  ids.forEach(x => {
    const [kind, id] = /^item:/.test(x) ? ['item', x.slice(5)] : ['spell', x];
    const d = tooltip(kind, id);
    if (d.error) return console.log(x + ': ' + d.error);
    const r = kind === 'spell' ? requirements(d) : null;
    console.log(JSON.stringify({ [kind]: +id, name: d.name, icon: d.icon, level: r ? r.level : undefined, requires: r ? r.other : undefined, desc: desc(d) }));
  });
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'check') check(args);
else if (cmd === 'lookup' && args.length) lookup(args);
else {
  console.log('Usage: node tools/wowhead.js check [class ...]\n       node tools/wowhead.js lookup <spell id | item:id> ...');
  process.exitCode = 2;
}
