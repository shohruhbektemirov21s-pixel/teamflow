// Install Playwright in artifacts/browser-tools to keep the app's lockfile intact.
// Only synthetic sessions from the isolated test stack are accepted.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('./artifacts/browser-tools/package.json', import.meta.url));
const { chromium } = require('playwright');
const fixtures = JSON.parse(readFileSync(new URL('./artifacts/users.json', import.meta.url), 'utf8'));
const origin = 'http://127.0.0.1:18088';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const results = [];
const routes = {
  boss: ['/', '/vazifalar', '/loyihalar', '/xodimlar', '/taqvim', '/tekshiruv', '/profil', '/qilingan-ishlar'],
  pm: ['/', '/xodimlar', '/vazifalar'],
  developer: ['/', '/mening-ishim', '/vazifalar', '/taqvim', '/profil', '/xabarlar'],
  department: ['/', '/buyurtmalar', '/profil'],
};
try {
  for (const [role, paths] of Object.entries(routes)) {
    const user = fixtures.find(item => item.role === role);
    for (const width of [375, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addCookies([{ name: 'sessionid', value: user.session, url: origin }]);
      const page = await context.newPage();
      for (const path of paths) {
        const errors = [], failures = [];
        const onError = error => errors.push(error.message);
        const onResponse = response => {
          if (response.status() >= 400) failures.push({ path: new URL(response.url()).pathname, status: response.status() });
        };
        page.on('pageerror', onError);
        page.on('response', onResponse);
        await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(500);
        const authenticated = await page.evaluate(() => !location.pathname.includes('kirish') && !!document.querySelector('.app-shell, .layout, main'));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
        const result = { role, width, path, authenticated, overflow, errors, failures };
        if (path === '/xodimlar' && width === 1440) {
          const next = page.getByRole('button', { name: 'Keyingi →', exact: true });
          await Promise.all([
            page.waitForResponse(r => r.url().includes('/api/people/') && new URL(r.url()).searchParams.get('page') === '2'),
            next.click(),
          ]);
          await page.waitForTimeout(200);
          result.pageTwo = (await page.getByRole('navigation', { name: 'Sahifalar' }).textContent()).includes('2');
        }
        results.push(result);
        page.off('pageerror', onError);
        page.off('response', onResponse);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(fileURLToPath(new URL('./artifacts/browser.json', import.meta.url)), JSON.stringify(results, null, 2));
}
const failed = results.filter(r => !r.authenticated || r.errors.length || r.failures.length || r.pageTwo === false);
console.log(JSON.stringify({ checks: results.length, failed, overflows: results.filter(r => r.overflow).map(({ role, width, path }) => ({ role, width, path })) }));
if (failed.length) process.exitCode = 1;
