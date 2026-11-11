/* The layout model, with no page code.
   A layout is { keys: {slotId: key}, bar1: {pageId: [12]}, bars: [[12], ...], pet?: {petPageId: [10]} }.
   bars[0] is action bar 2, bars[1] action bar 3 and so on, 1 to 4 extra bars.
   Slot ids: st-<state> (stance bar), b1-<i> (action bar 1, contents follow the current page), b2-<i> … b5-<i>,
   p-<i> (pet bar, contents follow the current pet: a warlock's Imp or Voidwalker).

   States: what the character is in right now (a warrior stance, a druid form, Prowl, Stealth, caster form).
   - cls.stances: the stance bar, in order. Each has its own action bar 1 page unless page is false
     (Travel Form keeps the caster page; paladin auras never swap). Classes without one have [].
   - cls.base: an optional default state with its own page and no button (the druid's caster form, a rogue out of
     Stealth, a mage). Pressing the active form again returns to it.
   - cls.hidden: states entered by pressing an ability on a bar, optionally inside another state (Prowl within Cat
     Form, a rogue's Stealth). Pressing it again leaves it.
   Pages: base and every state with its own page. A slot reference { id, st } pins a paged bar to a page: st is the
   bar 1 page for b1, the pet page for p, and null for every other bar.

   Rules: cls.use lists the states an ability works in. Class abilities without a rule work in cls.castIn if the
   class has it (druid spells only out of form), otherwise everywhere. A hidden state also allows what its
   parent allows (Cat Form abilities work while prowling).

   Talents: abilities with talent: true (and a tree) count as learned only when the setup has taken them.
   Pet abilities (pet: true) go on the pet bar only, and everything else only on the other bars. A pet ability
   with pets: [...] only works for those pets. */
import { validKey, long, short } from './keys.js';

export const SLOTS = 12;
export const PET_SLOTS = 10;
export const MIN_BARS = 1;
export const MAX_BARS = 4;

export function emptyRow(n) { return Array(n || SLOTS).fill(null); }
export function rowIds(bar) { return Array.from({ length: bar === 'p' ? PET_SLOTS : SLOTS }, (_, i) => bar + '-' + i); }
export function isStance(id) { return id.startsWith('st-'); }
/* 'b3' for 'b3-7' */
export function barOf(id) { return id.split('-')[0]; }

/* racials: the race's abilities for this class, { key: ability } (see racials() in app.js).
   talents: the talent abilities the setup has taken.
   who: { race, faction } of the setup. Abilities with faction (mage teleports) or races (Summon Charger) only show
   for those; with no race chosen yet, everything shows. */
