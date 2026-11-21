// Local preview only: fills the local database with sample customers and requests spread across the board columns.
// Usage: node scripts/dev-seed.cjs   (needs `wrangler dev` on :8788 with OWNER_PHONE=+971501234567 and WA_APP_SECRET in api/.dev.vars)
// Everything goes through the real public and staff APIs, exactly as the apps would.
const crypto = require('crypto'); const fs = require('fs'); const path = require('path')
const B = 'http://localhost:8788'
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../api/.dev.vars'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const req = (m, p, body, tok) => fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ s: r.status, j: await r.json().catch(() => ({})) }))
const deliver = async (from, code) => {
  const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, type: 'text', text: { body: code } }] } }] }] })
  await fetch(B + '/webhooks/whatsapp', { method: 'POST', headers: { 'x-hub-signature-256': 'sha256=' + crypto.createHmac('sha256', vars.WA_APP_SECRET).update(raw).digest('hex'), 'content-type': 'application/json' }, body: raw })
}
async function login(prefix, phone) {
  const st = (await req('POST', prefix + '/auth/wa/start', { phone })).j
  if (!st.code) throw new Error('sign-in start failed: ' + JSON.stringify(st))
  await deliver(phone.slice(1), st.code)
  const tok = (await req('POST', prefix + '/auth/wa/poll', { phone, challengeId: st.challengeId, pollToken: st.pollToken })).j.accessToken
  if (!tok) throw new Error('sign-in poll failed for ' + phone)
  return tok
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
const people = [
  ['خالد الأحمد', 'emirates-id', 'تجديد الهوية', 'Emirates ID renewal'], ['Sara Mitchell', 'residence-visa', 'إقامة', 'Residence visa'],
  ['محمد العلي', 'trade-licence', 'رخصة تجارية', 'Trade licence'], ['Priya Nair', 'driving-licence', 'رخصة قيادة', 'Driving licence'],
  ['فاطمة الزهراء', 'golden-visa', 'الإقامة الذهبية', 'Golden visa'], ['James Carter', 'attestation', 'تصديق مستندات', 'Document attestation'],
  ['ليلى حسن', 'family-visa', 'إقامة عائلية', 'Family visa'], ['Omar Farouk', 'company-setup', 'تأسيس شركة', 'Company formation'],
]
;(async () => {
  const run = Date.now() % 10000
  const ids = []
  for (const [i, [name, svc, ar, en]] of people.entries()) {
    const phone = `+9715299${String(run).padStart(4, '0')}${i}`.slice(0, 13)
    const tok = await login('/v1', phone)
    await req('PATCH', '/v1/me', { email: `sample${run}-${i}@example.com` }, tok)
    const r = await req('POST', '/v1/requests', { serviceId: svc, data: { name, phone: '0' + phone.slice(4), title: { ar, en }, fields: { 'passport-no': 'N' + (4000000 + i * 137) } } }, tok)
    if (!r.j.id) { console.log('skipped', name, r.s, JSON.stringify(r.j)); continue }
    await fetch(`${B}/v1/requests/${r.j.id}/files`, { method: 'PUT', headers: { authorization: 'Bearer ' + tok, 'x-file-name': 'passport.pdf' }, body: PDF })
    await req('PATCH', `/v1/requests/${r.j.id}`, { status: 'submitted' }, tok)
    ids.push(r.j.id)
  }
  const staff = await login('/staff/v1', vars.OWNER_PHONE || '+971501234567')
  for (const id of ids.slice(3)) await req('POST', `/staff/v1/requests/${id}/status`, { status: 'review' }, staff)
  for (const id of ids.slice(6)) await req('POST', `/staff/v1/requests/${id}/missing`, { items: [{ labelAr: 'صورة الإقامة', labelEn: 'Residence copy' }] }, staff)
  console.log(`Added ${ids.length} sample requests (New: 3, In progress: ${Math.max(0, ids.length - 5)}, Pending client: 2).`)
})().catch((e) => { console.error(e.message, '\nIs `npx wrangler dev --port 8788` running in api/?'); process.exit(1) })
