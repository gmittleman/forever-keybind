/* forever keybind: the page. Data comes from data/*.json, the layout rules from layout.js,
   key handling from keys.js and saving from store.js.

   There are no modes. Pressing your keys always shows what fires. Abilities can always be dragged,
   or clicked to pick up and clicked again to place. Keybind mode is a toggle, like WoW's /kb addons:
   hover a slot (or click it to lock it) and press a key to bind it. */
import * as K from './keys.js';
import { model, rowIds, isStance, barOf, MIN_BARS, MAX_BARS } from './layout.js';
import * as store from './store.js';

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICONS = 'https://wow.zamimg.com/images/wow/icons/large/';
const WH = 'https://www.wowhead.com/forever/';
/* power.js is a deferred script ahead of this module, so it has run by now if it loaded at all. */
const WH_MODE = !!window.$WowheadPower;
function whRefresh() { if (WH_MODE && window.$WowheadPower.refreshLinks) window.$WowheadPower.refreshLinks(); }

const BAR_LABEL = { st: 'Stance bar', b1: 'Action bar 1', b2: 'Action bar 2', b3: 'Action bar 3', b4: 'Action bar 4', b5: 'Action bar 5' };

const data = { classes: [], common: null, cls: {} };
/* saved: everything in storage. setup: the open setup. M: its class model. L: its layout.
   stance: the bar 1 page on show. held: picked up by a click. kb: Keybind mode on.
   wait: the slot locked for binding in Keybind mode. hover: the slot under the mouse. */
const st = { saved: null, setup: null, M: null, L: null, stance: null, held: null, kb: false, wait: null, hover: null, drag: null, wheelAt: 0, hold: {}, latch: {} };

async function json(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + ': ' + r.status);
  return r.json();
}
async function classData(id) { return data.cls[id] || (data.cls[id] = await json('data/' + id + '.json')); }
function classInfo(id) { return data.classes.find(c => c.id === id); }

/* ---------- Setups ---------- */
async function makeSetup(name, cls, level) {
  const M = model(await classData(cls), data.common);
  return { id: store.newId(), name, cls, level, layout: M.fromStarter(), updated: Date.now() };
}
function setupById(id) { return st.saved.setups.find(s => s.id === id); }

async function openSetup(id) {
  const s = setupById(id);
  st.setup = s;
  st.saved.active = s.id;
  st.M = model(await classData(s.cls), data.common);
  const c = st.M.check(s.layout);
  st.L = c.L || st.M.fromStarter();
  st.stance = st.M.stances[0].id;
  st.held = null; st.wait = null;
  renderSetupBar();
  build(); paint(); idle();
}

function saveNow() {
  st.setup.layout = st.L;
  st.setup.updated = Date.now();
  const ok = store.save(st.saved), el = $('saveState');
  el.classList.toggle('warn', !ok);
  el.textContent = ok ? 'Saved on this device' : 'Not saved: export to keep it';
  el.title = ok
    ? 'Saved at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '. Every change saves automatically in this browser.'
    : 'This browser isn’t letting the page store anything (a private window?). Use Export JSON below to keep your setup.';
  return ok;
}

function renderSetupBar() {
  const s = st.setup, ci = classInfo(s.cls);
  const label = x => x.name === classInfo(x.cls).name ? x.name : x.name + ' (' + classInfo(x.cls).name + ')';
  $('setupSel').innerHTML = st.saved.setups.map(x => '<option value="' + x.id + '"' + (x.id === s.id ? ' selected' : '') + '>' + esc(label(x)) + '</option>').join('');
  $('setupCls').innerHTML = '<span class="cls-dot" style="background:' + ci.color + '"></span>' + esc(ci.name);
  $('levelIn').value = s.level;
  $('barCount').innerHTML = '<span class="lbl">Extra bars</span>' +
    Array.from({ length: MAX_BARS - MIN_BARS + 1 }, (_, i) => i + MIN_BARS)
      .map(n => '<button type="button" data-bars="' + n + '" aria-pressed="' + (st.L.bars.length === n) + '">' + n + '</button>').join('');
}

