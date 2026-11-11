/* Sprint 2: the state engine (stances, druid forms, Prowl), the Forever warrior, the druid and races. */
const { chromium } = require('playwright');
const { serve, OUT } = require('./env');
(async () => {
  const srv = await serve(), URL = srv.url;
  const b = await chromium.launch();
  const fails = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
  const fresh = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    if (opts.init) await ctx.addInitScript(opts.init);
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.route(/zamimg|wowhead|fonts\./, r => r.abort());
    await p.goto(URL); await p.waitForSelector('#kbB1 .kb-slot');
    return { ctx, p };
  };
  const name = (p, id) => p.textContent(`#kbBars [data-slot="${id}"] .kb-name`);
  const cls = (p, id) => p.getAttribute(`#kbBars [data-slot="${id}"]`, 'class');
  const tag = p => p.textContent('#kbB1 .kb-st');
  const tab = p => p.textContent('#kbPages [aria-pressed="true"]');
  const out = p => p.textContent('#kbOut');
  const meta = (p, k) => p.textContent(`#kbBook .kb-sp[data-k="${k}"] .kb-spm`);
  const book = p => p.$$eval('#kbBook .kb-sp', els => els.map(e => e.dataset.k));
  const newSetup = async (p, c, race, level) => {
    await p.click('[data-setup="new"]');
    await p.waitForSelector('#setupDlg[open]');
    await p.selectOption('#dlgCls', c);
    if (race) await p.selectOption('#dlgRace', race);
    if (level) await p.fill('#dlgLevel', String(level));
    await p.click('#dlgOk');
    await p.waitForSelector('#setupDlg', { state: 'hidden' });
    await p.waitForTimeout(150);
  };

  console.log('\n=== layout model: states ===');
  {
    const { ctx, p } = await fresh();
    const r = await p.evaluate(async () => {
      const { model } = await import('./js/layout.js');
      const get = f => fetch('data/' + f).then(x => x.json());
      const [druid, warrior, common] = await Promise.all([get('druid.json'), get('warrior.json'), get('common.json')]);
      const D = model(druid, common), W = model(warrior, common);
      return {
        pages: D.pages.map(s => s.id).join(','),
        start: D.start + ',' + W.start,
        bearTwice: D.enter('bear', 'bear').next,
        catToBear: D.enter('cat', 'bear').next,
        prowlFromCaster: D.enter('caster', 'prowl'),
        prowl: D.enter('cat', 'prowl').next,
        prowlAgain: D.enter('prowl', 'prowl').next,
        catWhileProwl: D.enter('prowl', 'cat').next,
        shown: D.shown('prowl'),
        travelPage: D.pageOf('travel') + ',' + D.pageOf('aquatic') + ',' + D.pageOf('prowl'),
        works: [D.works('claw', 'prowl'), D.works('ravage', 'cat'), D.works('ravage', 'prowl'), D.works('wrath', 'bear'), D.works('potion', 'bear'), D.works('ff', 'cat'), D.works('wrath', 'travel'), D.works('barkskin', 'aquatic')].join(','),
        battleTwice: W.enter('battle', 'battle').next,
        wPages: W.pages.map(s => s.id).join(','),
        wOld: (() => { const c = W.check({ keys: { 'b1-0': 'Mouse4' }, bar1: { battle: ['charge'], def: ['taunt'] }, bars: [[]] }); return c.L.bar1.berserker.every(x => x === null) && c.L.bar1.battle[0] === 'charge'; })(),
        only: D.only('ff').map(s => s.id).join(',') + ' / ' + D.only('wrath').map(s => s.id).join(',')
      };
    });
    ok(r.pages === 'caster,bear,cat,prowl', 'druid pages: caster, bear, cat, prowl (' + r.pages + ')');
    ok(r.start === 'caster,battle', 'druid starts in caster form, warrior in Battle Stance');
    ok(r.bearTwice === 'caster' && r.catToBear === 'bear', 'pressing the active form returns to caster; forms switch directly');
    ok(r.prowlFromCaster.next === 'caster' && /Needs Cat Form/.test(r.prowlFromCaster.warn), 'Prowl needs Cat Form');
    ok(r.prowl === 'prowl' && r.prowlAgain === 'cat' && r.catWhileProwl === 'caster', 'Prowl toggles; Cat Form while prowling goes to caster');
    ok(r.shown === 'cat', 'stance bar lights Cat Form while prowling');
    ok(r.travelPage === 'caster,caster,prowl', 'Travel and Aquatic keep the caster page; Prowl has its own');
    ok(r.works === 'true,false,true,false,true,true,false,true', 'rules: cat abilities while prowling, Ravage only from Prowl, potions and Barkskin anywhere, Faerie Fire in Cat');
    ok(r.battleTwice === 'battle', 'a warrior stays in a stance when pressing it again');
    ok(r.wPages === 'battle,def,berserker', 'warrior has a Berserker page');
    ok(r.wOld, 'an older save without the Berserker page loads with it empty');
    ok(r.only === 'caster,bear,cat,moonkin / caster,moonkin', 'only-in lists for Faerie Fire and Wrath (Moonkin casts both)');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n=== Forever warrior ===');
  {
    const { ctx, p } = await fresh();
    ok((await p.$$('#kbSt .kb-slot')).length === 3 && (await p.$$eval('#kbPages .kb-pg', e => e.map(x => x.textContent).join(','))) === 'Battle,Defensive,Berserker', 'three stances, three page tabs');
    await p.keyboard.press('Shift+z');
    ok((await tag(p)) === 'Berserker Stance' && (await tab(p)) === 'Berserker' && (await name(p, 'b1-0')) === 'Intercept' && (await name(p, 'b1-4')) === 'Berserker Rage', 'Shift+Z: Berserker page');
    await p.click('#kbPages .kb-pg[data-page="def"]');
    ok((await tag(p)) === 'Defensive Stance' && (await name(p, 'b1-7')) === 'Thunder Clap' && !(await cls(p, 'b1-7')).includes('kb-red'), 'page tab switches; Thunder Clap works in Defensive Stance');
    ok((await name(p, 'b2-7')) === 'Victory Rush', 'Victory Rush on bar 2');
    ok((await book(p)).includes('slam') && (await meta(p, 'victory')) === 'Level 20 · Any stance', 'Slam and Victory Rush in the spellbook');
    ok(!(await book(p)).includes('stoneform') && (await p.$eval('#raceSel', s => s.value)) === '', 'no race yet: no racials, race select asks');
    await p.selectOption('#raceSel', 'dwarf');
    await p.waitForTimeout(100);
    ok((await book(p)).includes('stoneform') && (await meta(p, 'stoneform')) === 'Racial · Level 1 · Any stance', 'Dwarf: Stoneform in the spellbook');
    ok((await p.textContent('#kbSum')).startsWith('Warrior: Dwarf Warrior, level 60'), 'summary names the race');
    const s = (await p.evaluate(() => JSON.parse(localStorage.getItem('forever-keybind')))).setups[0];
    ok(s.race === 'dwarf', 'race saved');
    await p.selectOption('#raceSel', 'gnome');
    await p.waitForTimeout(100);
    const bk = await book(p);
    ok(bk.includes('eurekawarrior') && !bk.includes('eurekamage') && !bk.includes('stoneform'), 'Gnome warrior gets the warrior Eureka! only');
    ok(!(await p.$$eval('#raceSel option', os => os.map(o => o.value))).includes('tauren') === false, 'Tauren can be a warrior');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n=== druid ===');
  {
    const { ctx, p } = await fresh();
    await p.click('[data-setup="new"]');
    await p.waitForSelector('#setupDlg[open]');
    await p.selectOption('#dlgCls', 'druid');
    const races = await p.$$eval('#dlgRace option', os => os.map(o => o.value).join(','));
    ok(races === 'nightelf,skyborne-highorder,tauren,skyborne-windshaper', 'druid races: Night Elf, Tauren, both Skyborne (' + races + ')');
    ok((await p.inputValue('#dlgName')) === 'Druid 1', 'the default name follows the class');
    await p.selectOption('#dlgRace', 'tauren');
    await p.click('#dlgOk');
    await p.waitForSelector('#setupDlg', { state: 'hidden' });
    await p.waitForTimeout(150);
    ok((await p.textContent('#setupCls')).includes('Druid') && (await p.$eval('#raceSel', s => s.value)) === 'tauren', 'Tauren Druid setup');
    ok((await p.$$('#kbSt .kb-slot')).length === 5 && !(await p.$('#kbSt .kb-on')) && (await p.getAttribute('#kbSt [data-slot="st-moonkin"]', 'class')).includes('kb-dim'), 'stance bar: five forms, none lit in caster form, Moonkin dimmed (talent not taken)');
    ok((await tag(p)) === 'Caster Form' && (await tab(p)) === 'Caster' && (await name(p, 'b1-0')) === 'Wrath', 'starts in caster form: Wrath on 1');
    ok((await p.$eval('#kbB2 .kb-bar-r', e => e.textContent)) === 'All forms', 'extra bars say All forms');
    await p.keyboard.press('z');
    ok((await tag(p)) === 'Bear Form' && (await name(p, 'b1-0')) === 'Maul' && (await p.$eval('#kbBody', e => e.style.getPropertyValue('--kb-st'))) === 'var(--rage)', 'Z: Bear Form, Maul');
    ok(!(await cls(p, 'b2-10')).includes('kb-red') && !(await cls(p, 'b2-0')).includes('kb-red'), 'potion and Barkskin work in Bear Form');
    await p.keyboard.press('z');
    ok((await tag(p)) === 'Caster Form' && /back in Caster Form/.test(await out(p)), 'Z again: back to caster form');
    await p.keyboard.press('x');
    ok((await tag(p)) === 'Cat Form' && (await name(p, 'b1-7')) === 'Prowl', 'X: Cat Form, Prowl on F');
    ok((await cls(p, 'b1-4')).includes('kb-red') === false && (await name(p, 'b1-4')) === 'Faerie Fire', 'Faerie Fire works in Cat Form');
    await p.keyboard.press('f');
    ok((await tag(p)) === 'Prowl' && (await tab(p)) === 'Prowl' && (await name(p, 'b1-0')) === 'Ravage' && (await p.getAttribute('#kbSt [data-slot="st-cat"]', 'class')).includes('kb-on'), 'F: Prowl page with Ravage, Cat still lit');
    await p.keyboard.press('f');
    ok((await tag(p)) === 'Cat Form' && (await name(p, 'b1-0')) === 'Claw', 'F again: out of Prowl');
    await p.keyboard.press('Shift+x');
    ok((await tag(p)) === 'Travel Form' && (await tab(p)) === 'Caster' && (await cls(p, 'b1-0')).includes('kb-red'), 'Travel Form keeps the caster page, where Wrath can’t be cast');
    await p.click('#kbPages .kb-pg[data-page="bear"]');
    ok((await tag(p)) === 'Bear Form', 'page tab to Bear');
    ok((await meta(p, 'ff')) === 'Level 18 · Caster, Bear, Cat or Moonkin' && (await meta(p, 'potion')).endsWith('Any form'), 'spellbook lists where abilities work');
    ok((await meta(p, 'warstomp')) === 'Racial · Level 1 · Any form', 'Tauren racial in the spellbook');
    // put War Stomp on bar 2, then change race
    await p.click('#kbBook .kb-sp[data-k="warstomp"]');
    await p.click('#kbBars [data-slot="b3-11"]');
    ok((await name(p, 'b3-11')) === 'War Stomp', 'War Stomp placed on bar 3');
    await p.selectOption('#raceSel', 'nightelf');
    await p.waitForTimeout(150);
    ok((await name(p, 'b3-11')) === '' && /Took War Stomp off/.test(await out(p)) && (await book(p)).includes('shadowmeld'), 'Night Elf: War Stomp removed, Shadowmeld in');
    await p.screenshot({ path: OUT + '/druid.png' });
    // export and import keep the race
    await p.click('[data-act="export"]');
    const ex = JSON.parse(await p.inputValue('#kbJson'));
    ok(ex.setup.cls === 'druid' && ex.setup.race === 'nightelf' && ex.setup.layout.bar1.prowl[0] === 'ravage', 'export has class, race and the Prowl page');
    ex.setup.race = 'dwarf';
    await p.fill('#kbJson', JSON.stringify(ex));
    await p.click('[data-act="import"]');
    await p.waitForTimeout(200);
    ok((await p.$eval('#raceSel', s => s.value)) === '' && (await p.textContent('#setupCls')).includes('Druid'), 'import of a race the class can’t be clears the race');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n=== level dimming of forms ===');
  {
    const { ctx, p } = await fresh();
    await newSetup(p, 'druid', 'nightelf', 15);
    ok((await p.getAttribute('#kbSt [data-slot="st-bear"]', 'class')).includes('kb-dim') === false && (await p.getAttribute('#kbSt [data-slot="st-cat"]', 'class')).includes('kb-dim'), 'level 15: Bear learned, Cat Form dimmed');
    await p.keyboard.press('x');
    ok(/Not learned yet: level 20/.test(await out(p)), 'pressing Cat Form at 15 warns');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(fails.length ? '\n' + fails.length + ' FAILED' : '\nALL PASSED');
  process.exitCode = fails.length ? 1 : 0;
})();
