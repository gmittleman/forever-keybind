/* The one-screen desktop layout, Keybind mode, the spellbook sidebar and the phone note. */
const { chromium, devices } = require('playwright');
const { serve, OUT } = require('./env');
(async () => {
  const srv = await serve(), URL = srv.url;
  const b = await chromium.launch();
  const fails = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
  const open = async (viewport, opts = {}) => {
    const ctx = await b.newContext(Object.assign({ viewport }, opts));
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.route(/zamimg|wowhead|fonts\./, r => r.abort());
    await p.goto(URL); await p.waitForSelector('#kbB1 .kb-slot', { state: 'attached' });
    return { ctx, p };
  };

  // ---- everything above the fold ----
  console.log('\n=== layout ===');
  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720]]) {
    const { ctx, p } = await open({ width: w, height: h });
    const r = await p.evaluate(() => {
      const box = s => document.querySelector(s).getBoundingClientRect();
      return { kbd: box('#kbKeys').bottom, vh: innerHeight, key: box('#kbKeys .kk[data-base="Q"]').height,
        book: box('#kbBookWrap'), stage: box('.stage'), sw: document.documentElement.scrollWidth };
    });
    ok(r.kbd <= r.vh, `${w}×${h}: keyboard fully above the fold (bottom ${Math.round(r.kbd)} of ${r.vh})`);
    ok(r.key >= 44, `${w}×${h}: keys at least 44px tall (${Math.round(r.key)})`);
    ok(r.book.left > r.stage.right && r.book.top < 120 && r.book.bottom <= r.vh, `${w}×${h}: spellbook beside the bars, full height`);
    ok(r.sw <= w, `${w}×${h}: no sideways scroll`);
    const k = await p.$eval('#kbKeys .kk[data-base="Q"]', e => { const b = e.getBoundingClientRect(); return [b.width, b.height]; });
    ok(Math.abs(k[0] - k[1]) < 1, `${w}×${h}: keys are square (${Math.round(k[0])}×${Math.round(k[1])})`);
    if (w === 1440) await p.screenshot({ path: OUT + '/layout-1440.png' });
    await ctx.close();
  }
  {
    const { ctx, p } = await open({ width: 2560, height: 1300 });
    const r = await p.evaluate(() => { const box = s => document.querySelector(s).getBoundingClientRect(); return { work: box('.work'), stage: box('.stage'), book: box('#kbBookWrap'), kbd: box('#kbKeys'), b1: box('#kbB1') }; });
    ok(r.work.width <= 1600 && Math.abs((r.work.left + r.work.right) / 2 - 1280) < 2, '2560 wide: work area capped at 1600px and centered');
    ok(r.book.left - r.stage.right <= 20 && Math.abs(r.b1.width - r.kbd.width) < 2, '2560 wide: spellbook right beside the bars; bars as wide as the keyboard');
    await ctx.close();
  }
  {
    const { ctx, p } = await open({ width: 1366, height: 768 });
    await p.click('[data-bars="4"]');
    const r = await p.evaluate(() => ({ kbd: document.querySelector('#kbKeys').getBoundingClientRect().bottom, vh: innerHeight }));
    ok(r.kbd <= r.vh + 40, `1366×768 with 4 extra bars: keyboard still (nearly) above the fold (${Math.round(r.kbd)} of ${r.vh})`);
    ok((await p.$$eval('#kbBars .kb-bar b', x => x.map(y => y.textContent).join(' | '))) === 'Stance bar | Action bar 2 | Action bar 3 | Action bar 4 | Action bar 5 | Action bar 1', 'bar order: stance, 2–5, 1 at the bottom');
    await ctx.close();
  }

  // ---- Keybind mode ----
  console.log('\n=== Keybind mode ===');
  {
    const { ctx, p } = await open({ width: 1440, height: 900 });
    const key = id => p.locator(`#kbBars [data-slot="${id}"] .kb-key`).textContent({ timeout: 300 }).catch(() => '');
    const out = () => p.textContent('#kbOut');
    await p.keyboard.press('q');
    ok((await out()).includes('Hamstring'), 'outside Keybind mode, keys fire');
    await p.click('#kbModeBtn');
    ok((await p.getAttribute('#kbModeBtn', 'aria-pressed')) === 'true' && await p.evaluate(() => document.body.classList.contains('kbmode')) && (await out()).includes('Keybind mode'), 'Keybind mode on');
    await p.keyboard.press('q');
    ok((await out()).includes('Hover a slot first') && (await key('b1-5')) === 'Q', 'a bound key with nothing hovered only hints');
    await p.hover('#kbBars [data-slot="b3-4"]'); await p.keyboard.press('k');
    ok((await key('b3-4')) === 'K' && (await out()).includes('Bound to Action bar 3, slot 5'), 'hover a slot and press K: bound');
    await p.hover('#kbBars [data-slot="b3-5"]'); await p.keyboard.press('k');
    ok((await key('b3-5')) === 'K' && (await key('b3-4')) === '' && (await out()).includes('Moved from'), 'pressing K on another slot moves it');
    await p.hover('#kbBars [data-slot="b3-5"]'); await p.keyboard.press('Shift+k');
    ok((await key('b3-5')) === 's-K', 'Shift+K replaces it');
    await p.keyboard.press('Backspace');
    ok((await key('b3-5')) === '', 'Backspace clears the hovered slot');
    await p.hover('#kbBars [data-slot="b3-6"]');
    await p.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousedown', { button: 4, shiftKey: true, bubbles: true, cancelable: true })));
    ok((await key('b3-6')) === 's-M5', 'Shift + Mouse 5 binds too');
    await p.click('#kbBars [data-slot="b3-7"]');
    ok((await p.getAttribute('#kbBars [data-slot="b3-7"]', 'class')).includes('kb-wait'), 'clicking a slot locks it');
    await p.hover('#kbBars [data-slot="b3-0"]'); await p.keyboard.press('j');
    ok((await key('b3-7')) === 'J' && (await key('b3-0')) === '', 'a locked slot wins over the hovered one');
    await p.keyboard.press('Escape');
    ok((await p.getAttribute('#kbModeBtn', 'aria-pressed')) === 'false' && !(await p.evaluate(() => document.body.classList.contains('kbmode'))), 'Esc leaves Keybind mode');
    await p.keyboard.press('j');
    ok((await out()).includes('Empty slot') && (await out()).includes('Action bar 3, slot 8'), 'J now fires its (empty) slot');
    ok(p.errs.length === 0, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  // ---- spellbook, click-to-move, setup menu ----
  console.log('\n=== spellbook and clicks ===');
  {
    const { ctx, p } = await open({ width: 1440, height: 900 });
    ok(await p.isVisible('#kbBook [data-k="execute"]'), 'spellbook always visible');
    await p.fill('#bookFilter', 'shout');
    const shown = await p.$$eval('#kbBook .kb-sp', els => els.filter(e => !e.hidden).map(e => e.dataset.k).join(','));
    ok(shown === 'bshout,demo,ishout,cshout', 'search filters the spellbook: ' + shown);
    await p.keyboard.press('q');
    ok(!(await p.textContent('#kbOut')).includes('Hamstring'), 'typing in the search box doesn’t fire keys');
    await p.fill('#bookFilter', '');
    await p.click('#kbBook [data-k="cshout"]'); await p.click('#kbBars [data-slot="b3-0"]');
    ok((await p.textContent('#kbBars [data-slot="b3-0"] .kb-name')) === 'Challenging Shout', 'click spellbook, click slot: placed');
    await p.click('#kbBars [data-slot="b3-0"]'); await p.click('#kbBars [data-slot="b3-11"]');
    ok((await p.textContent('#kbBars [data-slot="b3-11"] .kb-name')) === 'Challenging Shout' && (await p.textContent('#kbBars [data-slot="b3-0"] .kb-name')) === '', 'click slot, click slot: moved');
    // dropping on a filled slot picks up what was there, like WoW
    const nm = id => p.textContent(`#kbBars [data-slot="${id}"] .kb-name`);
    const ky = id => p.locator(`#kbBars [data-slot="${id}"] .kb-key`).textContent({ timeout: 300 }).catch(() => '');
    await p.click('#kbBars [data-slot="b2-1"]'); await p.click('#kbBars [data-slot="b2-2"]');
    ok((await nm('b2-2')) === 'Cleave' && (await ky('b2-2')) === 's-1' && (await nm('b2-1')) === 'Sunder Armor' && (await ky('b2-1')) === '2', 'Cleave onto Sunder Armor: they swap, each keeps its key');
    ok((await p.getAttribute('#kbBars [data-slot="b2-1"]', 'class')).includes('kb-held') && (await p.textContent('#kbOut')).includes('Sunder Armor is picked up'), '…and Sunder Armor is picked up');
    await p.click('#kbBars [data-slot="b3-1"]');
    ok((await nm('b3-1')) === 'Sunder Armor' && (await ky('b3-1')) === '2' && (await nm('b2-1')) === '' && (await p.textContent('#kbOut')).startsWith('Moved Sunder Armor'), 'click a slot: Sunder Armor placed there, still on 2');
    await p.click('#kbBars [data-slot="b2-3"]'); await p.click('#kbBars [data-slot="b2-4"]'); await p.keyboard.press('Escape');
    ok((await nm('b2-3')) === 'Demoralizing Shout' && (await ky('b2-3')) === 'T' && !(await p.getAttribute('#kbBars [data-slot="b2-3"]', 'class')).includes('kb-held'), 'Esc leaves the picked-up ability where it landed');
    await p.click('#kbBook [data-k="disarm"]'); await p.click('#kbBars [data-slot="b2-5"]');
    ok((await nm('b2-5')) === 'Disarm' && (await ky('b2-5')) === 'F' && (await p.textContent('#kbOut')).includes('Picked up Bloodrage'), 'from the spellbook onto Bloodrage: Disarm takes F, Bloodrage picked up');
    await p.click('#kbBars [data-slot="b3-2"]');
    ok((await nm('b3-2')) === 'Bloodrage' && (await p.textContent('#kbOut')).startsWith('Placed Bloodrage'), 'and placed elsewhere');
    await p.click('#kbBook [data-k="disarm"]'); await p.click('#kbBars [data-slot="b3-2"]'); await p.keyboard.press('Escape');
    ok((await nm('b3-2')) === 'Disarm' && !(await p.$$eval('#kbBars .kb-name', n => n.map(x => x.textContent))).includes('Bloodrage'), 'Esc drops an ability picked up from the spellbook');
    await p.click('#setupMenu summary');
    ok(await p.isVisible('[data-setup="rename"]'), 'the ⋯ menu opens');
    await p.click('.brand');
    ok(!(await p.isVisible('[data-setup="rename"]')), 'clicking elsewhere closes it');
    await ctx.close();
  }

  // ---- phones get a note ----
  console.log('\n=== phones ===');
  {
    const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    await p.route(/zamimg|wowhead|fonts\./, r => r.abort());
    await p.goto(URL); await p.waitForTimeout(500);
    ok(await p.isVisible('#mobileNote') && !(await p.isVisible('#kbKeys')), 'phone: note instead of the tool');
    ok((await p.textContent('#mobileNote')).includes('Open this on your computer'), 'phone: friendly text');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: note fits the screen');
    await p.screenshot({ path: OUT + '/phone-note.png' });
    await p.tap('#mnAnyway');
    ok(!(await p.isVisible('#mobileNote')) && await p.isVisible('#kbKeys'), 'phone: “Show it anyway” opens the tool');
    await p.reload(); await p.waitForTimeout(400);
    ok(!(await p.isVisible('#mobileNote')), 'phone: stays dismissed for the session');
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ ...devices['iPad Pro 11'] }); const p = await ctx.newPage();
    await p.route(/zamimg|wowhead|fonts\./, r => r.abort());
    await p.goto(URL); await p.waitForTimeout(400);
    ok(await p.isVisible('#mobileNote'), 'tablet (touch only): note too');
    await ctx.close();
  }

  console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'ALL PASSED'));
  process.exitCode = fails.length ? 1 : 0;
  await b.close(); srv.close();
})();