function setupDialog(kind) {
  const dlg = $('setupDlg'), name = $('dlgName');
  const titles = { new: ['New setup', 'Create'], rename: ['Rename setup', 'Rename'], duplicate: ['Duplicate setup', 'Duplicate'] };
  $('dlgTitle').textContent = titles[kind][0];
  $('dlgOk').textContent = titles[kind][1];
  $('dlgNewOnly').hidden = kind !== 'new';
  if (kind === 'new') {
    $('dlgCls').innerHTML = data.classes.map(c => '<option value="' + c.id + '"' + (c.ready ? '' : ' disabled') + (c.id === st.setup.cls ? ' selected' : '') + '>' + esc(c.name) + (c.ready ? '' : ' (coming soon)') + '</option>').join('');
    $('dlgLevel').value = st.setup.level;
    name.value = classInfo(st.setup.cls).name + ' ' + (st.saved.setups.filter(x => x.cls === st.setup.cls).length + 1);
  } else name.value = kind === 'rename' ? st.setup.name : st.setup.name + ' copy';
  dlg.dataset.kind = kind;
  dlg.returnValue = '';
  dlg.showModal();
  name.select();
}
$('setupDlg').addEventListener('close', async () => {
  const dlg = $('setupDlg'), kind = dlg.dataset.kind, name = $('dlgName').value.trim().slice(0, 40);
  if (dlg.returnValue !== 'ok' || !name) return;
  if (kind === 'rename') { st.setup.name = name; saveNow(); return renderSetupBar(); }
  let s;
  if (kind === 'duplicate') s = Object.assign({}, st.setup, { id: store.newId(), name, layout: JSON.parse(JSON.stringify(st.L)), updated: Date.now() });
  else s = await makeSetup(name, $('dlgCls').value, clampLevel($('dlgLevel').value));
  st.saved.setups.push(s);
  await openSetup(s.id);
  saveNow();
});
async function deleteSetup() {
  if (!confirm('Delete the setup “' + st.setup.name + '”? This can’t be undone.')) return;
  st.saved.setups = st.saved.setups.filter(x => x.id !== st.setup.id);
  if (!st.saved.setups.length) st.saved.setups.push(await makeSetup('Warrior', 'warrior', 60));
  await openSetup(st.saved.setups[0].id);
  saveNow();
}
function clampLevel(v) { v = Math.round(+v); return v >= 1 && v <= 60 ? v : 60; }

$('setupSel').addEventListener('change', async e => { await openSetup(e.target.value); saveNow(); });
$('setupBar').addEventListener('click', e => {
  const b = e.target.closest('[data-setup]');
  if (b) {
    $('setupMenu').open = false;
    return b.dataset.setup === 'delete' ? deleteSetup() : setupDialog(b.dataset.setup);
  }
  const n = e.target.closest('[data-bars]');
  if (n) return setBarCount(+n.dataset.bars);
  if (e.target.closest('#kbModeBtn')) setKb(!st.kb);
});
/* Clicking anywhere else closes the setup menu */
document.addEventListener('click', e => { if (!e.target.closest('#setupMenu')) $('setupMenu').open = false; });
$('levelIn').addEventListener('change', e => {
  st.setup.level = clampLevel(e.target.value);
  e.target.value = st.setup.level;
  saveNow(); paint(); idle();
});
function setBarCount(n) {
  if (n === st.L.bars.length) return;
  const loss = st.M.barLoss(st.L, n);
  if (loss.abilities || loss.keys) {
    const what = [loss.abilities && loss.abilities + (loss.abilities > 1 ? ' abilities' : ' ability'), loss.keys && loss.keys + (loss.keys > 1 ? ' keybinds' : ' keybind')].filter(Boolean).join(' and ');
    if (!confirm('Removing bars also removes ' + what + ' on them. Continue?')) return renderSetupBar();
  }
  st.M.setBars(st.L, n);
  st.held = null; st.wait = null;
  saveNow(); renderSetupBar(); build(); paint(); idle();
}
function setKb(on) {
  st.kb = on; st.wait = null; st.held = null;
  paint(); idle();
}

/* ---------- Drawing ---------- */
const lvl = () => st.setup.level;
function initials(n) {
  const w = n.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean);
  return w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2);
}
function href(k) {
  const a = st.M.ability(k);
  return a.spell ? WH + 'spell=' + a.spell : a.item ? WH + 'item=' + a.item : WH + 'search?q=' + encodeURIComponent(a.name);
}
/* The icon is a Wowhead link, so Wowhead mode gives it a real tooltip. Without Wowhead the initials show. */
function icon(k) {
  const a = st.M.ability(k);
  return '<a class="kb-ico" href="' + href(k) + '" target="_blank" rel="noopener" draggable="false" tabindex="-1" data-k="' + k + '" data-wh-iconize-link="false" data-disable-wowhead-touch-tooltip="true">' +
    '<span class="kb-fb" aria-hidden="true">' + esc(initials(a.name)) + '</span>' +
    (a.icon ? '<img src="' + ICONS + a.icon + '.jpg" alt="" draggable="false" onerror="this.remove()">' : '') + '</a>';
}
function ref(id) { return st.M.ref(id, st.stance); }
function isHeld(id) { return !!(st.held && st.held.ref && st.held.ref.id === id && st.held.ref.st === (isStance(id) ? null : ref(id).st)); }

