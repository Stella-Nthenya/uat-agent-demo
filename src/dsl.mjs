// The only things a plan may do. The model proposes steps; this file decides what is legal.
export const BASE = 'https://www.saucedemo.com';
export const USERS = ['standard_user', 'locked_out_user', 'problem_user'];
const PASSWORD = 'secret_sauce'; // printed publicly on the demo site's login page
const PATHS = ['/', '/inventory.html', '/cart.html'];
const t = (page, id) => page.locator(`[data-test="${id}"]`);
const money = (s) => Number(s.split('$').pop());
export class AssertionFailed extends Error {}
const must = (ok, msg) => { if (!ok) throw new AssertionFailed(msg); };
async function until(fn, msg) {
  let last;
  for (let i = 0; i < 20; i++) { last = await fn(); if (last.ok) return; await new Promise((r) => setTimeout(r, 250)); }
  must(false, `${msg}; observed ${JSON.stringify(last.seen)}`);
}

export const ACTIONS = {
  goto: async (p, { path }) => { await p.goto(BASE + path); },
  login: async (p, { user }) => {
    await p.goto(BASE);
    await t(p, 'username').fill(user);
    await t(p, 'password').fill(PASSWORD);
    await t(p, 'login-button').click();
  },
  click: async (p, { id }) => { await t(p, id).click(); },
  fill: async (p, { id, value }) => { await t(p, id).fill(value); },
  select: async (p, { id, value }) => { await t(p, id).selectOption(value); },
};
export const CHECKS = {
  urlContains: async (p, { text }) => until(async () => ({ ok: p.url().includes(text), seen: p.url() }), `URL should contain "${text}"`),
  textContains: async (p, { id, text }) => until(async () => {
    const seen = await t(p, id).count() ? await t(p, id).first().innerText() : '(element absent)';
    return { ok: seen.toLowerCase().includes(text.toLowerCase()), seen };
  }, `"${id}" should contain "${text}"`),
  countIs: async (p, { id, n }) => until(async () => { const seen = await t(p, id).count(); return { ok: seen === n, seen }; }, `expected ${n} of "${id}"`),
  pricesAscending: async (p) => until(async () => {
    const seen = (await t(p, 'inventory-item-price').allInnerTexts()).map(money);
    return { ok: seen.length > 1 && seen.every((x, i) => !i || seen[i - 1] <= x), seen };
  }, 'prices should ascend'),
  imagesDistinct: async (p) => until(async () => {
    const seen = await p.locator('img.inventory_item_img').evaluateAll((e) => e.map((x) => x.getAttribute('src').split('/').pop()));
    return { ok: seen.length > 1 && new Set(seen).size === seen.length, seen };
  }, 'each product should have its own image'),
  totalIsSubtotalPlusTax: async (p) => until(async () => {
    const seen = [];
    for (const id of ['subtotal-label', 'tax-label', 'total-label']) seen.push(await t(p, id).count() ? money(await t(p, id).innerText()) : null);
    return { ok: !seen.includes(null) && Math.abs(seen[0] + seen[1] - seen[2]) < 0.005, seen };
  }, 'total should equal item total plus tax'),
};
const ARGS = { goto: ['path'], login: ['user'], click: ['id'], fill: ['id', 'value'], select: ['id', 'value'], urlContains: ['text'], textContains: ['id', 'text'], countIs: ['id', 'n'], pricesAscending: [], imagesDistinct: [], totalIsSubtotalPlusTax: [] };

export function problemsWith(item) {
  const out = [];
  for (const [list, set] of [['steps', ACTIONS], ['checks', CHECKS]]) {
    if (!Array.isArray(item[list])) { out.push(`${list} is not a list`); continue; }
    for (const s of item[list]) {
      if (!Object.hasOwn(set, s.do)) { out.push(`unknown ${list} entry "${s.do}"`); continue; }
      for (const k of ARGS[s.do]) if (s[k] === undefined || (typeof s[k] === 'string' && !['value'].includes(k) && !s[k])) out.push(`${s.do} needs ${k}`);
      if (s.do === 'goto' && !PATHS.includes(s.path)) out.push(`path not allowed: ${s.path}`);
      if (s.do === 'login' && !USERS.includes(s.user)) out.push(`user not allowed: ${s.user}`);
      if (s.id !== undefined && !/^[A-Za-z0-9-]+$/.test(s.id)) out.push(`bad id: ${s.id}`);
    }
  }
  if (Array.isArray(item.checks) && !item.checks.length) out.push('no checks, so it could only pass falsely');
  return out;
}
