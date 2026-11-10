const { chromium, devices } = require('playwright');
const { serve } = require('./env');
(async () => {
  const srv = await serve(), URL = srv.url;
  const b = await chromium.launch();
  const fails = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
  for (const mode of ['wowhead', 'fallback']) {
    console.log(`\n=== keys follow abilities, ${mode} mode ===`);
    const p = await b.newPage({ viewport: { width: 1200, height: 1100 } }); p.setDefaultTimeout(5000);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept());
    if (mode === 'fallback') await p.route(/zamimg|wowhead/, r => r.abort());
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(mode === 'wowhead' ? 1500 : 200);
    const slot = id => p.locator(`#kbBars [data-slot="${id}"]`);
    const name = async id => (await slot(id).locator('.kb-name').textContent()).trim();
    const key = async id => (await slot(id).locator('.kb-key').textContent({ timeout: 200 }).catch(() => '')).trim();
    const at = async id => (await name(id)) + '@' + (await key(id));
    const out = () => p.textContent('#kbOut');
    const cap = k => p.locator(`#kbKeys .kk[data-base="${k}"]`);
    const capName = async k => ((await cap(k).locator('.kk-n').textContent({ timeout: 200 }).catch(() => '')) || '').trim();
    const center = () => p.$eval('#kbB2', e => e.scrollIntoView({ block: 'center' }));
    const drag = async (from, to) => { await center(); await p.dragAndDrop(from, to); };
    const reset = async () => { await p.click('[data-act="reset"]'); };

    // bar 2 → empty bar 3 slot: the key goes along, the old slot is left unbound
    await drag('#kbBars [data-slot="b2-0"]', '#kbBars [data-slot="b3-5"]');
    ok((await at('b3-5')) === 'Heroic Strike@1' && (await at('b2-0')) === '@', 'move to an empty slot: Heroic Strike keeps 1, old slot unbound');
    ok((await out()).includes('It keeps 1'), 'readout says it keeps its key');
    await p.keyboard.press('1');
    ok((await out()).includes('Heroic Strike'), 'pressing 1 still fires Heroic Strike');
    await reset();

    // swap two filled slots on bar 2: both keep their keys
    await drag('#kbBars [data-slot="b2-0"]', '#kbBars [data-slot="b2-3"]');
    ok((await at('b2-3')) === 'Heroic Strike@1' && (await at('b2-0')) === 'Battle Shout@R' && (await out()).includes('Both keep their keys'), 'swap: Heroic Strike@1 and Battle Shout@R both keep keys');
    await reset();

    // within one bar 1 page the whole column moves, so the other stance keeps its key too
    await drag('#kbBars [data-slot="b1-5"]', '#kbBars [data-slot="b1-7"]');
    ok((await at('b1-7')) === 'Hamstring@Q' && (await at('b1-5')) === 'Thunder Clap@E', 'Battle: Hamstring keeps Q, Thunder Clap keeps E');
    ok((await out()).includes('Disarm (Defensive Stance), Thunder Clap (Defensive Stance), Hamstring (Berserker Stance) share a key with it, so they moved too'), 'readout: the other pages moved too — ' + (await out()));
    await p.keyboard.press('x');
    ok((await at('b1-7')) === 'Disarm@Q' && (await at('b1-5')) === 'Thunder Clap@E', 'Defensive: Disarm and Thunder Clap moved along and keep Q and E');
    await p.keyboard.press('z');
    await reset();

    // off a shared bar 1 column: the moved ability keeps its key, the partner is told what it lost
    await drag('#kbBars [data-slot="b1-0"]', '#kbBars [data-slot="b3-6"]');
    ok((await at('b3-6')) === 'Charge@M4' && (await at('b1-0')) === '@', 'Charge to bar 3 keeps M4');
    ok((await out()).includes('Taunt (Defensive Stance) shared that key and now has no key (was M4)'), 'warning about Taunt — ' + (await out()));
    await p.keyboard.press('x');
    ok((await at('b1-0')) === 'Taunt@', 'Defensive: Taunt is unbound');
    await p.keyboard.press('z');
    await reset();

    // onto a filled slot on another bar: both keep keys, the partner takes the swapped key
    await drag('#kbBars [data-slot="b1-0"]', '#kbBars [data-slot="b2-0"]');
    ok((await at('b2-0')) === 'Charge@M4' && (await at('b1-0')) === 'Heroic Strike@1', 'Charge ↔ Heroic Strike across bars, both keep keys');
    ok((await out()).includes('Taunt (Defensive Stance) shared that key and now uses 1 (was M4)'), 'Taunt now on 1');
    await reset();

    // tap flow follows the same rule
    await slot('b2-3').click(); await slot('b3-11').click();
    ok((await at('b3-11')) === 'Battle Shout@R' && (await at('b2-3')) === '@', 'tap move: Battle Shout keeps R');
    await reset();

    // across stances in the same column: both stay on the column's key
    await slot('b1-0').click(); await p.keyboard.press('x'); await slot('b1-0').click();
    ok((await at('b1-0')) === 'Charge@M4', 'Charge onto the Defensive page, same column, keeps M4');
    await p.keyboard.press('z');
    ok((await at('b1-0')) === 'Taunt@M4', 'Taunt swapped onto the Battle page, keeps M4');
    await reset();

    // keyboard keys: dropping on a key gives the ability that key
    await center();
    await slot('b2-1').click(); await cap('R').click();
    ok((await capName('R')) === 'Cleave' && (await at('b2-3')) === 'Cleave@R' && (await at('b2-1')) === 'Battle Shout@s-1', 'tap onto R key: Cleave takes R, Battle Shout takes s-1');
    ok((await out()).includes('Cleave is now on R, and Battle Shout on s-1'), 'readout for key drop');
    await p.$eval('#kbB1', e => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 150));
    await p.dragAndDrop('#kbBars [data-slot="b1-7"]', '#kbKeys .kk[data-base="Q"]');
    ok((await capName('Q')) === 'Thunder Clap' && (await at('b1-5')) === 'Thunder Clap@Q' && (await at('b1-7')) === 'Hamstring@E', 'drag Thunder Clap onto Q key: it takes Q');
    await p.keyboard.press('x');
    ok((await at('b1-5')) === 'Disarm@Q' && (await at('b1-7')) === 'Thunder Clap@E', 'key drop does not move the other stance');
    await p.keyboard.press('z');

    // saved and still consistent after reload
    await p.reload(); await p.waitForTimeout(300);
    ok((await at('b1-5')) === 'Thunder Clap@Q' && (await at('b2-3')) === 'Cleave@R', 'layout survives reload');
    ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
    await p.evaluate(() => localStorage.clear());
    await p.close();
  }
  console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'ALL PASSED'));
  process.exitCode = fails.length ? 1 : 0;
  await b.close(); srv.close();
})();