/* What a slot shows right now: ability, state classes, badges and warnings. Slots and keyboard keys share it. */
function info(id) {
  const M = st.M, r = { k: null, cls: [], extra: '', warn: [] };
  let k, only = null;
  const stn = isStance(id);
  if (stn) { const s = M.stance(id.slice(3)); k = s.ability; if (s.id === st.stance) r.cls.push('kb-on'); }
  else k = M.get(st.L, ref(id));
  if (!k) { r.cls.push('kb-empty'); return r; }
  r.k = k;
  if (M.level(k) > lvl()) { r.cls.push('kb-dim'); r.extra += '<span class="kb-lv">' + M.level(k) + '</span>'; r.warn.push('learned at level ' + M.level(k)); }
  if (!stn && !M.works(k, st.stance)) { r.cls.push('kb-red'); r.warn.push('can’t be used in ' + M.stanceName(st.stance)); }
  if (!stn && barOf(id) !== 'b1') only = M.only(k);
  if (only) {
    const t = 'Only in ' + M.stanceList(only);
    r.extra += '<span class="kb-mark" title="' + esc(t) + '">' + (only.map(x => x.abbr).join('') || '–') + '</span>';
    r.warn.push(t.toLowerCase());
  }
  return r;
}
function paintSlot(el, id) {
  const key = st.L.keys[id], i = info(id), k = i.k, cls = ['kb-slot', ...i.cls];
  if (st.wait === id) cls.push('kb-wait');
  if (isHeld(id)) cls.push('kb-held');
  el.className = cls.join(' ');
  if (k && !isStance(id)) el.setAttribute('draggable', 'true'); else el.removeAttribute('draggable');
  el.setAttribute('aria-label', st.M.slotName(id, st.stance) + '. ' + (key ? K.long(key) : 'Unbound') + '. ' + (k ? st.M.name(k) : 'Empty') + (i.warn.length ? '. ' + i.warn.join(', ') : ''));
  el.innerHTML = '<span class="kb-btn">' + (k ? icon(k) : '') + (st.wait === id ? '<span class="kb-key">…</span>' : key ? '<span class="kb-key">' + esc(K.short(key)) + '</span>' : '') + i.extra + '</span>' +
    '<span class="kb-name">' + (k ? esc(st.M.name(k)) : '') + '</span>';
}
function paintBook(el) {
  const M = st.M, k = el.dataset.k, a = M.ability(k), dim = M.level(k) > lvl(), only = M.only(k);
  el.className = 'kb-sp' + (dim ? ' kb-dim' : '') + (st.held && st.held.from === 'book' && st.held.k === k ? ' kb-held' : '');
  el.setAttribute('draggable', 'true');
  const meta = (a.item ? 'Item' : 'Level ' + M.level(k)) + ' · ' + (only ? M.stanceList(only).replace(/ Stance/g, '') : 'Any stance');
  el.setAttribute('aria-label', a.name + '. ' + meta);
  el.innerHTML = '<span class="kb-btn">' + icon(k) + (dim ? '<span class="kb-lv">' + M.level(k) + '</span>' : '') + '</span>' +
    '<span class="kb-spt"><span class="kb-spn">' + esc(a.name) + '</span><span class="kb-spm">' + esc(meta) + '</span></span>';
}

