/* Runs every *.test.js in this folder one after another and fails if any of them fails. */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const only = process.argv[2];
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only || f.includes(only))).sort();
const results = [];
for (const f of files) {
  console.log(`\n##### ${f}`);
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  results.push({ f, ok: r.status === 0, s: ((Date.now() - t) / 1000).toFixed(0) });
}
console.log('\n##### Summary');
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.f}  (${r.s}s)`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
