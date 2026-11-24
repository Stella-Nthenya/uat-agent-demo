import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { ACTIONS, CHECKS, BASE, AssertionFailed, problemsWith } from './dsl.mjs';
const criteria = JSON.parse(readFileSync('criteria.json', 'utf8'));
const plan = JSON.parse(readFileSync('plan.json', 'utf8'));
rmSync('report', { recursive: true, force: true }); mkdirSync('report/evidence', { recursive: true });
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const results = [];
for (const c of criteria) {
  const item = plan.find((x) => x.id === c.id);
  const res = { ...c, outcome: 'NOT COVERED', detail: item?.reason ?? 'The planner returned nothing for this criterion.', log: [] };
  results.push(res);
  if (!item || item.status === 'not_covered') continue;
  if (item.status === 'blocked') { res.outcome = 'BLOCKED'; continue; }
  const bad = item.status === 'planned' ? problemsWith(item) : [`unknown status ${item.status}`];
  if (bad.length) { res.detail = `Plan rejected: ${bad.join('; ')}`; continue; }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  await page.route('**/*', (r) => (new URL(r.request().url()).hostname.endsWith('saucedemo.com') ? r.continue() : r.abort()));
  try {
    for (const s of item.steps) { await ACTIONS[s.do](page, s); res.log.push(s); }
    for (const s of item.checks) { await CHECKS[s.do](page, s); res.log.push(s); }
    res.outcome = 'PASS';
  } catch (e) {
    // A broken check is a product failure. A step that cannot run is a blocker for a person to look at.
    res.outcome = e instanceof AssertionFailed ? 'FAIL' : 'BLOCKED';
    res.detail = e.message.split('\n')[0];
  }
  try { await page.screenshot({ path: `report/evidence/${c.id}.png` }); res.shot = `evidence/${c.id}.png`; } catch {}
  await ctx.close();
}
await browser.close();
const n = (o) => results.filter((r) => r.outcome === o).length;
const order = ['PASS', 'FAIL', 'BLOCKED', 'NOT COVERED'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cls = (o) => o.toLowerCase().replace(' ', '-');
writeFileSync('report/results.json', JSON.stringify({ target: BASE, results }, null, 2) + '\n');
writeFileSync('report/index.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>UAT report</title>
<style>body{font:16px/1.5 system-ui;margin:0;background:#f4f6f8;color:#15202b}main{max-width:1040px;margin:auto;padding:40px 24px}h1{margin:0}.sum{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.sum div,article{background:#fff;border:1px solid #d9e0e6;border-radius:8px;padding:16px 20px}.sum b{display:block;font-size:28px}article{margin:12px 0;display:grid;grid-template-columns:1fr 260px;gap:20px}img{width:100%;border:1px solid #d9e0e6}.tag{font-weight:700;font-size:13px;padding:2px 10px;border-radius:99px;color:#fff}.pass{background:#17683a}.fail{background:#b3261e}.blocked{background:#8a5300}.not-covered{background:#4d5b69}p{margin:8px 0}code{font-size:13px;overflow-wrap:anywhere}@media(max-width:700px){article{grid-template-columns:1fr}}</style>
<main><h1>UAT report: public demo shop</h1><p>${BASE}, run ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Scenarios were planned by AI. Outcomes were decided by coded checks. Anything other than PASS needs a person.</p>
<div class="sum">${order.map((o) => `<div><b>${n(o)}</b>${o}</div>`).join('')}</div>
${results.map((r) => `<article><div><span class="tag ${cls(r.outcome)}">${r.outcome}</span> <b>${r.id}</b><p>${esc(r.text)}</p><p>${r.outcome === 'PASS' ? 'Why this proves it: ' : 'Reason: '}${esc(r.detail)}</p>${r.log.length ? `<details><summary>Steps completed</summary>${r.log.map((s) => `<code>${esc(JSON.stringify(s))}</code><br>`).join('')}</details>` : ''}</div><div>${r.shot ? `<img src="${r.shot}" alt="Final screen for ${r.id}">` : 'No evidence: not executed'}</div></article>`).join('')}</main></html>`);
for (const r of results) console.log(r.outcome.padEnd(12), r.id, r.outcome === 'PASS' ? '' : r.detail);
process.exit(n('FAIL') ? 1 : 0);