/* US QWERTY main block: [key, width in quarter keys, 'mod' or 'off' (not bindable here)]. Each row is 60 wide. */
const keyRow = (keys, before, after) => (before || []).concat(keys.split(' ').map(b => [b, 4]), after || []);
const ROWS = [
  keyRow('` 1 2 3 4 5 6 7 8 9 0 - =', null, [['Backspace', 8, 'off']]),
  keyRow('Q W E R T Y U I O P [ ]', [['Tab', 6]], [['\\', 6]]),
  keyRow("A S D F G H J K L ; '", [['Caps', 7, 'off']], [['Enter', 9, 'off']]),
  keyRow('Z X C V B N M , . /', [['Shift', 9, 'mod']], [['Shift', 11, 'mod']]),
  [['Ctrl', 5, 'mod'], ['Win', 5, 'off'], ['Alt', 5, 'mod'], ['Space', 25], ['Alt', 5, 'mod'], ['Win', 5, 'off'], ['Menu', 5, 'off'], ['Ctrl', 5, 'mod']]
];
/* The modifier layer on show: held on the real keyboard, or latched by clicking a modifier key. */
function layerMods() { const r = {}; ['Ctrl', 'Alt', 'Shift'].forEach(m => { r[m] = !!(st.hold[m] || st.latch[m]); }); return r; }
function layer() { const m = layerMods(); return (m.Ctrl ? 'Ctrl+' : '') + (m.Alt ? 'Alt+' : '') + (m.Shift ? 'Shift+' : ''); }
function paintKeys() {
  const box = $('kbKeys');
  if (!box) return;
  const M = st.M, m = layerMods(), pre = layer(), shown = {}, off = [];
  box.querySelectorAll('.kk[data-base]').forEach(el => {
    const b = el.dataset.base, key = pre + b, id = M.find(st.L, key);
    let cls = 'kk', body = '';
    shown[b] = 1;
    if (id) {
      const i = info(id);
      cls += ' kk-' + barOf(id) + ' ' + i.cls.join(' ') + (st.wait === id ? ' kb-wait' : '') + (isHeld(id) ? ' kb-held' : '');
      body = i.k ? '<span class="kb-btn">' + icon(i.k) + i.extra + '</span><span class="kk-n">' + esc(M.name(i.k)) + '</span>' : '<span class="kk-n kk-e">Empty slot</span>';
      el.setAttribute('aria-label', K.long(key) + ': ' + (i.k ? M.name(i.k) : 'empty slot') + ', ' + M.slotName(id, st.stance) + (i.warn.length ? ', ' + i.warn.join(', ') : ''));
    } else { cls += ' kk-free'; el.setAttribute('aria-label', K.long(key) + ': not bound'); }
    if (id && !isStance(id) && M.get(st.L, ref(id))) el.setAttribute('draggable', 'true'); else el.removeAttribute('draggable');
    el.className = cls;
    el.innerHTML = '<span class="kk-l">' + esc(b) + '</span>' + body;
  });
  box.querySelectorAll('.kk[data-mod]').forEach(el => {
    const md = el.dataset.mod, n = Object.values(st.L.keys).filter(key => { const s = K.split(key); return s.mods === md + '+' && shown[s.base]; }).length;
    el.className = 'kk kk-mod' + (m[md] ? ' kk-on' : '');
    el.setAttribute('aria-pressed', m[md] ? 'true' : 'false');
    el.setAttribute('aria-label', md + ' layer, ' + n + ' bound' + (m[md] ? ', showing' : ''));
    el.innerHTML = '<span class="kk-l">' + md + '</span><span class="kk-c">' + (n ? n + (n > 1 ? ' binds' : ' bind') : '') + '</span>';
  });
  Object.keys(st.L.keys).forEach(id => {
    const key = st.L.keys[id], s = K.split(key);
    if (s.mods === pre && !shown[s.base]) { const i = info(id); off.push(K.short(key) + ' ' + (i.k ? M.name(i.k) : '(empty)')); }
  });
  $('kbLayer').textContent = 'Keyboard: ' + (pre ? pre.slice(0, -1).replace(/\+/g, ' + ') + ' layer' : 'no modifier') + '. Hold Shift, Ctrl or Alt, or click them to keep a layer on.';
  $('kbOff').textContent = off.length ? 'Mouse and other keys in this layer: ' + off.join(' · ') + '.' : '';
}

/* Builds bars, spellbook and keyboard for the open setup. */
function build() {
  const bar = (id, title, ids, right) =>
    '<div class="kb-bar" id="' + id + '"><div class="kb-bar-h"><b>' + title + '</b><span class="kb-bar-r">' + (right || '') + '</span></div><div class="kb-slots">' +
    ids.map(s => '<div class="kb-slot" data-slot="' + s + '" role="button" tabindex="0"></div>').join('') + '</div></div>';
  const extra = st.L.bars.map((_, n) => 'b' + (n + 2));
  /* Stance bar on top, extra bars numbered downward, action bar 1 at the bottom like the game's main bar. */
  $('kbBars').innerHTML = bar('kbSt', 'Stance bar', st.M.stances.map(s => 'st-' + s.id)) +
    extra.map(b => bar('kbB' + b.slice(1), BAR_LABEL[b], rowIds(b), 'All stances')).join('') +
    bar('kbB1', 'Action bar 1', rowIds('b1'));
  $('kbLegend').innerHTML = ['b1', ...extra, 'st'].map(b => '<span class="kk-' + b + '">' + BAR_LABEL[b] + '</span>').join('');
  $('kbBook').innerHTML = st.M.book.map(k => '<div class="kb-sp" data-k="' + k + '" role="button" tabindex="0"></div>').join('');
  $('kbKeys').innerHTML = ROWS.map(row => row.map(c => {
    const w = ' style="grid-column:span ' + c[1] + '"';
    if (c[2] === 'mod') return '<div class="kk kk-mod" data-mod="' + c[0] + '" role="button" tabindex="0"' + w + '></div>';
    if (c[2] === 'off') return '<div class="kk kk-off"' + w + '><span class="kk-l">' + c[0] + '</span></div>';
    return '<div class="kk" data-base="' + esc(c[0]) + '"' + w + '></div>';
  }).join('')).join('');
  $('clsNote').textContent = st.M.cls.note || '';
  filterBook();
}
/* Repaints in place, so a drag that starts on a slot survives a stance switch. */
function paint() {
  const s = st.M.stance(st.stance), b1 = $('kbB1');
  $('kbBody').style.setProperty('--kb-st', s.color);
  document.body.classList.toggle('kbmode', st.kb);
  $('kbModeBtn').setAttribute('aria-pressed', st.kb ? 'true' : 'false');
  b1.querySelector('.kb-bar-r').innerHTML = '<span class="kb-st">' + esc(st.M.stanceName(s.id)) + '</span>';
  document.querySelectorAll('#kbBars .kb-slot').forEach(el => paintSlot(el, el.dataset.slot));
  document.querySelectorAll('#kbBook .kb-sp').forEach(paintBook);
  $('kbSum').textContent = st.M.summary(st.L, st.setup.name + ': ' + classInfo(st.setup.cls).name + ', level ' + lvl(), lvl());
  paintKeys();
  tt.style.display = 'none';
  whRefresh();
}
function filterBook() {
  const q = $('bookFilter').value.trim().toLowerCase();
  document.querySelectorAll('#kbBook .kb-sp').forEach(el => { el.hidden = !!q && !st.M.name(el.dataset.k).toLowerCase().includes(q); });
}
$('bookFilter').addEventListener('input', filterBook);

