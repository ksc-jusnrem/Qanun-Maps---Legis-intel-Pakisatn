const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(fetchImpl = async () => ({ ok: true, status: 201 })) {
  const calls = [], timers = new Map(), attributes = {};
  let handler, nextTimer = 0, resets = 0;
  const input = value => ({ value, focus() { this.focused = true; } });
  const form = {
    website: input(''), full_name: input(' Ada Reader '), email: input(' ada@example.invalid '),
    institution: input(' Library '), jurisdiction: input(' UK '), message: input(' Note '), subscribe: { checked: false },
    addEventListener(type, fn) { assert.equal(type, 'submit'); handler = fn; },
    querySelectorAll() { return [{ value: 'reader' }]; },
    querySelector() { return { value: 'both' }; },
    setAttribute(k, v) { attributes[k] = v; }, removeAttribute(k) { delete attributes[k]; },
    reset() { resets++; this.full_name.value = ''; this.subscribe.checked = false; }
  };
  const msg = {}, send = { disabled: false, textContent: 'Register interest' };
  vm.runInNewContext(script, {
    document: { getElementById: id => ({ interest: form, msg, send })[id] },
    AbortController, setTimeout(fn, ms) { assert.equal(ms, 15000); timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    fetch(...args) { calls.push(args); return fetchImpl(...args); }
  });
  return { form, msg, send, calls, timers, attributes, get resets() { return resets; },
    submit() { handler({ preventDefault() {} }); },
    timeout() { for (const fn of [...timers.values()]) fn(); }
  };
}
test('updates opt-in is unchecked in the actual HTML', () => {
  const tag = html.match(/<input[^>]+id="subscribe"[^>]*>/)[0];
  assert.doesNotMatch(tag, /\bchecked\b/);
});
test('opt-out payload and confirmation; success cannot submit again', async () => {
  const h = harness(); h.submit(); await flush();
  const [url, request] = h.calls[0];
  assert.match(url, /\/rest\/v1\/interest_registrations$/);
  assert.equal(request.method, 'POST');
  assert.deepEqual(JSON.parse(request.body), { full_name: 'Ada Reader', email: 'ada@example.invalid', institution: 'Library', jurisdiction: 'UK', edition: 'both', roles: ['reader'], subscribe: false, message: 'Note' });
  assert.deepEqual(Object.keys(request.headers).sort(), ['Content-Type', 'Prefer', 'apikey']);
  assert.match(h.msg.textContent, /not subscribed/); assert.doesNotMatch(h.msg.textContent, /We will write/);
  assert.equal(h.resets, 1); assert.equal(h.form.subscribe.checked, false);
  assert.equal(h.send.disabled, true); assert.equal(h.send.textContent, 'Registered');
  h.submit(); await flush(); assert.equal(h.calls.length, 1); assert.equal(h.timers.size, 0);
});
test('opt-in confirmation reflects submitted choice, not later field edits', async () => {
  let resolve; const h = harness(() => new Promise(r => { resolve = r; }));
  h.form.subscribe.checked = true; h.submit(); await flush(); h.form.subscribe.checked = false;
  resolve({ ok: true, status: 201 }); await flush();
  assert.equal(JSON.parse(h.calls[0][1].body).subscribe, true);
  assert.match(h.msg.textContent, /opted in.*ada@example.invalid/);
});
test('repeated submits while pending produce one request', async () => {
  const h = harness(() => new Promise(() => {})); h.submit(); h.submit(); await flush();
  assert.equal(h.calls.length, 1); assert.equal(h.attributes['aria-busy'], 'true');
  h.timeout(); await flush(); assert.equal(h.attributes['aria-busy'], undefined);
});
test('timeout aborts and preserves details; late success cannot overwrite uncertainty', async () => {
  let resolve; const h = harness(() => new Promise(r => { resolve = r; }));
  h.submit(); await flush(); h.timeout(); await flush();
  assert.equal(h.calls[0][1].signal.aborted, true);
  assert.match(h.msg.textContent, /could not confirm.*do not submit again yet/);
  assert.equal(h.resets, 0); assert.equal(h.form.full_name.value, ' Ada Reader ');
  const message = h.msg.textContent; h.submit(); resolve({ ok: true, status: 201 }); await flush();
  assert.equal(h.msg.textContent, message); assert.equal(h.calls.length, 1); assert.equal(h.timers.size, 0);
});
for (const status of [400, 403, 429]) test(`explicit ${status} rejection permits deliberate retry`, async () => {
  let attempt = 0; const h = harness(async () => ++attempt === 1 ? { ok: false, status } : { ok: true, status: 201 });
  h.submit(); await flush(); assert.equal(h.send.disabled, false); assert.equal(h.resets, 0);
  assert.equal(h.send.textContent, 'Try again'); if (status === 429) assert.match(h.msg.textContent, /wait/);
  h.submit(); await flush(); assert.equal(h.calls.length, 2); assert.equal(h.resets, 1);
});
for (const status of [408, 409, 500, 502, 503]) test(`ambiguous ${status} response blocks duplicate retry`, async () => {
  const h = harness(async () => ({ ok: false, status })); h.submit(); await flush();
  assert.equal(h.send.disabled, true); assert.match(h.msg.textContent, /could not confirm/);
  assert.equal(h.resets, 0); h.submit(); await flush(); assert.equal(h.calls.length, 1);
});
test('network failure does not claim that saving failed or invite blind retry', async () => {
  const h = harness(async () => { throw new TypeError('network'); }); h.submit(); await flush();
  assert.match(h.msg.textContent, /could not confirm/); assert.equal(h.send.disabled, true);
  assert.equal(h.timers.size, 0); assert.equal(h.attributes['aria-busy'], undefined);
});
test('synchronous fetch error also cleans up', async () => {
  const h = harness(() => { throw new Error('unavailable'); }); h.submit(); await flush();
  assert.match(h.msg.textContent, /could not confirm/); assert.equal(h.timers.size, 0);
});
test('invalid name/email and honeypot send nothing', async () => {
  for (const field of ['full_name', 'email']) {
    const h = harness(); h.form[field].value = ''; h.submit(); await flush();
    assert.equal(h.calls.length, 0); assert.equal(h.form[field].focused, true);
  }
  const h = harness(); h.form.website.value = 'spam'; h.submit(); await flush(); assert.equal(h.calls.length, 0);
});
