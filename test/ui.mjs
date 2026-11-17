// UI smoke test: loads Draft Room in Chrome (CDP 9334), screenshots the three tabs, drafts a few steps.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire('file:///C:/Users/burak/Desktop/faith-channels/pipeline/package.json');
const { chromium } = require('playwright-core');
const OUT = fileURLToPath(new URL('../kare/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.connectOverCDP('http://127.0.0.1:9334');
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(process.argv[2] ?? 'http://127.0.0.1:4891/', { waitUntil: 'load' });
await p.waitForSelector('.tiles', { timeout: 30000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: OUT + '1-scout.png' });
await p.screenshot({ path: OUT + '1-scout-full.png', fullPage: true });
await p.click('nav button[data-tab="series"]');
await p.waitForTimeout(800);
for (let i = 0; i < 7; i++) { await p.locator('.pool button:not([disabled])').nth(i * 3).click(); await p.waitForTimeout(250); }
await p.screenshot({ path: OUT + '2-series.png', fullPage: true });
await p.click('nav button[data-tab="self"]');
await p.waitForTimeout(800);
await p.screenshot({ path: OUT + '3-self.png' });
console.log('status:', await p.textContent('#dataStatus'), '| errors:', errors.length ? errors : 'none');
await ctx.close();
await b.close();
