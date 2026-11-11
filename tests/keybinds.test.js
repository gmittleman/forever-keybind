const { chromium, devices } = require('playwright');
const { serve, OUT } = require('./env');
(async () => {
  const srv = await serve(), URL = srv.url;
  const b = await chromium.launch();
  const fails = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };

  for (const mode of ['wowhead', 'fallback']) {
    console.log(`\n=== ${mode} mode ===`);
    const ctx = await b.newContext({ viewport: { width: 1200, height: 1000 } });
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
    p.on('dialog', d => d.accept());
    if (mode === 'fallback') await p.route(/zamimg|wowhead/, r => r.abort());
    await p.goto(URL);
    await p.evaluate(() => { localStorage.clear(); });
    await p.reload(); await p.waitForTimeout(mode === 'wowhead' ? 1500 : 200);
    ok(await p.evaluate(() => !!window.$WowheadPower) === (mode === 'wowhead'), 'icon mode ' + mode);
    const setLevel = async n => { await p.fill('#levelIn', String(n)); await p.$eval('#levelIn', e => e.dispatchEvent(new Event('change'))); await p.locator('#levelIn').blur(); };
    await setLevel(20);

    // record whether each input's default was prevented (window listener runs after the document handler)
    const rec = () => p.evaluate(() => {
      window.__prev = [];
      for (const t of ['keydown', 'mousedown', 'mouseup', 'auxclick', 'wheel'])
        window.addEventListener(t, e => window.__prev.push(t + ':' + (e.code || e.button || (e.deltaY < 0 ? 'up' : 'down')) + ':' + e.defaultPrevented), { passive: true });
    });
    await rec();
    const lastPrev = () => p.evaluate(() => window.__prev[window.__prev.length - 1]);
    const slot = id => p.locator(`#kbBars [data-slot="${id}"]`);
    const key = id => slot(id).locator('.kb-key').textContent().catch(() => '');
    const name = id => slot(id).locator('.kb-name').textContent();
    const cls = id => slot(id).getAttribute('class');
    const out = () => p.textContent('#kbOut');
    const mouse = (type, button, opts = {}) => p.evaluate(([t, bt, o]) => document.body.dispatchEvent(new MouseEvent(t, Object.assign({ button: bt, bubbles: true, cancelable: true }, o))), [type, button, opts]);
    const wheel = (dy, opts = {}) => p.evaluate(([d, o]) => document.body.dispatchEvent(new WheelEvent('wheel', Object.assign({ deltaY: d, bubbles: true, cancelable: true }, o))), [dy, opts]);
    const kbMode = async on => { if ((await p.getAttribute('#kbModeBtn', 'aria-pressed')) !== String(on)) await p.click('#kbModeBtn'); };

    // ---- 1. layout ----
    ok((await p.textContent('h1')) === 'forever keybind' && (await p.$eval('#setupSel', e => e.selectedOptions[0].textContent)) === 'Warrior', 'standalone page with a default Warrior setup');
    ok((await p.inputValue('#levelIn')) === '20' && (await p.textContent('#saveState')).startsWith('Saved on this device'), 'level set to 20 and saved');
    ok((await p.$$('#kbB1 .kb-slot')).length === 12 && (await p.$$('#kbB2 .kb-slot')).length === 12 && (await p.$$('#kbB3 .kb-slot')).length === 12 && (await p.$$('#kbSt .kb-slot')).length === 3, '12/12/12 slots + 3 stances');
    const b1 = []; for (let i = 0; i < 12; i++) b1.push((await key('b1-' + i)) + '=' + (await name('b1-' + i)));
    console.log('  bar1 battle:', b1.join(', '));
    ok(b1.join(',') === 'M4=Charge,s-M4=Mocking Blow,M5=Overpower,3=Execute,4=Rend,Q=Hamstring,s-Q=Shield Bash,E=Thunder Clap,C=Retaliation,=,=,=', 'bar 1 Battle plan + short labels');
    const b2 = []; for (let i = 0; i < 12; i++) b2.push((await key('b2-' + i)) + '=' + (await name('b2-' + i)));
    ok(b2.join(',') === '1=Heroic Strike,s-1=Cleave,2=Sunder Armor,R=Battle Shout,T=Demoralizing Shout,F=Bloodrage,G=Shoot / Throw,V=Victory Rush,s-C=Intimidating Shout,c-1=Healing Potion,c-2=Bandage,s-2=Slam', 'bar 2 plan: ' + b2.join(','));
    ok((await p.$$('#kbB3 .kb-empty')).length === 12 && (await p.$$('#kbB3 .kb-key')).length === 0, 'bar 3 empty and unbound');
    ok((await key('st-battle')) === 'Z' && (await key('st-def')) === 'X' && (await cls('st-battle')).includes('kb-on'), 'stance bar Z/X, Battle active');
    ok(await p.$eval('#kbBody', e => e.style.getPropertyValue('--kb-st')) === 'var(--rage)' && (await p.textContent('#kbB1 .kb-st')) === 'Battle Stance', 'bar 1 frame shows Battle (red)');
    ok((await cls('b1-3')).includes('kb-dim') && (await slot('b1-3').locator('.kb-lv').textContent()) === '24', 'Execute dimmed with level 24 badge');
    ok((await cls('b2-8')).includes('kb-dim') && (await slot('b2-8').locator('.kb-lv').textContent()) === '22', 'Intimidating Shout level 22 badge');
    ok((await p.$$('#kbBars .kb-red')).length === 0, 'no red slots in the default plan (Battle)');
    if (mode === 'wowhead') {
      ok(await p.$eval('#kbBars [data-slot="b1-0"] .kb-ico', a => a.href) === 'https://www.wowhead.com/forever/spell=100', 'Charge links to Wowhead Forever');
      ok(await p.$eval('#kbBars [data-slot="b2-9"] .kb-ico', a => a.href) === 'https://www.wowhead.com/forever/item=929', 'Healing Potion links to the item');
      ok(await p.$$eval('#kbBars .kb-ico', as => as.every(a => !a.querySelector('.iconsmall,.iconmedium,.icontinyl,[class*="wowhead-icon"]') && a.querySelectorAll('img').length <= 1)), 'Wowhead added no extra icons to slot links');
      await slot('b1-0').locator('.kb-ico').hover(); await p.waitForTimeout(2500);
      const tip = await p.evaluate(() => { const t = document.querySelector('.wowhead-tooltip'); return t && getComputedStyle(t).visibility !== 'hidden' && t.offsetParent !== null ? t.textContent.slice(0, 40) : null; });
      ok(tip && tip.includes('Charge'), 'real Wowhead tooltip on hover: ' + tip);
      await p.mouse.move(5, 5);
    } else {
      ok(await p.$$eval('#kbBars .kb-ico img', i => i.length) === 0 && (await p.textContent('#kbBars [data-slot="b1-0"] .kb-fb')) === 'Ch', 'fallback shows ability initials');
      await slot('b1-0').scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
      await slot('b1-0').locator('.kb-ico').hover();
      ok((await p.textContent('#tt')).includes('Charge') && await p.isVisible('#tt'), 'fallback tooltip on hover');
      await p.mouse.move(5, 5);
    }

    // ---- 2. practice ----
    await p.keyboard.press('q');
    ok((await out()).includes('Hamstring') && (await cls('b1-5')).includes('kb-hit'), 'Q fires Hamstring and flashes');
    ok((await lastPrev()) === 'keydown:KeyQ:true', 'bound Q default prevented');
    await p.keyboard.press('j');
    ok((await lastPrev()) === 'keydown:KeyJ:false', 'unbound J left alone');
    await p.keyboard.press('Space');
    ok((await lastPrev()) === 'keydown:Space:false', 'unbound Space still scrolls');
    await p.keyboard.press('Shift+q');
    ok((await out()).includes('Shield Bash'), 'Shift+Q fires Shield Bash');
    await p.keyboard.press('3');
    ok((await out()).includes('Execute') && (await out()).includes('Not learned yet: level 24'), '3 fires Execute with level warning');
    await mouse('mousedown', 3); await mouse('mouseup', 3); await mouse('auxclick', 3);
    ok((await out()).includes('Charge'), 'Mouse 4 fires Charge');
    ok((await p.evaluate(() => window.__prev.slice(-3).join(' '))) === 'mousedown:3:true mouseup:3:true auxclick:3:true', 'Mouse 4 down/up/auxclick prevented (no browser back)');
    await mouse('mousedown', 3, { shiftKey: true });
    ok((await out()).includes('Mocking Blow'), 'Shift+Mouse 4 fires Mocking Blow');
    await mouse('mousedown', 4);
    ok((await out()).includes('Overpower'), 'Mouse 5 fires Overpower');
    await p.keyboard.press('x');
    ok((await cls('st-def')).includes('kb-on') && (await name('b1-0')) === 'Taunt' && (await key('b1-0')) === 'M4', 'X switches to Defensive, bar 1 swaps, keys stay');
    ok(await p.$eval('#kbBody', e => e.style.getPropertyValue('--kb-st')) === 'var(--mana)' && (await p.textContent('#kbB1 .kb-st')) === 'Defensive Stance', 'bar 1 frame shows Defensive (blue)');
    const def = []; for (let i = 0; i < 12; i++) def.push(await name('b1-' + i));
    ok(def.join(',') === 'Taunt,,Revenge,Shield Block,Rend,Disarm,Shield Bash,Thunder Clap,Shield Wall,,,', 'Defensive page plan: ' + def.join(','));
    ok((await cls('b1-8')).includes('kb-dim'), 'Shield Wall dimmed (28)');
    await mouse('mousedown', 3, { shiftKey: true });
    ok((await out()).includes('Empty slot'), 'Shift+M4 on Defensive page is empty');
    await p.keyboard.press('z');
    ok((await name('b1-0')) === 'Charge', 'Z back to Battle');
    // click in practice mode
    await slot('b2-0').click();
    ok((await out()).includes('Holding Heroic Strike'), 'clicking a slot picks it up');
    await p.keyboard.press('Escape');
    ok((await out()).includes('Press your keys'), 'Esc puts it back');
    // typing in the textarea is ignored
    await p.click('#kbJson'); await p.keyboard.type('q');
    ok((await p.inputValue('#kbJson')) === 'q' && !(await out()).includes('Hamstring'), 'typing in the textarea is not hijacked');
    await p.fill('#kbJson', ''); await p.click('.brand');

    // ---- 3. arrange ----
    ok(await p.isVisible('#kbBookWrap') && (await p.$$('#kbBook .kb-sp')).length === 40, 'spellbook shows 40 entries (30 abilities, 8 talents, potion, bandage)');
    ok((await p.textContent('#kbBook')).includes('Execute') && await p.$eval('#kbBook [data-k="execute"]', e => e.className.includes('kb-dim')), 'spellbook dims Execute');
    await p.$eval('#kbB1', e => e.scrollIntoView({ block: 'center' })); await p.dragAndDrop('#kbBook [data-k="hamstring"]', '#kbBars [data-slot="b3-0"]');
    ok((await name('b3-0')) === 'Hamstring' && (await slot('b3-0').locator('.kb-mark').textContent()) === 'BZ', 'drag book→slot; fixed-bar marker "BZ" (Battle or Berserker)');
    await p.$eval('#kbB1', e => e.scrollIntoView({ block: 'center' })); await p.dragAndDrop('#kbBars [data-slot="b3-0"]', '#kbBars [data-slot="b2-0"]');
    ok((await name('b2-0')) === 'Hamstring' && (await name('b3-0')) === 'Heroic Strike', 'drag slot→filled slot swaps');
    await p.$eval('#kbB1', e => e.scrollIntoView({ block: 'center' })); await p.dragAndDrop('#kbBars [data-slot="b2-0"]', '#kbBars [data-slot="b3-0"]');
    await p.$eval('#kbB1', e => e.scrollIntoView({ block: 'center' })); await p.dragAndDrop('#kbBars [data-slot="b3-0"]', '#kbBook [data-k="charge"]');
    ok((await name('b3-0')) === '' && (await name('b2-0')) === 'Heroic Strike', 'drag slot→spellbook removes');
    // tap flow
    await p.click('#kbBook [data-k="taunt"]');
    ok((await out()).includes('Holding Taunt'), 'tap picks up from spellbook');
    await slot('b3-1').click();
    ok((await name('b3-1')) === 'Taunt' && (await cls('b3-1')).includes('kb-red'), 'tap places Taunt; red in Battle');
    ok((await slot('b3-1').locator('.kb-mark').textContent()) === 'D', 'Taunt marker "D"');
    // pick up Charge from Battle bar 1, switch stance, drop on Defensive bar 1
    await slot('b1-0').click();
    ok((await cls('b1-0')).includes('kb-held'), 'tap picks up a slotted ability');
    await slot('st-def').click();
    ok((await cls('st-def')).includes('kb-on') && (await out()).includes('Holding Charge'), 'stance click switches while holding');
    await slot('b1-1').click();
    ok((await name('b1-1')) === 'Charge' && (await cls('b1-1')).includes('kb-red'), 'dropped Charge on Defensive page (red)');
    await p.keyboard.press('z');
    ok((await name('b1-0')) === '' , 'Battle slot 1 now empty (moved across stances)');
    // move it back with the tap flow, swapping with nothing
    await p.keyboard.press('x'); await slot('b1-1').click(); await p.keyboard.press('z'); await slot('b1-0').click();
    ok((await name('b1-0')) === 'Charge', 'moved Charge back to Battle slot 1');
    // HTML5 drag across stances: hover the stance button mid-drag
    await p.$eval('#kbB2', e => e.scrollIntoView({ block: 'center' }));
    const src = await slot('b1-2').boundingBox(), stB = await slot('st-def').boundingBox();
    await p.evaluate(() => { window.__dd = []; ['dragstart','dragenter','dragover','drop','dragend'].forEach(t => document.addEventListener(t, e => window.__dd.push(t + ':' + ((e.target.closest&&e.target.closest('[data-slot]')||{}).dataset||{}).slot), true)); });
    await p.mouse.move(src.x + 20, src.y + 20); await p.mouse.down();
    await p.mouse.move(src.x + 30, src.y + 30, { steps: 3 });
    await p.mouse.move(stB.x + 20, stB.y + 20, { steps: 5 });
    await p.waitForTimeout(100);
    const tgt = await slot('b1-9').boundingBox();
    await p.mouse.move(tgt.x + 20, tgt.y + 20, { steps: 5 }); await p.mouse.up();
    ok((await cls('st-def')).includes('kb-on') && (await name('b1-9')) === 'Overpower', 'drag over stance switches page; dropped Overpower on Defensive slot 10');
    await p.keyboard.press('z');
    ok((await name('b1-2')) === '', 'Overpower left Battle slot 3');
    // tap slot→spellbook removes
    await p.keyboard.press('x'); await slot('b1-9').click(); await p.click('#kbBookWrap h2');
    ok((await name('b1-9')) === '' && (await out()).includes('Removed Overpower'), 'tap slot then spellbook removes');
    await p.keyboard.press('Escape');

    // ---- 4. rebind ----
    await kbMode(true);
    await slot('b3-1').click();
    ok((await cls('b3-1')).includes('kb-wait'), 'click slot waits for a key');
    await p.keyboard.press('h');
    ok((await key('b3-1')) === 'H', 'bound H');
    await slot('b3-2').click(); await p.keyboard.press('h');
    ok((await key('b3-2')) === 'H' && (await key('b3-1')) === '' && (await out()).includes('Moved from'), 'reusing H moves it');
    await slot('b3-2').click(); await p.keyboard.press('Backspace');
    ok((await key('b3-2')) === '', 'Backspace clears');
    await slot('b2-0').click(); await p.keyboard.press('Escape');
    ok((await key('b2-0')) === '1' && !(await cls('b2-0')).includes('kb-wait'), 'Esc cancels, key unchanged');
    await slot('b3-1').click(); await mouse('mousedown', 1, { altKey: true });
    ok((await key('b3-1')) === 'a-M3', 'Alt+middle mouse binds a-M3');
    await slot('b3-1').click(); await wheel(-100, { shiftKey: true });
    ok((await key('b3-1')) === 's-WU', 'Shift+wheel up binds s-WU');
    await slot('b3-3').click(); await wheel(100);
    ok((await cls('b3-3')).includes('kb-wait') && (await key('b3-3')) === '…', 'plain wheel does not bind (still waiting)');
    await p.keyboard.press('Escape');
    await slot('b3-4').click(); await p.keyboard.press('Control+Shift+F');
    ok((await key('b3-4')) === 'c-s-F', 'Ctrl+Shift+F binds c-s-F');
    // stance keys can be rebound too
    await slot('st-def').click(); await p.keyboard.press('Shift+x');
    ok((await key('st-def')) === 's-X', 'stance rebound to s-X');
    await kbMode(false);
    await p.keyboard.press('z');
    await p.keyboard.press('x');
    ok(!(await cls('st-def')).includes('kb-on') && (await lastPrev()) === 'keydown:KeyX:false', 'plain X now unbound and ignored');
    await p.keyboard.press('Shift+x');
    ok((await cls('st-def')).includes('kb-on'), 'Shift+X switches to Defensive');
    // Taunt on the fixed bar is fine in Defensive, red in Battle; wheel triggers it
    await wheel(-100, { shiftKey: true });
    ok((await out()).includes('Taunt') && !(await out()).includes('Can’t'), 'Shift+wheel up fires Taunt, OK in Defensive');
    ok((await p.evaluate(() => window.__prev.slice(-1)[0])) === 'wheel:up:true', 'bound wheel default prevented');
    await wheel(100, { shiftKey: true });
    ok((await p.evaluate(() => window.__prev.slice(-1)[0])) === 'wheel:down:false', 'unbound Shift+wheel down left alone');
    await p.keyboard.press('z'); await p.waitForTimeout(200);
    await wheel(-100, { shiftKey: true });
    ok((await out()).includes('Can’t be used in Battle Stance. Needs Defensive Stance.'), 'stance warning in Battle: ' + (await out()));

    // ---- 5. save, reset, export/import, summary ----
    await p.reload(); await p.waitForTimeout(300); await rec();
    ok((await key('b3-1')) === 's-WU' && (await name('b3-1')) === 'Taunt' && (await key('st-def')) === 's-X', 'layout survives reload');
    await p.click('[data-act="export"]');
    const json = await p.inputValue('#kbJson');
    const o = JSON.parse(json);
    ok(o.app === 'forever-keybind' && o.v === 2 && o.setup.cls === 'warrior' && o.setup.level === 20 && o.setup.layout.keys['b3-1'] === 'Shift+WheelUp', 'export JSON');
    await p.click('[data-act="reset"]');
    ok((await key('b3-1')) === '' && (await name('b3-1')) === '' && (await key('st-def')) === 'X' && (await name('b1-2')) === 'Overpower', 'Reset to starter layout');
    await p.fill('#kbJson', json); await p.click('[data-act="import"]');
    ok((await name('b3-1')) === 'Taunt' && (await key('st-def')) === 's-X' && (await p.textContent('#kbMsg')).startsWith('Imported as the setup') && (await p.$$('#setupSel option')).length === 2, 'import adds the exported layout as a new setup');
    const bad = JSON.parse(json); bad.setup.layout.bars[0][11] = 'fireball'; bad.setup.layout.keys['b3-11'] = 'Q'; bad.setup.layout.keys['zz-1'] = 'P';
    await p.fill('#kbJson', JSON.stringify(bad)); await p.click('[data-act="import"]');
    const msg = await p.textContent('#kbMsg');
    ok(msg.includes('fireball') && msg.includes('zz-1') && msg.includes('Q was on two slots'), 'import reports bad entries: ' + msg);
    await p.fill('#kbJson', '{oops'); await p.click('[data-act="import"]');
    ok((await p.textContent('#kbMsg')).startsWith('Couldn’t read'), 'bad JSON message');
    const sum = await p.textContent('#kbSum');
    ok(/Action bar 1, Battle Stance\n  M4      Charge/.test(sum) && sum.includes('Execute  [level 24]') && sum.includes('Taunt  [Defensive only]'), 'summary text');
    if (mode === 'wowhead') console.log('\n' + sum.split('\n').slice(0, 16).join('\n') + '\n  ...');
    await p.click('[data-act="reset"]');

    ok(errs.length === 0, 'no console/page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
    if (mode === 'wowhead') {
      await p.goto(URL); await p.waitForTimeout(1500);
      await p.keyboard.press('3');
      await p.screenshot({ path: OUT + '/kb-dark.png', fullPage: true, });
      await p.emulateMedia({ colorScheme: 'light' }); await p.click('#themeToggle').catch(() => {});
    }
    await ctx.close();
  }

  // ---- browser back on Mouse 4 (real button events through CDP) ----
  {
    const ctx = await b.newContext(); const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    await p.route(/zamimg|wowhead|fonts\./, r => r.abort());
    await p.goto(URL + '?from=1'); await p.goto(URL); await p.waitForTimeout(300);
    const cdp = await ctx.newCDPSession(p);
    const press = async (button, buttons) => {
      for (const type of ['mousePressed', 'mouseReleased'])
        await cdp.send('Input.dispatchMouseEvent', { type, x: 600, y: 700, button, buttons: type === 'mousePressed' ? buttons : 0, clickCount: 1 });
      await p.waitForTimeout(300);
    };
    await press('back', 8);
    ok(p.url() === URL && (await p.textContent('#kbOut')).includes('Charge'), 'real Mouse 4 fires Charge and does not go back');
    await ctx.close();
  }


  // ---- light theme screenshot, arrange mode with warnings ----
  {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
    await p.click('#kbBook [data-k="hamstring"]'); await p.click('#kbBars [data-slot="b3-0"]');
    await p.click('#kbBook [data-k="taunt"]'); await p.click('#kbBars [data-slot="b3-1"]');
    await p.click('#kbBars [data-slot="b1-0"]');
    await (await p.$('main')).screenshot({ path: OUT + '/kb-light.png' });
    await p.evaluate(() => localStorage.clear());
    await ctx.close();
  }

  console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'ALL PASSED'));
  process.exitCode = fails.length ? 1 : 0;
  await b.close(); srv.close();
})();
