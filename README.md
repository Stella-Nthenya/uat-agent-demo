# AI-assisted UAT agent (demo)

Turns acceptance criteria into browser checks against SauceDemo, a public practice shop, and writes an evidence report.

1. `npm run plan`: Claude (through the Claude Code CLI) turns `criteria.json` into `plan.json`.
2. `npm run uat`: Playwright runs the plan and writes `report/index.html` with screenshots.

AI plans the scenarios. Coded checks decide the outcomes.

- PASS: every check held.
- FAIL: a check did not hold. The report shows what was observed.
- BLOCKED: a prerequisite is missing or a step could not run.
- NOT COVERED: the tools cannot observe the outcome, or the plan was rejected.

Plans are limited to listed actions, accounts and paths, and requests outside the demo site are blocked. A plan with no checks is rejected. A person should review each plan, since the code cannot judge whether a check fully proves its criterion.

    npm ci && npx playwright install chromium && npm run uat

AC7 uses the site's deliberately broken account, so it should FAIL and `npm run uat` should exit 1.

Independent demo, not client work. Not affiliated with Sauce Labs.
