const { chromium, devices } = require('playwright');
const { serve, OUT } = require('./env');
(async () => {
  const srv = await serve(), URL = srv.url;
  const b = await chromium.launch();
  const fails = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
  for (const mode of ['wowhead', 'fallback']) {
    console.log(`\n=== keyboard, ${mode} mode ===`);
    const p = await b.newPage({ viewport: { width: 1200, height: 1000 } }); p.setDefaultTimeout(5000);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    if (mode === 'fallback') await p.route(/zamimg|wowhead/, r => r.abort());
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(mode === 'wowhead' ? 1500 : 200);
    const setLevel = async n => { await p.fill('#levelIn', String(n)); await p.$eval('#levelIn', e => e.dispatchEvent(new Event('change'))); await p.locator('#levelIn').blur(); };
    await setLevel(20);
    const capSel = b => `#kbKeys .kk[data-base="${b.replace(/["\\]/g, '\\$&')}"]`;
    const cap = b => p.locator(capSel(b));
    const capName = async b => ((await cap(b).locator('.kk-n').textContent({ timeout: 300 }).catch(() => '')) || '').trim();
    const capCls = b => cap(b).getAttribute('class');
    const mod = m => p.locator(`#kbKeys .kk[data-mod="${m}"]`).first();
    const slotName = id => p.textContent(`#kbBars [data-slot="${id}"] .kb-name`);
    const layer = () => p.textContent('#kbLayer');
    const kbMode = async on => { if ((await p.getAttribute('#kbModeBtn', 'aria-pressed')) !== String(on)) await p.click('#kbModeBtn'); };

    ok((await p.$$('#kbKeys .kk')).length === 61, '61 keys drawn');
    ok(await p.$eval('#kbKeys', k => getComputedStyle(k).gridTemplateColumns.split(' ').length) === 60, '60-column grid');
    ok((await capName('Q')) === 'Hamstring' && (await capCls('Q')).includes('kk-b1'), 'Q: Hamstring, bar 1 color');
    ok((await capName('1')) === 'Heroic Strike' && (await capCls('1')).includes('kk-b2'), '1: Heroic Strike, bar 2 color');
    ok((await capName('Z')) === 'Battle Stance' && (await capCls('Z')).includes('kk-st') && (await capCls('Z')).includes('kb-on'), 'Z: Battle Stance, active');
    ok((await capName('3')) === 'Execute' && (await capCls('3')).includes('kb-dim') && (await cap('3').locator('.kb-lv').textContent()) === '24', '3: Execute dimmed, level 24');
    ok((await capCls('Y')).includes('kk-free') && (await capName('Y')) === '', 'Y: free');
    ok((await capName('\\')) === '' && (await p.$$(capSel('\\'))).length === 1, 'backslash key exists');
    const mouseName = async b => ((await p.locator(`#kbMouse .kk[data-base="${b}"] .kk-n`).textContent({ timeout: 300 }).catch(() => '')) || '').trim();
    ok((await mouseName('Mouse4')) === 'Charge' && (await mouseName('Mouse5')) === 'Overpower' && (await p.textContent('#kbOff')) === '', 'Mouse 4 and 5 binds shown on the mouse, nothing left over');
    ok((await mod('Shift').textContent()).includes('6 binds') && (await mod('Ctrl').textContent()).includes('2 binds'), 'modifier keys count their binds');
    ok(await p.$eval('#kbBody', e => e.style.getPropertyValue('--kb-st')) === 'var(--rage)', 'legend gets the stance color');
    // hold Shift on the real keyboard
    await p.keyboard.down('Shift');
    ok((await capName('Q')) === 'Shield Bash' && (await capName('1')) === 'Cleave' && (await capName('C')) === 'Intimidating Shout' && (await layer()).startsWith('Keyboard and mouse: Shift layer'), 'holding Shift shows the Shift layer');
    ok((await mod('Shift').getAttribute('class')).includes('kk-on') && (await mouseName('Mouse4')) === 'Mocking Blow', 'Shift key lit, Shift + Mouse 4 shows Mocking Blow on the mouse');
    await p.keyboard.press('q');
    ok((await capCls('Q')).includes('kb-hit') && (await p.textContent('#kbOut')).includes('Shield Bash'), 'Shift+Q flashes the Q key');
    await p.keyboard.up('Shift');
    ok((await capName('Q')) === 'Hamstring' && (await layer()).startsWith('Keyboard and mouse: no modifier'), 'releasing Shift goes back');
    // stance switch updates bar 1 keys only
    await p.keyboard.press('x');
    ok((await capName('Q')) === 'Disarm' && (await capCls('Q')).includes('kk-b1') && (await capName('1')) === 'Heroic Strike' && (await capName('E')) === 'Thunder Clap' && (await capName('3')) === 'Shield Block', 'Defensive: bar 1 keys swap, bar 2 stays, Thunder Clap works there now');
    ok(await p.$eval('#kbBody', e => e.style.getPropertyValue('--kb-st')) === 'var(--mana)' && (await p.textContent('#kbB1 .kb-st')) === 'Defensive Stance', 'keyboard follows Defensive Stance');
    await p.keyboard.press('q');
    ok((await capCls('Q')).includes('kb-hit'), 'Q flashes on the keyboard');
    await p.keyboard.press('z');
    // latch modifiers with clicks
    await mod('Ctrl').click();
    ok((await capName('1')) === 'Healing Potion' && (await capName('2')) === 'Bandage' && (await mod('Ctrl').getAttribute('aria-pressed')) === 'true', 'clicking Ctrl latches the Ctrl layer');
    await cap('1').click();
    ok((await p.textContent('#kbOut')).includes('Healing Potion'), 'clicking a key fires it');
    await mod('Ctrl').click();
    ok((await capName('1')) === 'Heroic Strike', 'clicking Ctrl again unlatches');
    await cap('Y').click();
    ok((await p.textContent('#kbOut')).includes('Free key'), 'clicking a free key says so');
    await cap('X').click();
    ok((await capCls('X')).includes('kb-on') && (await capName('Q')) === 'Disarm', 'clicking the X key switches stance');
    await cap('Z').click();
    // put Taunt on bar 3, bind it to Alt+Y by clicking keys
    await p.click('#kbBook [data-k="taunt"]'); await p.click('#kbBars [data-slot="b3-0"]');
    await kbMode(true);
    await p.click('#kbBars [data-slot="b3-0"]');
    await mod('Alt').click(); await cap('Y').click(); await mod('Alt').click();
    ok((await p.textContent('#kbBars [data-slot="b3-0"] .kb-key')) === 'a-Y', 'Rebind: click slot, latch Alt, click Y binds a-Y');
    await mod('Alt').click();
    ok((await capName('Y')) === 'Taunt' && (await capCls('Y')).includes('kk-b3') && (await capCls('Y')).includes('kb-red') && (await cap('Y').locator('.kb-mark').textContent()) === 'D', 'Alt layer: Taunt on Y, bar 3 color, red, D marker');
    await cap('Y').click();
    ok((await p.getAttribute('#kbBars [data-slot="b3-0"]', 'class')).includes('kb-wait'), 'Rebind: clicking a bound key selects its slot');
    await p.keyboard.press('Escape'); await mod('Alt').click();
    ok((await layer()).startsWith('Keyboard and mouse: no modifier'), 'Alt unlatched');
    // arrange: drag from spellbook onto a key, tap keys to pick up and place
    await kbMode(false);
    await cap('1').scrollIntoViewIfNeeded();
    await p.dragAndDrop('#kbBook [data-k="cleave"]', capSel('1'));
    ok((await slotName('b2-0')) === 'Cleave' && (await capName('1')) === 'Cleave', 'drag spellbook → key 1 fills its slot');
    ok((await p.textContent('#kbOut')).includes('Picked up Heroic Strike'), 'the replaced Heroic Strike is picked up');
    await p.keyboard.press('Escape');
    await p.click('#kbBars [data-slot="b2-2"]'); await cap('1').click();
    ok((await slotName('b2-0')) === 'Sunder Armor' && (await slotName('b2-2')) === 'Cleave', 'pick up Sunder Armor, click key 1: Sunder takes 1, Cleave takes 2');
    await cap('Y').click();
    ok((await p.textContent('#kbOut')).includes('Free key'), 'clicking a free key says so');
    // drag the Q key over the X key, drop on E (Defensive page)
    await cap('Q').scrollIntoViewIfNeeded();
    const q = await cap('Q').boundingBox(), xk = await cap('X').boundingBox();
    await p.mouse.move(q.x + 20, q.y + 40); await p.mouse.down();
    await p.mouse.move(q.x + 26, q.y + 46, { steps: 3 }); await p.mouse.move(xk.x + 20, xk.y + 40, { steps: 5 });
    await p.waitForTimeout(80);
    const e2 = await cap('E').boundingBox();
    await p.mouse.move(e2.x + 20, e2.y + 40, { steps: 5 }); await p.mouse.up();
    const eName = await capName('E');
    ok(eName === 'Hamstring' && (await capCls('X')).includes('kb-on'), 'drag Q key over X key, drop on E: Hamstring on the Defensive page (' + eName + ')');
    await p.keyboard.press('z');
    ok((await capName('Q')) === 'Thunder Clap' && (await slotName('b1-5')) === 'Thunder Clap', 'Hamstring left the Battle page; the Defensive Thunder Clap it replaced swapped in');
    await p.keyboard.press('Escape');
    ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    if (mode === 'wowhead') {
      await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
      const top = await p.$eval('#kbKeys', e => e.parentElement.previousElementSibling.getBoundingClientRect().top + scrollY);
      for (const sch of ['dark', 'light']) {
        await p.emulateMedia({ colorScheme: sch });
        await p.screenshot({ path: OUT + '/kbd-' + sch + '.png', clip: { x: 70, y: top - 6, width: 1080, height: 520 }, fullPage: true });
      }
    }
    await p.evaluate(() => localStorage.clear());
    await p.close();
  }
  console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'ALL PASSED'));
  process.exitCode = fails.length ? 1 : 0;
  await b.close(); srv.close();
})();
