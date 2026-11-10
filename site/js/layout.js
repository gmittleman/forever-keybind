/* The layout model, with no page code.
   A layout is { keys: {slotId: key}, bar1: {stanceId: [12]}, bars: [[12], ...] }.
   bars[0] is action bar 2, bars[1] action bar 3 and so on, 1 to 4 extra bars.
   Slot ids: st-<stance> (stance bar), b1-<i> (action bar 1, contents follow the active stance), b2-<i> … b5-<i>.
   A slot reference { id, st } pins bar 1 to a stance page; st is null for every other bar. */
import { validKey, long, short } from './keys.js';

export const SLOTS = 12;
export const MIN_BARS = 1;
export const MAX_BARS = 4;

export function emptyRow() { return Array(SLOTS).fill(null); }
export function rowIds(bar) { return Array.from({ length: SLOTS }, (_, i) => bar + '-' + i); }
export function isStance(id) { return id.startsWith('st-'); }
/* 'b3' for 'b3-7' */
export function barOf(id) { return id.split('-')[0]; }

export function model(cls, common) {
  const abilities = Object.assign({}, common.abilities, cls.abilities);
  const book = cls.book.concat(Object.keys(common.abilities));
  const stances = cls.stances;
  const use = cls.use || {};

  const M = {
    cls, book, stances,
    ability: k => abilities[k],
    name: k => abilities[k].name,
    level: k => abilities[k].level || 1,
    stance: id => stances.find(s => s.id === id),
    stanceName: id => abilities[M.stance(id).ability].name,
    /* Does ability k work in stance st? Abilities without a rule work everywhere. */
    works: (k, st) => !use[k] || use[k].includes(st),
    /* The stances an ability is limited to, or null if it works in all of them. */
    only(k) {
      const u = use[k];
      if (!u) return null;
      const ok = stances.filter(s => u.includes(s.id));
      return ok.length < stances.length ? ok : null;
    },
    stanceList: list => list.map(s => M.stanceName(s.id)).join(' or '),

    slotIds: L => stances.map(s => 'st-' + s.id).concat(rowIds('b1'), ...L.bars.map((_, n) => rowIds('b' + (n + 2)))),
    ref: (id, st) => ({ id, st: barOf(id) === 'b1' ? st : null }),
    get(L, r) {
      const [b, i] = r.id.split('-');
      if (b === 'st') return null;
      return b === 'b1' ? L.bar1[r.st][+i] : L.bars[+b.slice(1) - 2][+i];
    },
    set(L, r, k) {
      const [b, i] = r.id.split('-');
      if (b === 'b1') L.bar1[r.st][+i] = k; else L.bars[+b.slice(1) - 2][+i] = k;
    },
    find(L, key) { for (const id in L.keys) if (L.keys[id] === key) return id; return null; },
    /* st: the bar 1 page to name; false names the slot itself, whose keybind every page shares. */
    slotName(id, st) {
      const [b, i] = id.split('-');
      if (b === 'st') return 'Stance bar, ' + M.stanceName(i);
      const page = b === 'b1' ? (st === false ? ' (every stance)' : ' (' + M.stanceName(st) + ')') : '';
      return 'Action bar ' + b.slice(1) + page + ', slot ' + (+i + 1);
    },

    /* A fresh layout from the class's starter plan. */
    fromStarter() {
      const p = cls.starter, L = { keys: {}, bar1: {}, bars: [] };
      stances.forEach(s => { L.bar1[s.id] = emptyRow(); if (p.stances[s.id]) L.keys['st-' + s.id] = p.stances[s.id]; });
      p.bar1.forEach((row, i) => {
        if (row.key) L.keys['b1-' + i] = row.key;
        stances.forEach(s => { if (row[s.id]) L.bar1[s.id][i] = row[s.id]; });
      });
      const n = Math.min(MAX_BARS, Math.max(MIN_BARS, p.bars.length));
      for (let b = 0; b < n; b++) {
        L.bars.push(emptyRow());
        (p.bars[b] || []).forEach(([key, k], i) => { if (key) L.keys['b' + (b + 2) + '-' + i] = key; if (k) L.bars[b][i] = k; });
      }
      return L;
    },

    /* Checks a stored or imported layout. Takes this app's layouts and Fuffenforge's older
       { bar2, bar3 } ones. Returns { L, notes } or { error }. */
    check(o) {
      if (o && o.layout) o = o.layout;
      if (!o || typeof o !== 'object' || !o.bar1 || typeof o.keys !== 'object') return { error: 'That doesn’t look like a keybind layout.' };
      let rows = Array.isArray(o.bars) ? o.bars : [o.bar2, o.bar3].filter(Array.isArray);
      if (rows.length > MAX_BARS) rows = rows.slice(0, MAX_BARS);
      while (rows.length < MIN_BARS) rows.push([]);
      const notes = [], seen = {}, L = { keys: {}, bar1: {}, bars: [] };
      const row = (a, where) => {
        const r = emptyRow();
        if (!Array.isArray(a)) return r;
        for (let i = 0; i < SLOTS; i++) {
          const k = a[i];
          if (k == null || k === '') continue;
          if (typeof k === 'string' && book.includes(k)) r[i] = k;
          else notes.push('Skipped unknown ability “' + k + '” on ' + where + ', slot ' + (i + 1) + '.');
        }
        return r;
      };
      stances.forEach(s => { L.bar1[s.id] = row(o.bar1[s.id], 'Action bar 1 (' + M.stanceName(s.id) + ')'); });
      rows.forEach((r, n) => L.bars.push(row(r, 'Action bar ' + (n + 2))));
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
    /* Each ability's slot and key per page: bar 1 once per stance, every other bar by its id. */
    snap(L) {
      const r = {};
      const put = (k, page, id) => { if (k && !r[k + '|' + page]) r[k + '|' + page] = { k, page, id, key: L.keys[id] || '' }; };
      stances.forEach(s => rowIds('b1').forEach((id, i) => put(L.bar1[s.id][i], s.id, id)));
      L.bars.forEach((row, n) => rowIds('b' + (n + 2)).forEach((id, i) => put(row[i], 'b' + (n + 2), id)));
      return r;
    },
    who: e => M.name(e.k) + (M.stance(e.page) ? ' (' + M.stanceName(e.page) + ')' : ''),
    pageOf: r => r.st || barOf(r.id),

    /* Moves or swaps two slots and says what happened. On the bars an ability keeps its key: keys move
       with it. Bar 1 pages share a key per column, so a move within one page takes the whole column
       along. onKey: dropped on a keyboard key, where the ability takes that key instead. */
    drop(L, src, r, onKey) {
      if (src.from === 'book') { M.set(L, r, src.k); return { msg: 'Placed ' + M.name(src.k) + ' on ' + M.slotName(r.id, r.st) + '.' }; }
      if (src.ref.id === r.id && src.ref.st === r.st) return null;
      const a = M.get(L, src.ref), b = M.get(L, r), before = M.snap(L), skip = [a + '|' + M.pageOf(src.ref)];
      if (b) skip.push(b + '|' + M.pageOf(r));
      if (!onKey && src.ref.st && src.ref.st === r.st) {
        const i = +src.ref.id.split('-')[1], j = +r.id.split('-')[1];
        stances.forEach(s => { const pg = L.bar1[s.id], t = pg[i]; pg[i] = pg[j]; pg[j] = t; });
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
      const line = (id, k, st) => {
        const key = L.keys[id], w = [];
        if (!key && !k) return null;
        if (k) {
          if (M.level(k) > level) w.push('level ' + M.level(k));
          if (st && !M.works(k, st)) w.push('not in ' + M.stanceName(st));
          const only = !st && M.only(k);
          if (only) w.push(M.stanceList(only).replace(/ Stance/g, '') + ' only');
        }
        return '  ' + pad(key ? short(key) : '-') + (k ? M.name(k) : '(empty)') + (w.length ? '  [' + w.join(', ') + ']' : '');
      };
      const section = (t, lines) => { lines = lines.filter(Boolean); out.push('', t, ...(lines.length ? lines : ['  (empty)'])); };
      section('Stance bar', stances.map(s => '  ' + pad(L.keys['st-' + s.id] ? short(L.keys['st-' + s.id]) : '-') + M.stanceName(s.id)));
      stances.forEach(s => section('Action bar 1, ' + M.stanceName(s.id), rowIds('b1').map((id, i) => line(id, L.bar1[s.id][i], s.id))));
      L.bars.forEach((row, n) => section('Action bar ' + (n + 2), rowIds('b' + (n + 2)).map((id, i) => line(id, row[i], null))));
      return out.join('\n');
    }
  };
  return M;
}
