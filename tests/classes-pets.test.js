/* Sprint 3: talents, classes without a stance bar, Stealth, paladin auras, faction and race filters, and the pet bar. */
const { chromium } = require('playwright');
const { serve, OUT } = require('./env');
(async () => {
  const srv = await serve(), URL = srv.url;
  const b = await chromium.launch();
  const fails = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
  const fresh = async () => {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.route(/zamimg|wowhead|fonts\./, r => r.abort());
    await p.goto(URL); await p.waitForSelector('#kbB1 .kb-slot');
    return { ctx, p };
  };
  const name = (p, id) => p.textContent(`#kbBars [data-slot="${id}"] .kb-name`);
  const cls = (p, id) => p.getAttribute(`#kbBars [data-slot="${id}"]`, 'class');
  const out = p => p.textContent('#kbOut');
  const meta = (p, k) => p.textContent(`#kbBook .kb-sp[data-k="${k}"] .kb-spm`);
  const book = p => p.$$eval('#kbBook .kb-sp', els => els.map(e => e.dataset.k));
  const heads = p => p.$$eval('#kbBook .kb-bh', els => els.map(e => e.textContent).join(' | '));
  const saved = p => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('forever-keybind')); return s.setups.find(x => x.id === s.active); });
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

  console.log('\n=== every class opens ===');
  {
    const { ctx, p } = await fresh();

    for (const c of ['warrior', 'druid', 'rogue', 'priest', 'paladin', 'mage', 'hunter', 'warlock']) {
      await newSetup(p, c);
      const n = (await book(p)).length, filled = await p.$$eval('#kbB1 .kb-slot:not(.kb-empty)', e => e.length);
      ok(n > 30 && filled >= 9 && (await p.textContent('#kbSum')).includes('Action bar 1'), c + ': spellbook (' + n + ') and starter bar 1 (' + filled + ' filled)');
    }
    const opts = await p.$$eval('#dlgCls option', os => os.map(o => o.value + (o.disabled ? '(x)' : '')));
    ok(opts.filter(o => o.endsWith('(x)')).join() === 'shaman(x)', 'only Shaman is still coming soon');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n=== talents ===');
  {
    const { ctx, p } = await fresh();
    ok((await heads(p)) === 'Warrior | Arms talents | Fury talents | Protection talents | Racials | Items' || (await heads(p)) === 'Warrior | Arms talents | Fury talents | Protection talents | Items', 'spellbook groups: class, a group per tree, items (' + (await heads(p)) + ')');
    ok((await meta(p, 'mortal')) === 'Level 40 · Any stance' && (await p.textContent('#kbBook .kb-sp[data-k="mortal"] .kb-take')) === 'Take', 'Mortal Strike: not taken yet');
    await p.click('#kbBook .kb-sp[data-k="mortal"]');
    await p.click('#kbBars [data-slot="b3-0"]');
    ok((await name(p, 'b3-0')) === 'Mortal Strike' && (await cls(p, 'b3-0')).includes('kb-dim') && (await p.textContent('#kbBars [data-slot="b3-0"] .kb-lv')) === 'T', 'placed but not taken: dimmed with a T');
    ok((await p.textContent('#kbSum')).includes('Mortal Strike  [talent not taken]'), 'summary flags it');
    await p.click('#kbBook .kb-sp[data-k="mortal"] .kb-take');
    ok((await p.textContent('#kbBook .kb-sp[data-k="mortal"] .kb-take')) === 'Taken' && !(await cls(p, 'b3-0')).includes('kb-dim') && /Took Mortal Strike/.test(await out(p)), 'Take: counts as learned');
    ok((await saved(p)).talents.join() === 'mortal', 'saved with the setup');
    ok(!(await p.$('#kbBook .kb-sp.kb-held')), 'the Take button doesn’t pick the ability up');
    await p.click('[data-act="export"]');
    const ex = JSON.parse(await p.inputValue('#kbJson'));
    ok(ex.setup.talents.join() === 'mortal', 'export has the talents');
    ex.setup.talents = ['mortal', 'bloodthirst', 'stoneform', 'nonsense'];
    await p.fill('#kbJson', JSON.stringify(ex)); await p.click('[data-act="import"]'); await p.waitForTimeout(200);
    ok((await saved(p)).talents.join() === 'mortal,bloodthirst', 'import keeps only real talents');
    await p.fill('#levelIn', '30'); await p.$eval('#levelIn', e => e.dispatchEvent(new Event('change')));
    ok((await p.textContent('#kbBars [data-slot="b3-0"] .kb-lv')) === '40', 'a taken talent above your level shows the level instead');
    // druid: Moonkin Form is a talent stance
    await newSetup(p, 'druid', 'nightelf', 60);
    ok((await p.getAttribute('#kbSt [data-slot="st-moonkin"]', 'class')).includes('kb-dim'), 'Moonkin Form dimmed until taken');
    await p.click('#kbSt [data-slot="st-moonkin"]');
    ok((await p.textContent('#kbB1 .kb-st')) === 'Moonkin Form' && (await p.getAttribute('#kbPages [aria-pressed="true"]', 'data-page')) === 'caster', 'Moonkin Form keeps the caster page');
    ok((await cls(p, 'b1-5')).includes('kb-red') && !(await cls(p, 'b1-0')).includes('kb-red'), 'no heals in Moonkin Form (Rejuvenation red, Wrath fine)');
    await p.click('#kbBook .kb-sp[data-k="moonkin"] .kb-take');
    ok(!(await p.getAttribute('#kbSt [data-slot="st-moonkin"]', 'class')).includes('kb-dim'), 'taking it lights the form up');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n=== rogue: Stealth ===');
  {
    const { ctx, p } = await fresh();
    await newSetup(p, 'rogue', 'human');
    ok(!(await p.$('#kbSt')) && (await p.textContent('#kbB1 .kb-st')) === 'Normal', 'no stance bar; bar 1 says Normal');
    ok((await p.$eval('#kbB2 .kb-bar-r', e => e.textContent)) === '' && (await meta(p, 'sinisterstrike')) === 'Level 1', 'no “Any stance” noise');
    ok((await meta(p, 'ambush')) === 'Level 18 · Stealth', 'Ambush: Stealth only');
    await p.keyboard.press('f');
    ok((await p.textContent('#kbB1 .kb-st')) === 'Stealth' && (await name(p, 'b1-0')) === 'Ambush', 'F: Stealth page with Ambush');
    await p.keyboard.press('Shift+f');
    ok(/You stay in Stealth/.test(await out(p)), 'Vanish while stealthed keeps you in Stealth');
    await p.keyboard.press('f');
    ok((await p.textContent('#kbB1 .kb-st')) === 'Normal' && (await name(p, 'b1-0')) === 'Sinister Strike', 'F again: out of Stealth');
    await p.keyboard.press('Shift+f');
    ok((await p.textContent('#kbB1 .kb-st')) === 'Stealth', 'Vanish puts you in Stealth');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n=== priest, paladin, mage ===');
  {
    const { ctx, p } = await fresh();
    await newSetup(p, 'priest', 'dwarf');
    ok(!(await p.$('#kbPages')) && (await p.$$('#kbSt .kb-slot')).length === 1, 'priest: Shadowform on the stance bar, no page tabs');
    await p.click('#kbBook .kb-sp[data-k="shadowform"] .kb-take');
    await p.keyboard.press('z');
    ok((await p.textContent('#kbB1 .kb-st')) === 'Shadowform' && /Shadowform is on/.test(await out(p)), 'Z: Shadowform is on');
    ok((await cls(p, 'b1-6')).includes('kb-red') && !(await cls(p, 'b1-0')).includes('kb-red'), 'no heals in Shadowform (Flash Heal red, Smite fine)');
    await newSetup(p, 'paladin', 'dwarf');
    ok((await p.$$('#kbSt .kb-slot')).length === 6 && !(await p.$('#kbPages')) && (await p.$eval('#kbB2 .kb-bar-r', e => e.textContent)) === '', 'paladin: six auras on the stance bar, no tabs, no “All auras”');
    ok((await meta(p, 'holystrike')) === 'Level 6' && (await book(p)).includes('summoncharger'), 'Holy Strike; Dwarf gets Summon Charger');
    await p.keyboard.press('Shift+z');
    ok(/Devotion Aura is on/.test(await out(p)) && (await p.getAttribute('#kbSt [data-slot="st-devotion"]', 'class')).includes('kb-on'), 'Shift+Z: Devotion Aura on and lit');
    await p.selectOption('#raceSel', 'undead'); await p.waitForTimeout(150);
    ok(!(await book(p)).includes('summoncharger'), 'Undead paladin: no Summon Charger');
    await newSetup(p, 'mage', 'troll');
    const bk = await book(p);
    ok(bk.includes('teleportorgrimmar') && !bk.includes('teleportstormwind') && bk.includes('teleportdalaran'), 'Troll mage: Horde teleports and Dalaran only');
    ok(!(await p.$('#kbSt')) && !(await p.$('#kbPages')) && (await p.textContent('#kbB1 .kb-bar-r')) === '', 'mage: no stance bar, tabs or state tag');
    await p.click('#kbBook .kb-sp[data-k="teleportorgrimmar"]'); await p.click('#kbBars [data-slot="b3-0"]');
    await p.selectOption('#raceSel', 'gnome'); await p.waitForTimeout(150);
    ok((await name(p, 'b3-0')) === '' && /Took Teleport: Orgrimmar off/.test(await out(p)) && (await book(p)).includes('teleportstormwind'), 'Gnome: Horde teleport taken off the bars, Alliance ones in');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  console.log('\n=== pet bar ===');
  {
    const { ctx, p } = await fresh();
    await newSetup(p, 'hunter', 'dwarf');
    ok((await p.$$('#kbPet .kb-slot')).length === 10 && !(await p.$('#kbPetTabs')), 'hunter: a 10-slot pet bar, one page');
    ok((await name(p, 'p-0')) === 'Attack' && (await name(p, 'p-3')) === 'Bite', 'pet bar: Attack, then Bite');
    ok((await heads(p)).endsWith('Pet'), 'pet abilities in their own spellbook group');
    await p.keyboard.press('Control+4');
    ok(/Bite/.test(await out(p)), 'Ctrl+4 fires Bite');
    // pet abilities only on the pet bar, and the other way round
    await p.click('#kbBook .kb-sp[data-k="petbite"]'); await p.click('#kbBars [data-slot="b3-0"]');
    ok((await name(p, 'b3-0')) === '' && /only goes on the pet bar/.test(await out(p)) && (await p.$('#kbBook .kb-sp.kb-held[data-k="petbite"]')), 'a pet ability won’t go on action bar 3 and stays in hand');
    await p.keyboard.press('Escape');
    await p.click('#kbBook .kb-sp[data-k="arcaneshot"]'); await p.click('#kbBars [data-slot="p-9"]');
    ok((await name(p, 'p-9')) === 'Passive' && /Only pet abilities go on the pet bar/.test(await out(p)), 'Arcane Shot won’t go on the pet bar');
    await p.keyboard.press('Escape');
    await newSetup(p, 'warlock', 'human');
    ok((await p.$$eval('#kbPetTabs .kb-pg', e => e.map(x => x.textContent).join())) === 'Imp,Voidwalker,Succubus,Incubus,Felhunter', 'warlock: a pet tab per demon');
    ok((await name(p, 'p-3')) === 'Firebolt', 'starts on the Imp: Firebolt');
    await p.keyboard.press('Shift+2');
    ok((await name(p, 'p-3')) === 'Torment' && /Voidwalker/.test(await out(p)), 'Summon Voidwalker switches the pet bar');
    await p.click('#kbPetTabs .kb-pg[data-pet="felhunter"]');
    ok((await name(p, 'p-3')) === 'Devour Magic' && (await name(p, 'p-0')) === 'Attack', 'Felhunter tab');
    // moving within one pet page moves the column on every demon, keys and all
    await p.$eval('#kbPet', e => e.scrollIntoView({ block: 'center' }));
    await p.dragAndDrop('#kbBars [data-slot="p-3"]', '#kbBars [data-slot="p-5"]');
    ok((await name(p, 'p-5')) === 'Devour Magic' && (await name(p, 'p-3')) === 'Spell Lock', 'drag on the pet bar swaps, and Spell Lock is picked up');
    await p.keyboard.press('Escape');
    await p.click('#kbPetTabs .kb-pg[data-pet="imp"]');
    ok((await name(p, 'p-5')) === 'Firebolt' && (await p.textContent('#kbBars [data-slot="p-5"] .kb-key')) === 'c-4', 'the Imp’s column moved too and kept Ctrl+4');
    // a demon ability on the wrong demon's page is flagged
    await p.click('#kbBook .kb-sp[data-k="petseduction"]'); await p.click('#kbBars [data-slot="p-7"]');
    ok((await cls(p, 'p-7')).includes('kb-red'), 'Seduction on the Imp’s bar is red');
    ok((await p.textContent('#kbSum')).includes('Pet bar, Imp') && (await p.textContent('#kbSum')).includes('not for Imp'), 'summary lists each demon');
    await p.screenshot({ path: OUT + '/warlock.png' });
    await p.reload(); await p.waitForTimeout(300);
    ok((await name(p, 'p-5')) === 'Firebolt', 'pet bar survives reload');
    ok(!p.errs.length, 'no page errors ' + p.errs.join(' | '));
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log(fails.length ? '\n' + fails.length + ' FAILED' : '\nALL PASSED');
  process.exitCode = fails.length ? 1 : 0;
})();