function say(key, title, sub, warns) {
  $('kbOut').innerHTML = '<span class="kb-rk">' + esc(key || '') + '</span><span class="kb-rt"><span class="kb-rn">' + esc(title) + '</span>' +
    (sub ? '<span class="kb-rs">' + esc(sub) + '</span>' : '') + (warns || []).map(w => '<span class="kb-rw">' + esc(w) + '</span>').join('') + '</span>';
}
function idle() {
  if (st.kb && st.wait) return say('…', 'Press a key for ' + st.M.slotName(st.wait, false), 'Backspace clears it, Esc cancels.');
  if (st.kb) return say('', 'Keybind mode', 'Hover a slot and press a key, mouse button or modifier + wheel. Backspace clears. Click a slot to lock it. Esc when you’re done.');
  if (st.held) return say('', 'Holding ' + st.M.name(st.held.k), st.held.from === 'slot' ? 'Click a slot or key to place it (filled ones swap), the spellbook to clear it, or press Esc.' : 'Click a slot or key to place it, or press Esc.');
  say('', 'Press your keys to see what fires', 'Drag abilities from the spellbook onto slots or keys. Turn on Keybind mode to change keys.');
}
function flashEl(el) {
  if (!el) return;
  el.classList.remove('kb-hit'); void el.offsetWidth; el.classList.add('kb-hit');
  setTimeout(() => el.classList.remove('kb-hit'), 350);
}
function flash(id) { flashEl(document.querySelector('#kbBars [data-slot="' + id + '"]')); }
/* Flashes the keyboard key too, when the layer on show is the one pressed. */
function flashKey(key) {
  const s = K.split(key);
  if (s.mods !== layer()) return;
  flashEl([...document.querySelectorAll('#kbKeys .kk[data-base]')].find(el => el.dataset.base === s.base));
}