export function model(cls, common, racials, talents, who) {
  racials = racials || {};
  who = who || {};
  const taken = new Set(talents || []);
  const abilities = Object.assign({}, common.abilities, racials, cls.abilities);
  const own = Object.keys(racials).filter(k => !cls.abilities[k]);
  const fits = k => { const a = abilities[k]; return (!a.faction || !who.faction || a.faction === who.faction) && (!a.races || !who.race || a.races.includes(who.race)); };
  const book = cls.book.filter(fits).concat(own, Object.keys(common.abilities));
  const base = cls.base || null;
  const stances = cls.stances || [];
  const hidden = cls.hidden || [];
  const states = (base ? [base] : []).concat(stances, hidden);
  /* the states you can be in outside hidden ones; markers and "only in" lists use these */
  const main = (base ? [base] : []).concat(stances);
  const pages = states.filter(s => s === base || s.page !== false);
  const use = cls.use || {};
  const pet = cls.pet || null;
  const petPages = pet ? pet.pages : [];
  const word = cls.stateWord || 'stance';
  const paged = b => b === 'b1' || b === 'p';

  const M = {
    cls, book, stances, states, pages, base, pet, petPages,
    /* where a new setup starts: caster form, or the first stance */
    start: (base || stances[0]).id,
    petStart: petPages.length ? petPages[0].id : null,
    /* more than one state: the class has something that swaps or lights up */
    hasStates: states.length > 1,
    /* a stance bar whose states limit what works (not paladin auras): worth saying "Any stance" */
    restricts: stances.length > 0 && (Object.keys(use).length > 0 || !!cls.castIn),
    ability: k => abilities[k],
    racial: k => !!racials[k] && !cls.abilities[k],
    isPet: k => !!(abilities[k] && abilities[k].pet),
    talent: k => !!(abilities[k] && abilities[k].talent),
    /* learned as far as talents go: not a talent, or a talent the setup took */
    taken: k => !M.talent(k) || taken.has(k),
    talents: () => [...taken],
    take: (k, on) => { if (on) taken.add(k); else taken.delete(k); },
    name: k => abilities[k].name,
    level: k => abilities[k].level || 1,
    state: id => states.find(s => s.id === id),
    stance: id => states.find(s => s.id === id),
    stanceName: id => { const s = M.state(id); return s.name || abilities[s.ability].name; },
    stanceLevel: id => { const s = M.state(id); return s.ability ? M.level(s.ability) : 1; },
    petPage: id => petPages.find(p => p.id === id),
    petName: id => M.petPage(id).name,
    /* The bar 1 page a state shows: its own, its parent's, or the base page. */
    pageOf(id) {
      const s = M.state(id);
      if (!s) return id;
      if (s === base || s.page !== false) return s.id;
      return s.within ? M.pageOf(s.within) : (base || stances[0]).id;
    },
    /* The state an ability enters when pressed, if any (Prowl, Stealth or Vanish on a bar, or a stance placed
       there). A state can list more abilities that enter it in enteredBy. */
    stateFor: k => states.find(s => s.ability === k || (s.enteredBy || []).includes(k)),
    /* The pet page an ability summons (Summon Imp). */
    petFor: k => petPages.find(p => p.summon === k),
    /* Pressing state t while in state cur: where you end up, or why not. */
    enter(cur, t) {
      const s = M.state(t);
      if (s.id === cur || s.id === M.shown(cur)) return { next: s.within || (base && s !== base ? base.id : cur) };
      if (s.within && cur !== s.within) return { next: cur, warn: 'Needs ' + M.stanceName(s.within) + '.' };
      return { next: s.id };
    },
    /* The state that lights up on the stance bar: Cat Form while prowling. */
    shown: cur => { const s = M.state(cur); return s && s.within ? s.within : cur; },

    /* castIn only covers the class's own abilities: potions, bandages and racials work in any form. */
    rule: k => use[k] || (cls.abilities[k] && !M.isPet(k) && cls.castIn) || null,
    /* Does ability k work in state st? */
    works(k, st) {
      const r = M.rule(k), s = M.state(st);
      return !r || r.includes(st) || !!(s && s.within && r.includes(s.within));
    },
    /* Does pet ability k work for pet page pg? */
    petWorks: (k, pg) => !abilities[k].pets || abilities[k].pets.includes(pg),
    /* The states an ability is limited to, or null if it works in all main ones. Hidden states only show
       when the rule names them and not their parent: Ravage is Prowl only, Claw is just Cat Form. */
    only(k) {
      const r = M.rule(k);
      if (!r) return null;
      const ok = main.filter(s => r.includes(s.id));
      if (ok.length === main.length && !hidden.some(s => !s.within && !r.includes(s.id))) return null;
      return ok.concat(hidden.filter(s => r.includes(s.id) && !r.includes(s.within)));
    },
    /* "Battle or Defensive Stance"-style lists: "A, B or C" */
    stanceList: list => { const n = list.map(s => M.stanceName(s.id)); return n.length > 1 ? n.slice(0, -1).join(', ') + ' or ' + n[n.length - 1] : n.join(''); },
    word,

    slotIds: L => stances.map(s => 'st-' + s.id).concat(rowIds('b1'), ...L.bars.map((_, n) => rowIds('b' + (n + 2))), pet ? rowIds('p') : []),
    /* st can be a state or a page; pet is the pet page on show. Paged bars always hold the page. */
    ref: (id, st, pg) => ({ id, st: barOf(id) === 'b1' ? M.pageOf(st) : barOf(id) === 'p' ? pg : null }),
    get(L, r) {
      const [b, i] = r.id.split('-');
      if (b === 'st') return null;
      if (b === 'p') return L.pet[r.st][+i];
      return b === 'b1' ? L.bar1[r.st][+i] : L.bars[+b.slice(1) - 2][+i];
    },
    set(L, r, k) {
      const [b, i] = r.id.split('-');
      if (b === 'p') L.pet[r.st][+i] = k;
      else if (b === 'b1') L.bar1[r.st][+i] = k; else L.bars[+b.slice(1) - 2][+i] = k;
    },
    /* Can ability k go on slot id? Pet abilities only on the pet bar, and only there. */
    fits: (k, id) => M.isPet(k) === (barOf(id) === 'p'),
    find(L, key) { for (const id in L.keys) if (L.keys[id] === key) return id; return null; },
    /* st: the bar 1 page (or state) to name, or for the pet bar the pet page; false names the slot itself,
       whose keybind every page shares. */
    slotName(id, st) {
      const [b, i] = id.split('-');
      if (b === 'st') return 'Stance bar, ' + M.stanceName(i);
      if (b === 'p') return 'Pet bar' + (petPages.length > 1 ? (st === false ? ' (every pet)' : ' (' + M.petName(st) + ')') : '') + ', slot ' + (+i + 1);
      const page = b === 'b1' && pages.length > 1 ? (st === false ? ' (every page)' : ' (' + M.stanceName(M.pageOf(st)) + ')') : '';
      return 'Action bar ' + b.slice(1) + page + ', slot ' + (+i + 1);
    },

    /* A fresh layout from the class's starter plan. starter.bar1 rows give a key plus what each page shows,
       starter.pet rows a key plus what each pet shows. */
    fromStarter() {
      const p = cls.starter, L = { keys: {}, bar1: {}, bars: [] };
      pages.forEach(s => { L.bar1[s.id] = emptyRow(); });
      stances.forEach(s => { if (p.stances && p.stances[s.id]) L.keys['st-' + s.id] = p.stances[s.id]; });
      p.bar1.forEach((row, i) => {
        if (row.key) L.keys['b1-' + i] = row.key;
        pages.forEach(s => { if (row[s.id]) L.bar1[s.id][i] = row[s.id]; });
      });
      const n = Math.min(MAX_BARS, Math.max(MIN_BARS, p.bars.length));
      for (let b = 0; b < n; b++) {
        L.bars.push(emptyRow());
        (p.bars[b] || []).forEach(([key, k], i) => { if (key) L.keys['b' + (b + 2) + '-' + i] = key; if (k) L.bars[b][i] = k; });
      }
      if (pet) {
        L.pet = {};
        petPages.forEach(pg => { L.pet[pg.id] = emptyRow(PET_SLOTS); });
        (p.pet || []).forEach((row, i) => {
          if (row.key) L.keys['p-' + i] = row.key;
          petPages.forEach(pg => { if (row[pg.id]) L.pet[pg.id][i] = row[pg.id]; });
        });
      }
      return L;
    },

    /* Checks a stored or imported layout. Takes this app's layouts and Fuffenforge's older
       { bar2, bar3 } ones. Pages the layout doesn't have yet (a new stance, a pet) start empty.
       Returns { L, notes } or { error }. */
    check(o) {
      if (o && o.layout) o = o.layout;
      if (!o || typeof o !== 'object' || !o.bar1 || typeof o.keys !== 'object') return { error: 'That doesn’t look like a keybind layout.' };
      let rows = Array.isArray(o.bars) ? o.bars : [o.bar2, o.bar3].filter(Array.isArray);
      if (rows.length > MAX_BARS) rows = rows.slice(0, MAX_BARS);
      while (rows.length < MIN_BARS) rows.push([]);
      const notes = [], seen = {}, L = { keys: {}, bar1: {}, bars: [] };
      const row = (a, where, isPet) => {
        const n = isPet ? PET_SLOTS : SLOTS, r = emptyRow(n);
        if (!Array.isArray(a)) return r;
        for (let i = 0; i < n; i++) {
          const k = a[i];
          if (k == null || k === '') continue;
          const known = typeof k === 'string' && (isPet ? pet.book.includes(k) : book.includes(k));
          if (known) r[i] = k;
          else notes.push('Skipped unknown ability “' + k + '” on ' + where + ', slot ' + (i + 1) + '.');
        }
        return r;
      };
      pages.forEach(s => { L.bar1[s.id] = row(o.bar1[s.id], 'Action bar 1' + (pages.length > 1 ? ' (' + M.stanceName(s.id) + ')' : '')); });
      rows.forEach((r, n) => L.bars.push(row(r, 'Action bar ' + (n + 2))));
      if (pet) {
        L.pet = {};
        petPages.forEach(pg => { L.pet[pg.id] = row(o.pet && o.pet[pg.id], 'Pet bar (' + pg.name + ')', true); });
      }
      const ids = M.slotIds(L);
      Object.keys(o.keys).forEach(id => {
        const key = o.keys[id];
        if (!ids.includes(id)) notes.push('Skipped unknown slot “' + id + '”.');
        else if (!validKey(key)) notes.push('Skipped invalid key “' + key + '”.');
        else if (seen[key]) notes.push(long(key) + ' was on two slots. Kept the first.');
        else { seen[key] = 1; L.keys[id] = key; }
      });
      return { L, notes };
    },

    /* What would be lost by going down to n extra bars. */
    barLoss(L, n) {
      let abil = 0, keys = 0;
      for (let b = n; b < L.bars.length; b++) {
        abil += L.bars[b].filter(Boolean).length;
        keys += rowIds('b' + (b + 2)).filter(id => L.keys[id]).length;
      }
      return { abilities: abil, keys };
    },
    setBars(L, n) {
      n = Math.min(MAX_BARS, Math.max(MIN_BARS, n));
      while (L.bars.length < n) L.bars.push(emptyRow());
      while (L.bars.length > n) {
        const b = 'b' + (L.bars.length + 1);
        rowIds(b).forEach(id => delete L.keys[id]);
        L.bars.pop();
      }
    },

    swapKeys(L, x, y) {
      if (x === y) return;
      const K = L.keys, t = K[x];
      if (K[y]) K[x] = K[y]; else delete K[x];
      if (t) K[y] = t; else delete K[y];
    },
    /* The pages of a paged bar, as { id, rows } */
    pagesOf: (L, b) => b === 'b1' ? pages.map(s => ({ id: s.id, row: L.bar1[s.id] })) : petPages.map(pg => ({ id: 'p:' + pg.id, row: L.pet[pg.id] })),
    /* Each ability's slot and key per page: paged bars once per page, every other bar by its id. */
    snap(L) {
      const r = {};
      const put = (k, page, id) => { if (k && !r[k + '|' + page]) r[k + '|' + page] = { k, page, id, key: L.keys[id] || '' }; };
      M.pagesOf(L, 'b1').forEach(pg => rowIds('b1').forEach((id, i) => put(pg.row[i], pg.id, id)));
      if (pet) M.pagesOf(L, 'p').forEach(pg => rowIds('p').forEach((id, i) => put(pg.row[i], pg.id, id)));
      L.bars.forEach((row, n) => rowIds('b' + (n + 2)).forEach((id, i) => put(row[i], 'b' + (n + 2), id)));
      return r;
    },
    who: e => M.name(e.k) + (e.page.startsWith('p:') ? (petPages.length > 1 ? ' (' + M.petName(e.page.slice(2)) + ')' : '')
      : M.state(e.page) && pages.length > 1 ? ' (' + M.stanceName(e.page) + ')' : ''),
    pageOfRef: r => barOf(r.id) === 'p' ? 'p:' + r.st : r.st || barOf(r.id),

    /* Moves or swaps two slots and says what happened. On the bars an ability keeps its key: keys move
       with it. Paged bars share a key per column, so a move within one page takes the whole column
       along. onKey: dropped on a keyboard key, where the ability takes that key instead.
       Returns null when nothing changed, or { error } when the ability can't go there. */
    drop(L, src, r, onKey) {
      if (!M.fits(src.k, r.id)) return { error: M.isPet(src.k) ? M.name(src.k) + ' is a pet ability: it only goes on the pet bar.' : 'Only pet abilities go on the pet bar.' };
      if (src.from === 'book') { M.set(L, r, src.k); return { msg: 'Placed ' + M.name(src.k) + ' on ' + M.slotName(r.id, r.st) + '.' }; }
      if (src.ref.id === r.id && src.ref.st === r.st) return null;
      const a = M.get(L, src.ref), b = M.get(L, r);
      if (b && !M.fits(b, src.ref.id)) return { error: M.name(b) + (M.isPet(b) ? ' is a pet ability and can’t leave the pet bar.' : ' can’t go on the pet bar.') };
      const before = M.snap(L), skip = [a + '|' + M.pageOfRef(src.ref)];
      if (b) skip.push(b + '|' + M.pageOfRef(r));
      const bar = barOf(r.id);
      if (!onKey && src.ref.st && src.ref.st === r.st && barOf(src.ref.id) === bar && paged(bar)) {
        const i = +src.ref.id.split('-')[1], j = +r.id.split('-')[1];
        M.pagesOf(L, bar).forEach(pg => { const t = pg.row[i]; pg.row[i] = pg.row[j]; pg.row[j] = t; });
        M.swapKeys(L, src.ref.id, r.id);
      } else {
        M.set(L, r, a); M.set(L, src.ref, b);
        if (!onKey) M.swapKeys(L, src.ref.id, r.id);
      }
      const on = id => L.keys[id] ? short(L.keys[id]) : 'no key';
      const msg = onKey
        ? M.name(a) + ' is now on ' + on(r.id) + (b ? ', and ' + M.name(b) + ' on ' + on(src.ref.id) : '') + '.'
        : b ? 'Swapped ' + M.name(a) + ' and ' + M.name(b) + '. Both keep their keys.'
          : 'Moved ' + M.name(a) + ' to ' + M.slotName(r.id, r.st) + '. ' + (L.keys[r.id] ? 'It keeps ' + on(r.id) + '.' : 'It still has no key.');
      const after = M.snap(L), moved = [], warns = [];
      Object.keys(before).forEach(n => {
        const was = before[n], now = after[n];
        if (!now || skip.includes(n)) return;
        if (now.key !== was.key) warns.push(M.who(now) + ' shared that key and now ' + (now.key ? 'uses ' + short(now.key) : 'has no key') + (was.key ? ' (was ' + short(was.key) + ').' : '.'));
        else if (now.id !== was.id) moved.push(M.who(now));
      });
      const sub = moved.length ? moved.join(', ') + (moved.length > 1 ? ' share' : ' shares') + ' a key with it, so ' + (moved.length > 1 ? 'they' : 'it') + ' moved too.' : '';
      return { msg, sub, warns };
    },

    /* Plain-text overview of every bar. */
    summary(L, title, level) {
      const out = [title];
      const pad = t => t.padEnd(8);
      const line = (id, k, st, pg) => {
        const key = L.keys[id], w = [];
        if (!key && !k) return null;
        if (k) {
          if (!M.taken(k)) w.push('talent not taken');
          else if (M.level(k) > level) w.push('level ' + M.level(k));
          if (st && !M.works(k, st)) w.push('not in ' + M.stanceName(st));
          if (pg && !M.petWorks(k, pg)) w.push('not for ' + M.petName(pg));
          const only = !st && !pg && M.only(k);
          if (only) w.push(M.stanceList(only).replace(/ (Stance|Form)/g, '') + ' only');
        }
        return '  ' + pad(key ? short(key) : '-') + (k ? M.name(k) : '(empty)') + (w.length ? '  [' + w.join(', ') + ']' : '');
      };
      const section = (t, lines) => { lines = lines.filter(Boolean); out.push('', t, ...(lines.length ? lines : ['  (empty)'])); };
      if (stances.length) section('Stance bar', stances.map(s => '  ' + pad(L.keys['st-' + s.id] ? short(L.keys['st-' + s.id]) : '-') + M.stanceName(s.id)));
      pages.forEach(s => section('Action bar 1' + (pages.length > 1 ? ', ' + M.stanceName(s.id) : ''), rowIds('b1').map((id, i) => line(id, L.bar1[s.id][i], s.id))));
      L.bars.forEach((row, n) => section('Action bar ' + (n + 2), rowIds('b' + (n + 2)).map((id, i) => line(id, row[i], null))));
      if (pet) petPages.forEach(pg => section('Pet bar' + (petPages.length > 1 ? ', ' + pg.name : ''), rowIds('p').map((id, i) => line(id, L.pet[pg.id][i], null, pg.id))));
      return out.join('\n');
    }
  };
  return M;
}
