/* Keys read like 'Q', 'Shift+Q', 'Ctrl+1', 'Mouse4', 'Shift+WheelUp'.
   Modifiers always come in the order Ctrl, Alt, Shift. Keyboard keys use physical positions
   (event.code), so Shift+1 stays "Shift+1" on any keyboard layout. */

const CODES = {
  Space: 'Space', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', IntlBackslash: '<',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`', Tab: 'Tab',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Delete: 'Del', Insert: 'Ins',
  Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
  NumpadAdd: 'NumAdd', NumpadSubtract: 'NumSub', NumpadMultiply: 'NumMul', NumpadDivide: 'NumDiv', NumpadDecimal: 'NumDec'
};
const SHORT = { Mouse3: 'M3', Mouse4: 'M4', Mouse5: 'M5', WheelUp: 'WU', WheelDown: 'WD', Space: 'Spc', NumAdd: 'N+', NumSub: 'N-', NumMul: 'N*', NumDiv: 'N/', NumDec: 'N.' };
const LONG = { Mouse3: 'Middle mouse', Mouse4: 'Mouse 4', Mouse5: 'Mouse 5', WheelUp: 'Wheel up', WheelDown: 'Wheel down' };
const MODS = ['', 'Ctrl', 'Alt', 'Shift', 'Ctrl+Alt', 'Ctrl+Shift', 'Alt+Shift', 'Ctrl+Alt+Shift'];

function base(code) {
  let m = /^Key([A-Z])$/.exec(code) || /^Digit(\d)$/.exec(code);
  if (m) return m[1];
  if ((m = /^Numpad(\d)$/.exec(code))) return 'Num' + m[1];
  if (/^F\d{1,2}$/.test(code)) return code;
  return CODES[code] || null;
}

/* Cmd/Windows-key combos are left to the browser and the system. */
function mods(e) { return e.metaKey ? null : (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : ''); }

/* The key string for a keyboard, mouse or wheel event, or null if it can't be bound. */
export function keyOf(e, kind) {
  const m = mods(e);
  if (m === null) return null;
  if (kind === 'key') { const b = base(e.code); return b ? m + b : null; }
  if (kind === 'mouse') { const b = { 1: 'Mouse3', 3: 'Mouse4', 4: 'Mouse5' }[e.button]; return b ? m + b : null; }
  const d = e.deltaY || e.deltaX;
  return m && d ? m + (d < 0 ? 'WheelUp' : 'WheelDown') : null;
}

export function validKey(s) {
  if (typeof s !== 'string') return false;
  const p = s.split('+'), b = p.pop(), m = p.join('+');
  if (!MODS.includes(m)) return false;
  if (/^Wheel(Up|Down)$/.test(b)) return !!m;
  if (/^(Mouse[345]|[A-Z0-9]|Num\d|F\d{1,2})$/.test(b)) return true;
  return Object.values(CODES).includes(b);
}

/* In-game style label: s-Q, c-1, M4, s-WU. */
export function short(s) {
  if (!s) return '';
  const p = s.split('+'), b = p.pop();
  return p.map(m => m.charAt(0).toLowerCase() + '-').join('') + (SHORT[b] || b.replace(/^Num(\d)$/, 'N$1'));
}

export function long(s) { const p = s.split('+'), b = p.pop(); return p.concat(LONG[b] || b).join(' + '); }

/* { mods: 'Shift+', base: 'Q' } */
export function split(key) { const p = key.split('+'), b = p.pop(); return { mods: p.length ? p.join('+') + '+' : '', base: b }; }