/* ---------- Actions ---------- */
function switchStance(s) { if (s !== st.stance) { st.stance = s; paint(); } }
function press(id, key) {
  const M = st.M, label = K.short(key), w = [];
  if (isStance(id)) {
    const s = M.stance(id.slice(3));
    switchStance(s.id); flash(id); if (key) flashKey(key);
    if (M.level(s.ability) > lvl()) w.push('Not learned yet: level ' + M.level(s.ability) + ' (you’re ' + lvl() + ').');
    return say(label, M.stanceName(s.id), 'Action bar 1 now shows your ' + M.stanceName(s.id) + ' page.', w);
  }
  const k = M.get(st.L, ref(id));
  flash(id); if (key) flashKey(key);
  if (!k) return say(label, 'Empty slot', M.slotName(id, st.stance));
  if (!M.works(k, st.stance)) w.push('Can’t be used in ' + M.stanceName(st.stance) + '. Needs ' + M.stanceList(M.only(k) || []) + '.');
  if (M.level(k) > lvl()) w.push('Not learned yet: level ' + M.level(k) + ' (you’re ' + lvl() + ').');
  say(label, M.name(k), (key ? K.long(key) + ' · ' : '') + M.slotName(id, st.stance), w);
}
function done(msg, sub, warns) { saveNow(); paint(); say('', msg, sub || '', warns); }
function drop(src, r, onKey) {
  const res = st.M.drop(st.L, src, r, onKey);
  if (!res) return paint();
  done(res.msg, res.sub, res.warns);
}
function removeHeld(src) { st.M.set(st.L, src.ref, null); done('Removed ' + st.M.name(src.k) + ' from ' + st.M.slotName(src.ref.id, src.ref.st) + '.'); }
/* Click-to-move: the first click picks up, the next places. Stance slots switch stance instead. */
function arrange(id, onKey) {
  if (isStance(id)) { switchStance(id.slice(3)); return idle(); }
  const r = ref(id), k = st.M.get(st.L, r), h = st.held;
  if (h) {
    st.held = null;
    if (h.ref && h.ref.id === r.id && h.ref.st === r.st) { paint(); return idle(); }
    return drop(h, r, onKey);
  }
  if (!k) return say('', 'Empty slot', 'Drag an ability here from the spellbook, or click one there first.');
  st.held = { from: 'slot', ref: r, k }; paint(); idle();
}
function bookPick(k) {
  const h = st.held;
  st.held = null;
  if (h && h.from === 'slot') return removeHeld(h);
  if (!h || h.k !== k) st.held = { from: 'book', k };
  paint(); idle();
}
function bind(id, key) {
  const prev = st.M.find(st.L, key);
  if (prev && prev !== id) delete st.L.keys[prev];
  st.L.keys[id] = key; st.wait = null; saveNow(); paint(); flash(id);
  say(K.short(key), 'Bound to ' + st.M.slotName(id, false), prev && prev !== id ? 'Moved from ' + st.M.slotName(prev, false) + ', which is now unbound.' : '');
}
function clearKey(id) { delete st.L.keys[id]; st.wait = null; saveNow(); paint(); say('', 'Cleared the keybind on ' + st.M.slotName(id, false), ''); }
/* In Keybind mode, the slot a key press goes to: the locked one, or the one under the mouse. */
function target() { return st.wait || st.hover; }
function msg(t) { $('kbMsg').textContent = t; }
function copyText(btn, text) {
  const label = btn.dataset.label || (btn.dataset.label = btn.textContent);
  const ok = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = label; }, 1500); };
  const fallback = () => {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); } catch (e) { btn.textContent = 'Select and copy'; }
    ta.remove();
  };
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback(); } catch (e) { fallback(); }
}
async function tool(act, b) {
  if (act === 'reset') {
    if (!confirm('Reset “' + st.setup.name + '” to the starter layout? Its bars and keybinds will be replaced.')) return;
    st.L = st.M.fromStarter(); st.held = null; st.wait = null;
    saveNow(); renderSetupBar(); build(); paint(); idle(); return msg('Back to the starter layout.');
  }
  if (act === 'export') {
    const s = st.setup, json = JSON.stringify({ app: 'forever-keybind', v: store.VERSION, setup: { name: s.name, cls: s.cls, level: s.level, layout: st.L } }, null, 2);
    $('kbJson').value = json; copyText(b, json);
    return msg('The setup is in the box above and copied to your clipboard.');
  }
  if (act === 'import') {
    let o;
    try { o = JSON.parse($('kbJson').value); } catch (e) { return msg('Couldn’t read that JSON. Paste a whole exported setup into the box, then press Import JSON.'); }
    /* forever-keybind exports carry a setup; Fuffenforge's older exports only a warrior layout */
    const src = o && o.setup ? o.setup : { name: 'Imported', cls: 'warrior', level: 60, layout: o && o.layout ? o.layout : o };
    const ci = classInfo(src.cls);
    if (!ci || !ci.ready) return msg('That setup is for a class this site doesn’t support yet.');
    const M = model(await classData(src.cls), data.common), c = M.check(src.layout);
    if (c.error) return msg(c.error);
    const s = { id: store.newId(), name: String(src.name || 'Imported').slice(0, 40), cls: src.cls, level: clampLevel(src.level), layout: c.L, updated: Date.now() };
    st.saved.setups.push(s);
    await openSetup(s.id); saveNow();
    return msg('Imported as the setup “' + s.name + '”.' + (c.notes.length ? ' ' + c.notes.join(' ') : ''));
  }
  if (act === 'summary') copyText(b, $('kbSum').textContent);
}
document.querySelector('.extras').addEventListener('click', e => {
  const x = e.target.closest('[data-act]');
  if (x && st.L) tool(x.dataset.act, x);
});

