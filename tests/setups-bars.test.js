/* Sprint 1 features: choosing the number of bars, level, setups, saving, importing and unit checks of keys.js. */
const { chromium } = require('playwright');
const { serve, OUT } = require('./env');
(async () => {
  const srv = await serve(), URL = srv.url;
  const b = await chromium.launch();
  const fails = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
  const fresh = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 1000 } });
    if (opts.init) await ctx.addInitScript(opts.init);
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    p.dialogs = []; p.answer = true;
    p.on('dialog', d => { p.dialogs.push(d.message()); p.answer ? d.accept() : d.dismiss(); });
    await p.route(/zamimg|wowhead|fonts\./, r => r.abort());
    await p.goto(URL); await p.waitForSelector('#kbB1 .kb-slot');
    return { ctx, p };
  };
  const helpers = p => (p.h = {
    name: id => p.textContent(`#kbBars [data-slot="${id}"] .kb-name`),
    key: id => p.locator(`#kbBars [data-slot="${id}"] .kb-key`).textContent({ timeout: 300 }).catch(() => ''),
    bars: () => p.$$eval('#kbBars .kb-bar b', bs => bs.map(x => x.textContent).join(' | ')),
    setups: () => p.$$eval('#setupSel option', os => os.map(o => o.textContent + (o.selected ? '*' : '')).join(', ')),
    saved: () => p.evaluate(() => JSON.parse(localStorage.getItem('forever-keybind'))),
    menu: async name => { if (!(await p.isVisible(`[data-setup="${name}"]`))) await p.click('#setupMenu summary'); await p.click(`[data-setup="${name}"]`); },
    setLevel: async n => { await p.fill('#levelIn', String(n)); await p.$eval('#levelIn', e => e.dispatchEvent(new Event('change'))); await p.locator('#levelIn').blur(); },
    dlg: async (button, fill) => {
      await p.h.menu(button);
      await p.waitForSelector('#setupDlg[open]');
      if (fill) await fill();
      await p.click('#dlgOk');
      await p.waitForSelector('#setupDlg', { state: 'hidden' });
      await p.waitForTimeout(150);
    }
  });

  // ---- bars ----
  console.log('\n=== extra action bars ===');
  {
    const { ctx, p } = await fresh(), h = helpers(p);
    ok((await h.bars()) === 'Stance bar | Action bar 3 | Action bar 2 | Action bar 1', 'starter: 2 extra bars, highest on top, bar 1 at the bottom');
    ok(await p.getAttribute('[data-bars="2"]', 'aria-pressed') === 'true', 'bar count shows 2');
    await p.click('[data-bars="4"]');
    ok((await h.bars()) === 'Stance bar | Action bar 5 | Action bar 4 | Action bar 3 | Action bar 2 | Action bar 1', '4 extra bars: bar 5 on top');
    ok((await p.$$('#kbBars .kb-slot')).length === 3 + 12 * 5, '63 slots');
    ok((await p.$$eval('.kb-legend span', s => s.map(x => x.textContent).join(','))) === 'Action bar 1,Action bar 2,Action bar 3,Action bar 4,Action bar 5,Stance bar', 'keyboard legend lists every bar');
    // put an ability on bar 5 and bind it, see it on the keyboard in its own color
    await p.click('#kbBook [data-k="cleave"]'); await p.click('#kbBars [data-slot="b5-0"]');
    await p.click('#kbModeBtn'); await p.click('#kbBars [data-slot="b5-0"]'); await p.keyboard.press('y');
    ok((await h.name('b5-0')) === 'Cleave' && (await h.key('b5-0')) === 'Y', 'Cleave on bar 5 bound to Y');
    ok((await p.getAttribute('#kbKeys .kk[data-base="Y"]', 'class')).includes('kk-b5'), 'keyboard Y key uses the bar 5 color');
    const c4 = await p.$eval('#kbKeys .kk[data-base="Y"]', e => getComputedStyle(e).borderTopColor);
    const c2 = await p.$eval('#kbKeys .kk[data-base="R"]', e => getComputedStyle(e).borderTopColor);
    ok(c4 !== c2, 'bar 5 and bar 2 keys have different colors (' + c4 + ' vs ' + c2 + ')');
    await p.click('#kbModeBtn');
    // going down to 3 removes an empty bar 5? No: bar 5 has Cleave, so it asks
    p.answer = false; await p.click('[data-bars="3"]');
    ok(p.dialogs.pop().includes('1 ability and 1 keybind') && (await h.bars()).includes('Action bar 5'), 'removing a bar with content asks first; Cancel keeps it');
    ok(await p.getAttribute('[data-bars="4"]', 'aria-pressed') === 'true', 'count stays at 4 after Cancel');
    p.answer = true; await p.click('[data-bars="3"]');
    ok((await h.bars()) === 'Stance bar | Action bar 4 | Action bar 3 | Action bar 2 | Action bar 1', 'OK removes bar 5');
    await p.keyboard.press('y');
    ok(!(await p.textContent('#kbOut')).includes('Cleave') && (await p.getAttribute('#kbKeys .kk[data-base="Y"]', 'class')).includes('kk-free'), 'its keybind Y is gone too');
    const n = p.dialogs.length; await p.click('[data-bars="1"]');
    ok(p.dialogs.length === n && (await h.bars()) === 'Stance bar | Action bar 2 | Action bar 1', 'down to 1: bars 3 and 4 are empty, so no question; bar 2 stays');
    await p.reload(); await p.waitForSelector('#kbB1 .kb-slot');
    ok((await h.bars()) === 'Stance bar | Action bar 2 | Action bar 1' && (await h.saved()).setups[0].layout.bars.length === 1, 'bar count is saved');
    ok(p.errs.length === 0, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  // ---- level ----
  console.log('\n=== level ===');
  {
    const { ctx, p } = await fresh(), h = helpers(p);
    ok((await p.inputValue('#levelIn')) === '60' && !(await p.getAttribute('#kbBars [data-slot="b1-3"]', 'class')).includes('kb-dim'), 'new setup is level 60: Execute learned');
    await h.setLevel(20);
    ok((await p.getAttribute('#kbBars [data-slot="b1-3"]', 'class')).includes('kb-dim') && (await p.textContent('#kbBars [data-slot="b1-3"] .kb-lv')) === '24', 'level 20: Execute dimmed with its level');
    ok((await p.textContent('#kbSum')).includes('Warrior: Warrior, level 20'), 'summary shows the level');
    await h.setLevel(99);
    ok((await p.inputValue('#levelIn')) === '60', 'level out of range resets to 60');
    await h.setLevel(12);
    await p.reload(); await p.waitForSelector('#kbB1 .kb-slot');
    ok((await p.inputValue('#levelIn')) === '12', 'level is saved');
    await ctx.close();
  }

  // ---- setups ----
  console.log('\n=== setups ===');
  {
    const { ctx, p } = await fresh(), h = helpers(p);
    ok((await h.setups()) === 'Warrior*', 'first visit: one setup called Warrior');
    ok((await p.textContent('#saveState')).includes('save automatically'), 'save note shown');
    await p.click('[data-setup="new"]'); await p.waitForSelector('#setupDlg[open]');
    const opts = await p.$$eval('#dlgCls option', os => os.map(o => o.textContent + (o.disabled ? '(x)' : '')));
    ok(opts.length === 9 && opts[0] === 'Warrior' && opts.filter(o => o.endsWith('(coming soon)(x)')).join() === 'Shaman (coming soon)(x)', 'class list: everything but the Shaman ready, Shaman coming soon and disabled');
    ok((await p.inputValue('#dlgName')) === 'Warrior 2', 'suggests a name');
    await p.fill('#dlgName', 'Prot'); await p.fill('#dlgLevel', '30'); await p.click('#dlgOk');
    await p.waitForTimeout(200);
    ok((await h.setups()) === 'Warrior, Prot (Warrior)*' && (await p.inputValue('#levelIn')) === '30', 'New: "Prot" created at level 30 and opened');
    // change Prot, then switch back and forth
    await p.click('#kbBars [data-slot="b1-0"]'); await p.click('#kbBook');
    ok((await h.name('b1-0')) === '', 'Prot: removed Charge');
    await p.selectOption('#setupSel', { index: 0 }); await p.waitForTimeout(200);
    ok((await h.name('b1-0')) === 'Charge' && (await p.inputValue('#levelIn')) === '60', 'Warrior setup untouched');
    await p.selectOption('#setupSel', { index: 1 }); await p.waitForTimeout(200);
    ok((await h.name('b1-0')) === '', 'back on Prot, change still there');
    await h.dlg('rename', () => p.fill('#dlgName', 'Prot dungeons'));
    ok((await h.setups()) === 'Warrior, Prot dungeons (Warrior)*', 'Rename');
    await h.dlg('duplicate');
    ok((await h.setups()) === 'Warrior, Prot dungeons (Warrior), Prot dungeons copy (Warrior)*' && (await h.name('b1-0')) === '' && (await p.inputValue('#levelIn')) === '30', 'Duplicate copies layout and level');
    await h.menu('rename'); await p.waitForSelector('#setupDlg[open]'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    ok((await h.setups()).includes('Prot dungeons copy') && !(await p.isVisible('#setupDlg')), 'Esc closes the dialog without changes');
    await p.keyboard.press('x');
    ok((await p.getAttribute('#kbBars [data-slot="st-def"]', 'class')).includes('kb-on'), 'keys work again after the dialog');
    p.answer = false; await h.menu('delete');
    ok((await h.setups()).includes('copy') && p.dialogs.pop().includes('Delete the setup “Prot dungeons copy”'), 'Delete asks; Cancel keeps it');
    p.answer = true; await h.menu('delete'); await p.waitForTimeout(200);
    ok((await h.setups()) === 'Warrior*, Prot dungeons (Warrior)', 'Delete removes it and opens the first setup');
    await p.reload(); await p.waitForSelector('#kbB1 .kb-slot');
    ok((await h.setups()) === 'Warrior*, Prot dungeons (Warrior)', 'setups and the active one survive reload');
    await p.selectOption('#setupSel', { index: 1 }); await p.waitForTimeout(200);
    await p.reload(); await p.waitForSelector('#kbB1 .kb-slot');
    ok((await h.setups()) === 'Warrior, Prot dungeons (Warrior)*' && (await h.name('b1-0')) === '', 'reload reopens the last setup you used');
    await h.menu('delete'); await p.waitForTimeout(150); await h.menu('delete'); await p.waitForTimeout(200);
    ok((await h.setups()) === 'Warrior*' && (await h.name('b1-0')) === 'Charge', 'deleting the last setup starts a fresh Warrior one');
    const s = await h.saved();
    ok(s.v === 2 && s.setups.length === 1 && s.setups[0].layout.bars.length === 2 && typeof s.setups[0].updated === 'number', 'storage format: v2, setups with layout and timestamp');
    ok(p.errs.length === 0, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  // ---- storage problems ----
  console.log('\n=== storage problems ===');
  {
    const { ctx, p } = await fresh({ init: () => { Storage.prototype.setItem = function () { throw new Error('blocked'); }; } });
    ok((await p.textContent('#saveState')).startsWith('Not saved'), 'blocked storage: clear warning');
    ok(await p.$eval('#saveState', e => e.classList.contains('warn')), 'warning is styled as a warning');
    await p.keyboard.press('q');
    ok((await p.textContent('#kbOut')).includes('Hamstring') && p.errs.length === 0, 'everything else still works');
    await ctx.close();
  }
  {
    const { ctx, p } = await fresh({ init: () => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('forever-keybind', '{not json'); } } });
    ok((await helpers(p).setups()) === 'Warrior*' && p.errs.length === 0, 'unreadable save: page still loads with a fresh setup');
    ok((await p.evaluate(() => localStorage.getItem('forever-keybind-unreadable'))) === '{not json', 'the unreadable save is kept as a backup');
    await ctx.close();
  }

  // ---- import ----
  console.log('\n=== import ===');
  {
    const { ctx, p } = await fresh(), h = helpers(p);
    // an export from the Fuffenforge hub (v1): bar2/bar3 instead of bars
    const v1 = { app: 'fuffenforge-keybinds', v: 1, player: 'warrior', layout: {
      keys: { 'st-battle': 'Z', 'st-def': 'X', 'b1-0': 'Mouse4', 'b2-0': '1', 'b3-0': 'Shift+F' },
      bar1: { battle: ['charge'], def: ['taunt'] }, bar2: ['hstrike'], bar3: ['stoneform', 'bloodrage'] } };
    await p.fill('#kbJson', JSON.stringify(v1)); await p.click('[data-act="import"]'); await p.waitForTimeout(200);
    ok((await h.setups()) === 'Warrior, Imported (Warrior)*', 'Fuffenforge export imports as a new setup');
    ok((await h.name('b2-0')) === 'Heroic Strike' && (await h.key('b3-0')) === 's-F' && (await h.name('b3-1')) === 'Bloodrage', 'bar2/bar3 become action bars 2 and 3');
    ok((await h.name('b3-0')) === 'Stoneform' && (await p.$eval('#raceSel', s => s.value)) === 'dwarf', 'Fuffenforge exports come from a Dwarf: Stoneform kept');
    const v2 = { app: 'forever-keybind', v: 2, setup: { name: 'Shaman stuff', cls: 'shaman', level: 40, layout: {} } };
    await p.fill('#kbJson', JSON.stringify(v2)); await p.click('[data-act="import"]');
    ok((await p.textContent('#kbMsg')).includes('class this site doesn’t support yet'), 'unsupported class is refused');
    await ctx.close();
  }

  // ---- keys.js unit checks, in the browser ----
  console.log('\n=== keys.js ===');
  {
    const { ctx, p } = await fresh();
    const r = await p.evaluate(async () => {
      const K = await import('./js/keys.js');
      const ev = (code, mods = {}) => Object.assign({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false }, mods);
      return {
        shortLabels: ['Shift+Q', 'Ctrl+1', 'Mouse4', 'Shift+WheelUp', 'Ctrl+Alt+Shift+F12', 'Num5', 'Space'].map(K.short).join(' '),
        longLabel: K.long('Shift+Mouse4'),
        keyOf: [K.keyOf(ev('KeyQ', { shiftKey: true }), 'key'), K.keyOf(ev('Digit1', { ctrlKey: true }), 'key'), K.keyOf(ev('ShiftLeft', { shiftKey: true }), 'key'),
          K.keyOf(ev('KeyC', { metaKey: true }), 'key'), K.keyOf({ button: 3, shiftKey: true }, 'mouse'), K.keyOf({ button: 0 }, 'mouse'),
          K.keyOf({ deltaY: -5, shiftKey: true }, 'wheel'), K.keyOf({ deltaY: -5 }, 'wheel'), K.keyOf(ev('IntlBackslash'), 'key')].join(' '),
        valid: ['Q', 'Shift+Q', 'Alt+Ctrl+Q', 'Shift+WheelUp', 'WheelUp', 'Mouse9', 'Ctrl+Alt+Shift+Num0', 'Shift+[', ''].map(K.validKey).join(' ')
      };
    });
    ok(r.shortLabels === 's-Q c-1 M4 s-WU c-a-s-F12 N5 Spc', 'short labels: ' + r.shortLabels);
    ok(r.longLabel === 'Shift + Mouse 4', 'long label');
    ok(r.keyOf === 'Shift+Q Ctrl+1   Shift+Mouse4  Shift+WheelUp  <', 'event to key (modifier-only, Cmd, left click and plain wheel give nothing): ' + r.keyOf);
    ok(r.valid === 'true true false true false false true true false', 'validKey: modifiers in order, wheel needs a modifier: ' + r.valid);
    await ctx.close();
  }

  console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'ALL PASSED'));
  process.exitCode = fails.length ? 1 : 0;
  await b.close(); srv.close();
})();
