// Turns criteria.json into plan.json using Claude Code in print mode (no tools).
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const criteria = JSON.parse(readFileSync('criteria.json', 'utf8'));
const prompt = `You plan UAT for the public demo shop www.saucedemo.com. Reply with ONLY a JSON array, no prose or code fence.
One object per criterion: {"id","status":"planned"|"blocked"|"not_covered","reason","steps":[],"checks":[]}.
- planned: steps reach the state and checks prove the criterion itself. "reason" says in one sentence why the checks prove it.
- blocked: the criterion could be tested but a prerequisite is missing.
- not_covered: these tools cannot observe the outcome. Never substitute a weaker check.
Use empty steps and checks unless planned.
Steps: {"do":"goto","path":"/"|"/inventory.html"|"/cart.html"}, {"do":"login","user":"standard_user"|"locked_out_user"|"problem_user"}, {"do":"click","id"}, {"do":"fill","id","value"}, {"do":"select","id","value"}.
Checks: {"do":"urlContains","text"}, {"do":"textContains","id","text"}, {"do":"countIs","id","n"}, {"do":"pricesAscending"}, {"do":"imagesDistinct"}, {"do":"totalIsSubtotalPlusTax"}.
Element ids: error, inventory-item, product-sort-container (select values az, za, lohi, hilo), shopping-cart-link, shopping-cart-badge, add-to-cart-sauce-labs-backpack, add-to-cart-sauce-labs-bike-light, checkout, firstName, lastName, postalCode, continue, finish, complete-header.
Product list is /inventory.html. Order: cart link, checkout, fill details, continue (/checkout-step-two.html shows totals), finish.
Criteria: ${JSON.stringify(criteria)}`;
const r = spawnSync('claude', ['-p', '--tools', '', '--no-session-persistence'], { input: prompt, encoding: 'utf8', timeout: 240000 });
if (r.status !== 0) { console.error(r.stderr || r.stdout || r.error); process.exit(1); }
const a = r.stdout.indexOf('['), b = r.stdout.lastIndexOf(']');
const plan = JSON.parse(r.stdout.slice(a, b + 1));
writeFileSync('plan.json', JSON.stringify(plan, null, 2) + '\n');
console.log(`planned ${plan.length} of ${criteria.length} criteria`);