/* ---------- Pointer events ---------- */
const body = $('kbBody');
body.addEventListener('click', e => {
  if (!st.L) return;
  const t = e.target;
  let x;
  if (t.closest('.kb-ico')) e.preventDefault();
  if ((x = t.closest('.kb-slot'))) {
    const id = x.dataset.slot;
    if (st.kb) { st.wait = st.wait === id ? null : id; paint(); return idle(); }
    return arrange(id);
  }
  if ((x = t.closest('.kk[data-mod]'))) { st.latch[x.dataset.mod] = !st.latch[x.dataset.mod]; paintKeys(); return whRefresh(); }
  if ((x = t.closest('.kk[data-base]'))) {
    const key = layer() + x.dataset.base, bound = st.M.find(st.L, key);
    if (st.kb) {
      if (st.wait) return bind(st.wait, key);
      if (bound) { st.wait = bound; paint(); return idle(); }
      return say(K.short(key), 'Free key', 'Click a slot first, then this key, to bind it.');
    }
    if (st.held) return bound ? arrange(bound, true) : say(K.short(key), 'Free key', K.long(key) + ' isn’t bound to a slot yet. Bind it in Keybind mode first.');
    /* clicking a key is like pressing it */
    if (bound) return press(bound, key);
    return say(K.short(key), 'Free key', K.long(key) + ' isn’t bound to anything yet.');
  }
  if ((x = t.closest('.kb-sp'))) return bookPick(x.dataset.k);
  if (st.held && st.held.from === 'slot' && t.closest('#kbBookWrap') && !t.closest('#bookFilter')) { const h = st.held; st.held = null; return removeHeld(h); }
});
body.addEventListener('pointerover', e => { const s = e.target.closest('.kb-slot'); st.hover = s ? s.dataset.slot : null; });
body.addEventListener('pointerleave', () => { st.hover = null; });
function over(el) {
  const old = body.querySelector('.kb-over');
  if (old && old !== el) old.classList.remove('kb-over');
  if (el) el.classList.add('kb-over');
}
/* The slot under a drag: a bar slot, or the slot bound to a keyboard key in the layer on show. */
function dropTarget(t) {
  const sl = t.closest('.kb-slot');
  if (sl) return { el: sl, id: sl.dataset.slot };
  const kk = t.closest('.kk[data-base]'), id = kk && st.M.find(st.L, layer() + kk.dataset.base);
  return id ? { el: kk, id } : null;
}
body.addEventListener('dragstart', e => {
  const tg = dropTarget(e.target), sp = e.target.closest('.kb-sp');
  if (tg) {
    const r = ref(tg.id), k = isStance(r.id) ? null : st.M.get(st.L, r);
    if (!k) return e.preventDefault();
    st.drag = { from: 'slot', ref: r, k };
  } else if (sp) st.drag = { from: 'book', k: sp.dataset.k };
  else return;
  st.held = null; tt.style.display = 'none';
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', st.M.name(st.drag.k)); } catch (x) { /* some browsers refuse */ }
});
/* Dragging over a stance button or key switches bar 1, so you can drop on the other stance's page. */
body.addEventListener('dragenter', e => {
  const tg = st.drag && dropTarget(e.target);
  if (tg && isStance(tg.id)) switchStance(tg.id.slice(3));
});
body.addEventListener('dragover', e => {
  if (!st.drag) return;
  const tg = dropTarget(e.target), bk = !tg && st.drag.from === 'slot' && e.target.closest('#kbBookWrap');
  if (tg && isStance(tg.id)) { switchStance(tg.id.slice(3)); return; }
  if (tg || bk) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  over(tg ? tg.el : bk || null);
});
body.addEventListener('drop', e => {
  if (!st.drag) return;
  e.preventDefault();
  const d = st.drag, tg = dropTarget(e.target);
  st.drag = null; over(null);
  if (tg && !isStance(tg.id)) drop(d, ref(tg.id), tg.el.classList.contains('kk'));
  else if (d.from === 'slot' && e.target.closest('#kbBookWrap')) removeHeld(d);
});
document.addEventListener('dragend', () => { if (st.drag) { st.drag = null; over(null); } });

