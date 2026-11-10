/* Saved setups, in this browser's localStorage under one key:
   { v: 2, active: setupId, setups: [{ id, name, cls, level, layout, updated }] }
   v counts the save format. Bump it when the format changes and convert older saves in load(). */
const KEY = 'forever-keybind';
export const VERSION = 2;

export function newId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* Saved state, or null if there's nothing usable. A save that can't be read is kept under a backup key. */
export function load() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (s && Array.isArray(s.setups) && s.setups.length) return s;
  } catch (e) { /* fall through */ }
  try { localStorage.setItem(KEY + '-unreadable', raw); } catch (e) { /* nothing more to do */ }
  return null;
}

/* true if saved; false if this browser blocks storage (some private windows) or it's full. */
export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(Object.assign({ v: VERSION }, state))); return true; } catch (e) { return false; }
}

export function pref(k, v) {
  try { if (v === undefined) return localStorage.getItem('fk-' + k); localStorage.setItem('fk-' + k, v); } catch (e) { return null; }
}
