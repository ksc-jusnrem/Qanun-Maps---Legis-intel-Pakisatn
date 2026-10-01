// Optional browser smoke tests. Requires Playwright and Chromium; all requests intercepted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    for (const width of [390, 1366]) {
      for (const scenario of ['opt-out', 'opt-in', 'server-error', 'network-error', 'retry', 'timeout']) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = []; const requests = []; let attempts = 0;
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', async route => {
          if (route.request().url().includes('/rest/v1/interest_registrations')) {
            requests.push(route.request().postDataJSON()); attempts++;
            if (scenario === 'network-error') return route.abort();
            if (scenario === 'timeout') return; // intentionally no response; local timer aborts
            return route.fulfill({ status: scenario === 'server-error' ? 503 : scenario === 'retry' && attempts === 1 ? 400 : 201, body: '' });
          }
          return route.abort(); // Fonts and every other outbound request blocked
        });
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        if (scenario === 'timeout') await page.clock.install();
        assert.equal(await page.locator('#subscribe').isChecked(), false);
        await page.locator('#full_name').fill('Test Reader');
        await page.locator('#email').fill('test@example.invalid');
        if (scenario === 'opt-in') await page.locator('#subscribe').check();
        await page.locator('#send').click();
        if (scenario === 'timeout') await page.clock.fastForward(16000);
        await page.waitForFunction(() => !document.querySelector('#interest').hasAttribute('aria-busy'));
        if (scenario === 'retry') { await page.locator('#send').click(); await page.waitForFunction(() => document.querySelector('#send').textContent === 'Registered'); }
        const msg = await page.locator('#msg').innerText();
        if (['server-error', 'network-error', 'timeout'].includes(scenario)) {
          assert.match(msg, /could not confirm/); assert.equal(await page.locator('#full_name').inputValue(), 'Test Reader');
        } else assert.match(msg, scenario === 'opt-in' ? /opted in/ : /not subscribed/);
        assert.equal(await page.locator('#send').isDisabled(), true);
        await page.locator('#interest').evaluate(form => form.dispatchEvent(new Event('submit', { cancelable: true })));
        assert.equal(requests.length, scenario === 'retry' ? 2 : 1);
        assert.equal(requests[0].subscribe, scenario === 'opt-in');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(errors, []);
        if (width === 390 && scenario === 'opt-out') await page.screenshot({ path: path.join(__dirname, '../../mobile-success.png'), fullPage: true });
        console.log(`PASS ${width}px ${scenario}: mocked only, no page errors or horizontal overflow`);
        await page.close();
      }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