/* Fallback tooltips for mouse users. Wowhead mode gets real tooltips from the icon links. */
const tt = $('tt');
function tip(k) {
  const a = st.M.ability(k);
  return '<div class="t-name y">' + esc(a.name) + '</div><div class="gr">' + (a.item ? 'Item' : 'Learned at level ' + st.M.level(k)) + '</div>' +
    (a.desc ? '<div style="margin-top:4px">' + esc(a.desc) + '</div>' : '');
}
function place(x, y) {
  const r = tt.getBoundingClientRect();
  let left = x + 16, top = y + 16;
  if (left + r.width > innerWidth - 8) left = Math.max(8, x - r.width - 16);
  if (top + r.height > innerHeight - 8) top = Math.max(8, y - r.height - 16);
  tt.style.left = left + 'px'; tt.style.top = top + 'px';
}
body.addEventListener('pointerover', e => {
  const a = e.target.closest('.kb-ico');
  if (WH_MODE || e.pointerType !== 'mouse' || !a || st.drag) return;
  tt.innerHTML = tip(a.dataset.k); tt.style.display = 'block'; place(e.clientX, e.clientY);
});
body.addEventListener('pointermove', e => { if (tt.style.display === 'block' && e.target.closest('.kb-ico')) place(e.clientX, e.clientY); });
body.addEventListener('pointerout', e => {
  const a = e.target.closest('.kb-ico');
  if (a && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.kb-ico') === a)) tt.style.display = 'none';
});
window.addEventListener('scroll', () => { tt.style.display = 'none'; }, { passive: true });

/* ---------- Keyboard, mouse buttons and wheel ---------- */
/* Only bound keys lose their browser default; nothing happens while a dialog is open or you type in a field. */
function active() { return !!st.L && !document.querySelector('dialog[open]') && $('mobileNote').hidden; }
function typing(e) { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
/* A bound key outside Keybind mode fires its slot. */
function use(e, key) {
  const id = st.M.find(st.L, key);
  if (!id) return false;
  e.preventDefault();
  press(id, key);
  return true;
}
/* In Keybind mode, binds key to the target slot if there is one. */
function bindTo(e, key) {
  const id = target();
  if (id) { e.preventDefault(); bind(id, key); return; }
  if (st.M.find(st.L, key)) { e.preventDefault(); say(K.short(key), 'Hover a slot first', 'In Keybind mode a key binds the slot under the mouse, or the one you clicked.'); }
}
/* Shows the layer for the modifiers held right now. Any key event carries their state. */
function hold(e) {
  const h = { Ctrl: e.ctrlKey, Alt: e.altKey, Shift: e.shiftKey };
  if (h.Ctrl === !!st.hold.Ctrl && h.Alt === !!st.hold.Alt && h.Shift === !!st.hold.Shift) return;
  st.hold = h; paintKeys(); whRefresh();
}
document.addEventListener('keyup', e => { if (active()) hold(e); });
window.addEventListener('blur', () => { if (active() && (st.hold.Ctrl || st.hold.Alt || st.hold.Shift)) { st.hold = {}; paintKeys(); } });
document.addEventListener('keydown', e => {
  if (!active()) return;
  hold(e);
  if (typing(e)) return;
  if (e.key === 'Escape') {
    if (st.wait) { st.wait = null; paint(); idle(); }
    else if (st.kb) setKb(false);
    else if (st.held) { st.held = null; paint(); idle(); }
    return;
  }
  if (st.kb) {
    if (e.key === 'Backspace' || e.key === 'Delete') { const id = target(); if (id) { e.preventDefault(); clearKey(id); } return; }
    const nk = K.keyOf(e, 'key');
    if (nk) { if (!e.repeat) bindTo(e, nk); else e.preventDefault(); }
    return;
  }
  const key = K.keyOf(e, 'key');
  if (key && st.M.find(st.L, key)) { if (e.repeat) e.preventDefault(); else use(e, key); return; }
  const x = e.target.closest && e.target.closest('.kb-slot,.kb-sp,.kk-mod');
  if (x && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); x.click(); }
});
document.addEventListener('mousedown', e => {
  if (!active()) return;
  const key = K.keyOf(e, 'mouse');
  if (!key) return;
  if (st.kb) return bindTo(e, key);
  use(e, key);
});
/* Mouse 4 and 5 go back and forward on release; stop that for bound buttons. */
function mouseEnd(e) { if (active()) { const key = K.keyOf(e, 'mouse'); if (key && (st.M.find(st.L, key) || (st.kb && target()))) e.preventDefault(); } }
document.addEventListener('mouseup', mouseEnd);
document.addEventListener('auxclick', mouseEnd);
document.addEventListener('wheel', e => {
  if (!active()) return;
  const key = K.keyOf(e, 'wheel');
  if (!key || !((st.kb && target()) || st.M.find(st.L, key))) return;
  e.preventDefault();
  /* one trigger per notch, not per trackpad event */
  const now = Date.now();
  if (now - st.wheelAt < 150) return;
  st.wheelAt = now;
  if (st.kb) bindTo(e, key); else use(e, key);
}, { passive: false });

/* ---------- Theme ---------- */
const root = document.documentElement;
const theme = store.pref('theme');
if (theme) root.setAttribute('data-theme', theme);
$('themeToggle').addEventListener('click', () => {
  let c = root.getAttribute('data-theme');
  if (!c) c = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const next = c === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next); store.pref('theme', next);
});

/* ---------- Layout ---------- */
/* The work area fills the window under the header, whose height depends on how its controls wrap. */
const topBar = $('setupBar');
new ResizeObserver(() => root.style.setProperty('--top-h', topBar.offsetHeight + 'px')).observe(topBar);

/* ---------- Desktop only ---------- */
/* Phones and tablets get a friendly note. "Show it anyway" is remembered for this browser session. */
function mobile() {
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  return touchOnly || innerWidth < 900;
}
let anyway = false;
try { anyway = sessionStorage.getItem('fk-anyway') === '1'; } catch (e) { /* storage blocked */ }
function showNote(on) { $('mobileNote').hidden = !on; document.body.classList.toggle('on-mobile', on); }
if (mobile() && !anyway) showNote(true);
$('mnAnyway').addEventListener('click', () => {
  showNote(false);
  try { sessionStorage.setItem('fk-anyway', '1'); } catch (e) { /* storage blocked */ }
});
$('mnCopy').addEventListener('click', e => copyText(e.target, 'https://forever-keybind.pages.dev/'));

/* ---------- Start ---------- */
async function start() {
  $('iconNote').textContent = WH_MODE ? 'Icons and tooltips are live from Wowhead.' : 'Wowhead didn’t load, so abilities show their initials instead of icons.';
  [data.classes, data.common] = await Promise.all([json('data/classes.json').then(d => d.classes), json('data/common.json')]);
  let saved = store.load();
  if (saved) saved.setups = saved.setups.filter(s => s && classInfo(s.cls) && classInfo(s.cls).ready && s.layout);
  if (!saved || !saved.setups.length) {
    saved = { active: null, setups: [await makeSetup('Warrior', 'warrior', 60)] };
  }
  st.saved = saved;
  await openSetup(setupById(saved.active) ? saved.active : saved.setups[0].id);
  if (saveNow()) $('saveState').textContent = 'Changes save automatically';
}
start().catch(err => {
  say('', 'Something went wrong loading the page', err.message + '. Try reloading.');
  throw err;
});
