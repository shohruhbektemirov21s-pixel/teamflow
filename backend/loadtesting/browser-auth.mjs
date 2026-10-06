import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('./artifacts/browser-tools/package.json', import.meta.url));
const { chromium } = require('playwright');
const credentials = JSON.parse(readFileSync(new URL('./artifacts/browser-login.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const results = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:18088/kirish', { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="username"]').fill(credentials.username);
  await page.locator('input[type="password"]').fill('incorrect-test-password');
  const invalid = page.waitForResponse(r => r.url().endsWith('/api/auth/login/'));
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  results.push({ check: 'invalid login rejected', passed: (await invalid).status() === 400 });
  await page.locator('input[type="password"]').fill(credentials.password);
  const valid = page.waitForResponse(r => r.url().endsWith('/api/auth/login/'));
  await page.getByRole('button', { name: 'Kirish', exact: true }).click();
  results.push({ check: 'valid login accepted', passed: (await valid).status() === 200 });
  await page.waitForURL('http://127.0.0.1:18088/');
  await page.locator('main').waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  results.push({ check: 'session survives reload', passed: await page.locator('main').count() === 1 });
  const logout = page.waitForResponse(r => r.url().endsWith('/api/auth/logout/'));
  await page.getByRole('button', { name: 'Chiqish', exact: true }).click();
  results.push({ check: 'logout accepted', passed: (await logout).status() === 200 });
  await page.waitForTimeout(300);
  const response = await context.request.get('http://127.0.0.1:18088/api/people/');
  results.push({ check: 'logged-out session denied', passed: [401, 403].includes(response.status()) });
  await context.close();
} finally {
  await browser.close();
  writeFileSync(new URL('./artifacts/browser-auth.json', import.meta.url), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results));
if (results.some(result => !result.passed) || results.length !== 5) process.exitCode = 1;
